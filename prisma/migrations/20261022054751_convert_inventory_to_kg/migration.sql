
-- Add kilogram-based inventory columns.
-- Existing piece-based stock values are intentionally not converted.

ALTER TABLE "InventoryTransaction"
ADD COLUMN "weight" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "Product"
ADD COLUMN "initialStockKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN "lowStockThresholdKg" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "SaleItem"
ADD COLUMN "deductedWeight" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "WorkEntry"
ADD COLUMN "weight" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "WorkEntryVersion"
ADD COLUMN "weight" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- Remove old piece-based stock columns only after the new columns exist.
ALTER TABLE "Product"
DROP COLUMN "initialStock",
DROP COLUMN "lowStockThreshold";
