
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION;
const TEMPLATE_NAME =
  process.env.WHATSAPP_AUTO_REPLY_TEMPLATE_NAME ||
  "swp_customer_auto_reply";
const TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_AUTO_REPLY_TEMPLATE_LANGUAGE || "en";

// Verify Meta webhook subscription
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

// Verify Meta request signature
function verifySignature(body: string, signature: string | null) {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret || !signature?.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signature.slice(7);

  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) {
    return false;
  }

  const expected = createHmac("sha256", appSecret)
    .update(body)
    .digest();

  const received = Buffer.from(receivedHex, "hex");

  return timingSafeEqual(received, expected);
}

// Send automatic WhatsApp template reply
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

  return result?.messages?.[0]?.id;
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

  const configuredPhoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      if (!value?.messages?.length) continue;

      // Only process messages sent to our SWP WhatsApp number.
      if (
        value.metadata?.phone_number_id !==
        configuredPhoneNumberId
      ) {
        continue;
      }

      for (const message of value.messages) {
        const senderPhone = message.from;

        if (!message.id || !senderPhone) continue;

        try {
          await sendAutoReply(senderPhone);
          console.log("WhatsApp automatic reply accepted.");
        } catch (error) {
          console.error(
            "WhatsApp automatic reply failed:",
            error
          );
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
