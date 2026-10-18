-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'CUSTOMER_LEDGER_OPENING_BALANCE';

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(14,6) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "deductedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing sales as single-item sales.
-- Historical rates are reconstructed from amount / weight because
-- the old Sale model did not store the original rate.
INSERT INTO "SaleItem" (
    "id",
    "saleId",
    "productId",
    "productName",
    "quantity",
    "weight",
    "rate",
    "amount",
    "deductedQuantity"
)
SELECT
    'legacy_sale_item_' || s."id",
    s."id",
    s."productId",
    p."name",
    s."quantity",
    s."weight",
    CASE
        WHEN s."weight" > 0
        THEN ROUND(s."amount" / s."weight", 6)
        ELSE 0
    END,
    s."amount",
    COALESCE((
    SELECT SUM(it."quantity")::INTEGER
    FROM "InventoryTransaction" it
    WHERE it."saleId" = s."id"
      AND it."type" = 'SALE'
), 0)
FROM "Sale" s
JOIN "Product" p ON p."id" = s."productId";