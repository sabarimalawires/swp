ALTER TABLE "Customer"
ADD COLUMN "whatsappDueRemindersOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappDueRemindersOptInAt" TIMESTAMP(3);

CREATE TABLE "customer_due_reminder_logs" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reminderDate" DATE NOT NULL,
    "phone" TEXT NOT NULL,
    "pendingAmount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "whatsappMessageId" TEXT,
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_due_reminder_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_due_reminder_logs_customerId_reminderDate_key"
ON "customer_due_reminder_logs"("customerId", "reminderDate");

CREATE INDEX "customer_due_reminder_logs_reminderDate_status_idx"
ON "customer_due_reminder_logs"("reminderDate", "status");

CREATE INDEX "customer_due_reminder_logs_customerId_createdAt_idx"
ON "customer_due_reminder_logs"("customerId", "createdAt");

ALTER TABLE "customer_due_reminder_logs"
ADD CONSTRAINT "customer_due_reminder_logs_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
