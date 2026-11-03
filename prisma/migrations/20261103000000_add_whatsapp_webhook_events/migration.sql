CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "whatsappMessageId" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "replyMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_webhook_events_whatsappMessageId_key"
ON "whatsapp_webhook_events"("whatsappMessageId");

CREATE INDEX "whatsapp_webhook_events_createdAt_idx"
ON "whatsapp_webhook_events"("createdAt");
