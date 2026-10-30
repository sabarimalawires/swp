
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizePhone(value: string): string | null {
  // WhatsApp Cloud API expects digits only, including country code.
  let phone = value.replace(/\D/g, "");

  // Convert Indian 10-digit numbers to 91 + number.
  if (/^[6-9]\d{9}$/.test(phone)) {
    phone = `91${phone}`;
  }

  // Basic international E.164 validation.
  if (!/^[1-9]\d{7,14}$/.test(phone)) {
    return null;
  }

  return phone;
}

async function sendDueReminder(phone: string, amount: number) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName =
    process.env.WHATSAPP_TEMPLATE_NAME || "swp_due_reminder";
  const language =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
  const apiVersion = process.env.WHATSAPP_API_VERSION;

  if (!phoneNumberId || !accessToken || !apiVersion) {
    throw new Error("WhatsApp API environment variables are missing.");
  }

  // Redirect every message to your test number when test mode is enabled.
  const testMode = process.env.WHATSAPP_TEST_MODE === "true";

  const recipient = testMode
    ? normalizePhone(process.env.WHATSAPP_TEST_RECIPIENT || "")
    : phone;

  if (!recipient) {
    throw new Error("Invalid WhatsApp recipient.");
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
        to: recipient,
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

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "WhatsApp API rejected the message."
    );
  }

  return result;
}

export async function POST(request: Request) {
  try {
    // Permit either an authenticated admin or the scheduled Vercel Cron.
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }
    if (process.env.WHATSAPP_TEST_MODE !== "true") {
  return NextResponse.json(
    { error: "Scheduled reminders are disabled until explicitly enabled." },
    { status: 403 }
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

    const customers = await prisma.customer.findMany({
      where: {
        whatsappDueRemindersOptIn: true,
        phone: { not: null },
      },
      select: {
        id: true,
        phone: true,
        sales: {
          where: { status: "ACTIVE" },
          select: { amount: true },
        },
        payments: {
          select: { amount: true },
        },
      },
    });

    let eligible = 0;
    let sent = 0;
    let failed = 0;

    const results: Array<{
      customerId: string;
      status: "SENT" | "FAILED";
      error?: string;
    }> = [];

    for (const customer of customers) {
      if (!customer.phone) continue;

      const totalPurchases = customer.sales.reduce(
        (sum, sale) => sum + Number(sale.amount),
        0
      );

      const totalPaid = customer.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );

      const pendingBalance = Math.max(
        0,
        totalPurchases - totalPaid
      );

      // Strictly greater than the configured threshold.
      if (pendingBalance <= threshold) continue;

      eligible++;

      const phone = normalizePhone(customer.phone);

      if (!phone) {
        failed++;
        results.push({
          customerId: customer.id,
          status: "FAILED",
          error: "Invalid customer phone number.",
        });
        continue;
      }

      try {
        await sendDueReminder(phone, pendingBalance);
        sent++;

        results.push({
          customerId: customer.id,
          status: "SENT",
        });
      } catch (error) {
        failed++;

        results.push({
          customerId: customer.id,
          status: "FAILED",
          error:
            error instanceof Error
              ? error.message
              : "Unknown WhatsApp sending error.",
        });
      }
    }

    return NextResponse.json({
      message: "WhatsApp due reminder run completed.",
      threshold,
      eligible,
      sent,
      failed,
      results,
    });
  } catch (error) {
    console.error("WhatsApp due reminders failed:", error);

    return NextResponse.json(
      { error: "Failed to send WhatsApp due reminders." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}