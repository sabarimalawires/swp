CREATE TYPE "SalesUnit" AS ENUM ('KGS', 'SQ_FT', 'R_FT', 'R_MTR');


ALTER TABLE "SaleItem"
ADD COLUMN "salesMeasurement" DECIMAL(12,3),
ADD COLUMN "salesUnit" "SalesUnit" NOT NULL DEFAULT 'KGS';

UPDATE "SaleItem"
SET "salesMeasurement" = "weight";

ALTER TABLE "SaleItem"
ALTER COLUMN "salesMeasurement" SET NOT NULL,
ALTER COLUMN "salesMeasurement" SET DEFAULT 0;
