
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { getCustomerLedgerBalance } from "@/src/lib/ledger-balance";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 3;

function normalizePhone(value: string): string | null {
  let phone = value.replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(phone)) {
    phone = `91${phone}`;
  }

  return /^[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function getIndiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentFinancialYear() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  return year - (month < 4 ? 1 : 0);
}

// Update customer WhatsApp reminder preference.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be true or false." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, phone: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const normalizedPhone = customer.phone
  ? normalizePhone(customer.phone)
  : null;

if (body.enabled && !normalizedPhone) {
  return NextResponse.json(
    { error: "Add a valid mobile number before enabling reminders." },
    { status: 400 }
  );
}

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        whatsappDueRemindersOptIn: body.enabled,
        whatsappDueRemindersOptInAt: body.enabled
          ? new Date()
          : null,
      },
      select: {
        id: true,
        whatsappDueRemindersOptIn: true,
        whatsappDueRemindersOptInAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "WhatsApp reminder preference update failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to update WhatsApp reminder preference.",
      },
      { status: 500 }
    );
  }
}

// Send an immediate reminder to one opted-in customer.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {

  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    const yearValue = searchParams.get("year");
    const year = yearValue ? Number(yearValue) : undefined;

    if (
      year !== undefined &&
      (!Number.isInteger(year) || year < 2000 || year > 2200)
    ) {
      return NextResponse.json(
        { error: "Invalid financial year start." },
        { status: 400 }
      );
    }

    const financialYear = year ?? getCurrentFinancialYear();

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappDueRemindersOptIn: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    if (!customer.whatsappDueRemindersOptIn) {
      return NextResponse.json(
        {
          error: "Customer has not opted in to WhatsApp reminders.",
        },
        { status: 400 }
      );
    }

    if (!customer.phone) {
      return NextResponse.json(
        { error: "Customer phone number is missing." },
        { status: 400 }
      );
    }

    const customerPhone = normalizePhone(customer.phone);

    if (!customerPhone) {
      return NextResponse.json(
        { error: "Customer phone number is invalid." },
        { status: 400 }
      );
    }

    const ledgerBalance = await getCustomerLedgerBalance(
      customer.id,
      financialYear
    );

    const closingBalance = ledgerBalance.closingBalance;

    if (!Number.isFinite(closingBalance) || closingBalance <= 0) {
      return NextResponse.json(
        { error: "This customer has no pending balance." },
        { status: 400 }
      );
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = process.env.WHATSAPP_API_VERSION;

    const templateName =
      process.env.WHATSAPP_TEMPLATE_NAME || "swp_due_reminder";

    const language =
      process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

    if (!phoneNumberId || !accessToken || !apiVersion) {
      return NextResponse.json(
        {
          error: "WhatsApp API environment variables are missing.",
        },
        { status: 500 }
      );
    }

    // Use the India-local date for daily duplicate protection.
    const reminderDate = new Date(
      `${getIndiaDate()}T00:00:00.000Z`
    );

    // Create or retrieve today's reminder record.
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
        phone: customerPhone,
        pendingAmount: closingBalance,
        status: "PENDING",
      },
      update: {},
    });

    // Atomically claim the reminder.
    const claim = await prisma.customerDueReminderLog.updateMany({
      where: {
        id: log.id,
        status: { in: ["PENDING", "FAILED"] },
        attemptCount: { lt: MAX_ATTEMPTS },
      },
      data: {
        status: "PROCESSING",
        phone: customerPhone,
        pendingAmount: closingBalance,
        error: null,
        attemptedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    if (claim.count === 0) {
      return NextResponse.json(
        {
          error:
            log.status === "ACCEPTED"
              ? "A reminder has already been accepted for this customer today."
              : log.status === "PROCESSING"
                ? "A reminder is already being processed for this customer."
                : "Maximum reminder attempts reached for today.",
          status: log.status,
          attemptCount: log.attemptCount,
        },
        { status: 409 }
      );
    }
    let response: Response;

    try {
      response = await fetch(
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
            to: customerPhone,
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
                      text: closingBalance.toFixed(2),
                    },
                  ],
                },
              ],
            },
          }),
        }
      );
    } catch (error) {
      // Network failure may be ambiguous: Meta could have received
      // the message even if this server did not receive its response.
      await prisma.customerDueReminderLog.update({
        where: { id: log.id },
        data: {
          status: "UNKNOWN",
          error:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : "Unknown network error.",
        },
      });

      return NextResponse.json(
        {
          error:
            "The WhatsApp request outcome is unknown. Check the reminder log before retrying.",
          status: "UNKNOWN",
        },
        { status: 502 }
      );
    }

    const responseText = await response.text();

    let result: {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    } = {};

    try {
      result = JSON.parse(responseText);
    } catch {
      result = {};
    }

    if (!response.ok) {
  const errorMessage =
    result.error?.message ||
    `WhatsApp API rejected the request (${response.status}).`;

  const ambiguous = response.status >= 500;

  await prisma.customerDueReminderLog.update({
    where: { id: log.id },
    data: {
      status: ambiguous ? "UNKNOWN" : "FAILED",
      error: errorMessage.slice(0, 2000),
    },
  });

  console.error("WhatsApp API error:", {
    status: response.status,
    message: errorMessage,
  });

  return NextResponse.json(
    {
      error: ambiguous
        ? "WhatsApp outcome is uncertain. Check the reminder log before retrying."
        : errorMessage,
      status: ambiguous ? "UNKNOWN" : "FAILED",
    },
    { status: 502 }
  );
}

    const messageId = result.messages?.[0]?.id;

    if (!messageId) {
      await prisma.customerDueReminderLog.update({
        where: { id: log.id },
        data: {
          status: "UNKNOWN",
          error: "Meta response did not contain a WhatsApp message ID.",
        },
      });

      return NextResponse.json(
        {
          error:
            "Meta returned no message ID. Check the reminder log before retrying.",
          status: "UNKNOWN",
        },
        { status: 502 }
      );
    }

    // Meta accepted the message. This does not guarantee delivery.
    await prisma.customerDueReminderLog.update({
      where: { id: log.id },
      data: {
        status: "ACCEPTED",
        whatsappMessageId: messageId,
        sentAt: new Date(),
        error: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Reminder accepted by WhatsApp for ${customer.name}.`,
      status: "ACCEPTED",
      closingBalance,
      financialYear,
      messageId,
    });
  } catch (error) {
    console.error("Manual WhatsApp reminder failed:", error);

    // Do not automatically release a claimed log here.
    // The request may already have reached Meta.
    return NextResponse.json(
      { error: "Failed to send WhatsApp reminder." },
      { status: 500 }
    );
  }
}
