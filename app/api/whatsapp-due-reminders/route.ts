
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getCustomerLedgerBalance } from "@/src/lib/ledger-balance";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;

function getIndiaDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    date: values.year + "-" + values.month + "-" + values.day,
  };
}

function normalizePhone(value: string): string | null {
  let phone = value.replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(phone)) {
    phone = `91${phone}`;
  }

  return /^[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

async function sendDueReminder(phone: string, amount: number) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  const templateName =
    process.env.WHATSAPP_TEMPLATE_NAME || "swp_due_reminder";
  const language =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

  if (!phoneNumberId || !accessToken || !apiVersion) {
    throw new Error("WhatsApp API environment variables are missing.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: amount.toFixed(2),
                },
              ],
            },
          ],
        },
      }),
    }
  );

  const responseText = await response.text();

  let result: any;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error("WhatsApp returned an invalid API response.");
  }

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "WhatsApp API rejected the message."
    );
  }

  const messageId = result?.messages?.[0]?.id;

  if (!messageId) {
    throw new Error("WhatsApp did not return a message ID.");
  }

  return messageId as string;
}

async function runDueReminders(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const threshold = Number(
    process.env.WHATSAPP_DUE_THRESHOLD ?? "1000"
  );

  if (!Number.isFinite(threshold) || threshold < 0) {
    return NextResponse.json(
      { error: "Invalid WhatsApp due threshold." },
      { status: 500 }
    );
  }

  const { year, month, date } = getIndiaDateParts();

  // Indian financial year begins on 1 April.
  const financialYear = year - (month < 4 ? 1 : 0);

  // @db.Date: store the Indian calendar date, not the server's date.
  const reminderDate = new Date(`${date}T00:00:00.000Z`);

  const customers = await prisma.customer.findMany({
    where: {
      whatsappDueRemindersOptIn: true,
      phone: { not: null },
    },
    select: {
      id: true,
      phone: true,
    },
  });

  let eligible = 0;
  let accepted = 0;
  let failed = 0;
  let skipped = 0;

  const results: Array<{
  customerId: string;
  status: "ACCEPTED" | "FAILED" | "SKIPPED" | "UNKNOWN";
  error?: string;
}> = [];

  for (const customer of customers) {
    if (!customer.phone) continue;

    try {
      const ledgerBalance = await getCustomerLedgerBalance(
        customer.id,
        financialYear
      );

      const closingBalance = Number(ledgerBalance.closingBalance);

      // Only send when the balance is strictly above the threshold.
      if (!Number.isFinite(closingBalance) || closingBalance <= threshold) {
        continue;
      }

      eligible++;

      const phone = normalizePhone(customer.phone);
      if (!phone) {
  skipped++;
  results.push({
    customerId: customer.id,
    status: "SKIPPED",
    error: "Invalid phone number.",
  });
  continue;
}

      // Create the daily log if it does not already exist.
      const log = await prisma.customerDueReminderLog.upsert({
        where: {
          customerId_reminderDate: {
            customerId: customer.id,
            reminderDate,
          },
        },
        create: {
          customerId: customer.id,
          reminderDate,
          phone,
          pendingAmount: closingBalance,
          status: "PENDING",
        },
        update: {},
      });

      // Claim the log atomically. Only one concurrent request can claim it.
      // Failed sends can be retried, but never more than three attempts.
      const claim = await prisma.customerDueReminderLog.updateMany({
        where: {
          id: log.id,
          status: { in: ["PENDING", "FAILED"] },
          attemptCount: { lt: MAX_ATTEMPTS },
        },
        data: {
          status: "PROCESSING",
          phone,
          pendingAmount: closingBalance,
          error: null,
          attemptedAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        skipped++;
        results.push({
          customerId: customer.id,
          status: "SKIPPED",
        });
        continue;
      }

      try {
  const messageId = await sendDueReminder(phone, closingBalance);

  await prisma.customerDueReminderLog.update({
    where: { id: log.id },
    data: {
      status: "ACCEPTED",
      whatsappMessageId: messageId,
      sentAt: new Date(),
      error: null,
    },
  });

  accepted++;

  results.push({
    customerId: customer.id,
    status: "ACCEPTED",
  });
} catch (error) {
  console.error(
    "Automatic WhatsApp reminder outcome uncertain:",
    error
  );

  await prisma.customerDueReminderLog.update({
    where: { id: log.id },
    data: {
      status: "UNKNOWN",
      error:
        error instanceof Error
          ? error.message.slice(0, 2000)
          : "WhatsApp send outcome is uncertain.",
    },
  });

  failed++;

  results.push({
    customerId: customer.id,
    status: "UNKNOWN",
    error: "Check the reminder log before retrying.",
  });
}
    } catch (error) {
      failed++;

      results.push({
        customerId: customer.id,
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Failed to process customer reminder.",
      });
    }
  }

  return NextResponse.json({
    message: "WhatsApp due reminder run completed.",
    reminderDate: date,
    financialYear,
    threshold,
    eligible,
    accepted,
    failed,
    skipped,
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await runDueReminders(request);
  } catch (error) {
    console.error("WhatsApp due reminders failed:", error);

    return NextResponse.json(
      { error: "Failed to process WhatsApp due reminders." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
