-- CreateTable
CREATE TABLE "supplier_ledger_opening_balances" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "financialYearStart" DATE NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_ledger_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_ledger_opening_balances_financialYearStart_idx" ON "supplier_ledger_opening_balances"("financialYearStart");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_ledger_opening_balances_supplierId_financialYearSt_key" ON "supplier_ledger_opening_balances"("supplierId", "financialYearStart");

-- AddForeignKey
ALTER TABLE "supplier_ledger_opening_balances" ADD CONSTRAINT "supplier_ledger_opening_balances_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
