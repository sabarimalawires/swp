-- CreateTable
CREATE TABLE "customer_ledger_opening_balances" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "financialYearStart" DATE NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_ledger_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_ledger_opening_balances_financialYearStart_idx" ON "customer_ledger_opening_balances"("financialYearStart");

-- CreateIndex
CREATE UNIQUE INDEX "customer_ledger_opening_balances_customerId_financialYearSt_key" ON "customer_ledger_opening_balances"("customerId", "financialYearStart");

-- AddForeignKey
ALTER TABLE "customer_ledger_opening_balances" ADD CONSTRAINT "customer_ledger_opening_balances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
