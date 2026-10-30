
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

function normalizePhone(value: string): string | null {
  let phone = value.replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(phone)) {
    phone = `91${phone}`;
  }

  return /^[1-9]\d{7,14}$/.test(phone) ? phone : null;
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

    if (body.enabled && !customer.phone) {
      return NextResponse.json(
        {
          error:
            "Add a phone number before enabling reminders.",
        },
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
        error:
          "Failed to update WhatsApp reminder preference.",
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

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappDueRemindersOptIn: true,
        sales: {
          where: { status: "ACTIVE" },
          select: { amount: true },
        },
        payments: {
          select: { amount: true },
        },
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
          error:
            "Customer has not opted in to WhatsApp reminders.",
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

    const totalPurchases = customer.sales.reduce(
      (sum, sale) => sum + Number(sale.amount),
      0
    );

    const totalPaid = customer.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const netBalance = totalPurchases - totalPaid;
    const pendingBalance = Math.max(0, netBalance);

    if (pendingBalance <= 0) {
      return NextResponse.json(
        { error: "This customer has no pending balance." },
        { status: 400 }
      );
    }

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion =
      process.env.WHATSAPP_API_VERSION;

    const templateName =
      process.env.WHATSAPP_TEMPLATE_NAME ||
      "swp_due_reminder";

    const language =
      process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

    if (!phoneNumberId || !accessToken || !apiVersion) {
      return NextResponse.json(
        {
          error:
            "WhatsApp API environment variables are missing.",
        },
        { status: 500 }
      );
    }

    // Redirect all outgoing messages to the test number
    // whenever test mode is enabled.
    const testMode =
      process.env.WHATSAPP_TEST_MODE === "true";

    const recipient = testMode
      ? normalizePhone(
          process.env.WHATSAPP_TEST_RECIPIENT || ""
        )
      : customerPhone;

    if (!recipient) {
      return NextResponse.json(
        {
          error:
            "Invalid WhatsApp recipient or test number.",
        },
        { status: 400 }
      );
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
                    text: pendingBalance.toFixed(2),
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
      console.error(
        "WhatsApp API rejected manual reminder:",
        result
      );

      return NextResponse.json(
        {
          error:
            result?.error?.message ||
            "WhatsApp could not accept the reminder.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: testMode
        ? "Test reminder accepted by WhatsApp."
        : `Reminder accepted by WhatsApp for ${customer.name}.`,
      pendingBalance,
      testMode,
      messageId: result?.messages?.[0]?.id ?? null,
    });
  } catch (error) {
    console.error(
      "Manual WhatsApp reminder failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to send WhatsApp reminder." },
      { status: 500 }
    );
  }
}
