
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION;
const TEMPLATE_NAME =
  process.env.WHATSAPP_AUTO_REPLY_TEMPLATE_NAME ||
  "swp_customer_auto_reply";
const TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_AUTO_REPLY_TEMPLATE_LANGUAGE || "en";

// Meta webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Verify that the POST request genuinely came from Meta
function verifySignature(body: string, signature: string | null) {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret || !signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret)
    .update(body)
    .digest();

  let received: Buffer;

  try {
    received = Buffer.from(signature.slice(7), "hex");
  } catch {
    return false;
  }

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

// Send the approved automatic reply template
async function sendAutoReply(phone: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken || !GRAPH_API_VERSION) {
    throw new Error("WhatsApp API environment variables are missing.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
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
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANGUAGE },
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "WhatsApp API rejected the reply."
    );
  }

  const replyMessageId = result?.messages?.[0]?.id;

  if (!replyMessageId) {
    throw new Error("WhatsApp did not return a reply message ID.");
  }

  return replyMessageId as string;
}

// Receive incoming WhatsApp messages
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (
    !verifySignature(
      rawBody,
      request.headers.get("x-hub-signature-256")
    )
  ) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  if (payload?.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true });
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      if (!value?.messages?.length) continue;

      // Only handle events for our configured WhatsApp number.
      if (value.metadata?.phone_number_id !== phoneNumberId) {
        continue;
      }

      for (const message of value.messages) {
        const incomingMessageId = message.id;
        const senderPhone = message.from;

        if (!incomingMessageId || !senderPhone) continue;

        // Claim this incoming message exactly once.
        try {
          await prisma.whatsAppWebhookEvent.create({
            data: {
              whatsappMessageId: incomingMessageId,
              fromPhone: senderPhone,
              status: "PROCESSING",
            },
          });
        } catch (error: any) {
          // A duplicate Meta webhook delivery is ignored.
          if (error?.code === "P2002") continue;
          throw error;
        }

        try {
          const replyMessageId = await sendAutoReply(senderPhone);

          await prisma.whatsAppWebhookEvent.update({
            where: { whatsappMessageId: incomingMessageId },
            data: {
              status: "ACCEPTED",
              replyMessageId,
              error: null,
            },
          });
        } catch (error) {
          console.error(
            "WhatsApp automatic reply failed:",
            error
          );

          await prisma.whatsAppWebhookEvent.update({
            where: { whatsappMessageId: incomingMessageId },
            data: {
              status: "FAILED",
              error:
                error instanceof Error
                  ? error.message.slice(0, 2000)
                  : "Automatic reply failed.",
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
