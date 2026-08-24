/*
  Safe migration:
  - Preserve existing Sale.customerName values
  - Create Customer records from existing sales
  - Connect existing sales to those customers
  - Add weight and amount with temporary NULL values
  - Fill existing test sales with 0 values
  - Make new fields required
  - Remove the old customerName column
  - Add CustomerPayment support
*/

-- ============================================================
-- AUDIT ENUM
-- ============================================================

ALTER TYPE "AuditEntityType" ADD VALUE 'CUSTOMER';
ALTER TYPE "AuditEntityType" ADD VALUE 'CUSTOMER_PAYMENT';


-- ============================================================
-- CREATE CUSTOMER TABLE
-- ============================================================

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);


-- ============================================================
-- CREATE CUSTOMER INDEX
-- ============================================================

CREATE INDEX "Customer_name_idx"
ON "Customer"("name");


-- ============================================================
-- CREATE CUSTOMERS FROM EXISTING SALES
-- ============================================================

INSERT INTO "Customer" ("id", "name", "createdAt", "updatedAt")
SELECT
    'customer_' || ROW_NUMBER() OVER (ORDER BY "customerName"),
    "customerName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "customerName"
    FROM "Sale"
    WHERE "customerName" IS NOT NULL
) AS existing_customers;


-- ============================================================
-- TEMPORARILY ADD NEW SALE COLUMNS AS NULLABLE
-- ============================================================

ALTER TABLE "Sale"
ADD COLUMN "customerId" TEXT,
ADD COLUMN "weight" DECIMAL(12,3),
ADD COLUMN "amount" DECIMAL(14,2);


-- ============================================================
-- CONNECT EXISTING SALES TO CUSTOMERS
-- ============================================================

UPDATE "Sale" AS s
SET "customerId" = c."id"
FROM "Customer" AS c
WHERE c."name" = s."customerName";


-- ============================================================
-- FILL EXISTING SALES WITH SAFE VALUES
--
-- These existing records are test sales and currently have
-- no weight or amount in the old schema.
-- ============================================================

UPDATE "Sale"
SET
    "weight" = 0,
    "amount" = 0
WHERE "weight" IS NULL
   OR "amount" IS NULL;


-- ============================================================
-- MAKE NEW SALE FIELDS REQUIRED
-- ============================================================

ALTER TABLE "Sale"
ALTER COLUMN "customerId" SET NOT NULL,
ALTER COLUMN "weight" SET NOT NULL,
ALTER COLUMN "amount" SET NOT NULL;


-- ============================================================
-- REMOVE OLD CUSTOMER NAME COLUMN
-- ============================================================

ALTER TABLE "Sale"
DROP COLUMN "customerName";


-- ============================================================
-- CREATE CUSTOMER PAYMENT TABLE
-- ============================================================

CREATE TABLE "CustomerPayment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);


-- ============================================================
-- CUSTOMER PAYMENT INDEXES
-- ============================================================

CREATE INDEX "CustomerPayment_customerId_idx"
ON "CustomerPayment"("customerId");

CREATE INDEX "CustomerPayment_saleId_idx"
ON "CustomerPayment"("saleId");

CREATE INDEX "CustomerPayment_paymentDate_idx"
ON "CustomerPayment"("paymentDate");

CREATE INDEX "CustomerPayment_createdById_idx"
ON "CustomerPayment"("createdById");


-- ============================================================
-- SALE CUSTOMER INDEX
-- ============================================================

CREATE INDEX "Sale_customerId_idx"
ON "Sale"("customerId");


-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_customerId_fkey"
FOREIGN KEY ("customerId")
REFERENCES "Customer"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


ALTER TABLE "CustomerPayment"
ADD CONSTRAINT "CustomerPayment_customerId_fkey"
FOREIGN KEY ("customerId")
REFERENCES "Customer"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


ALTER TABLE "CustomerPayment"
ADD CONSTRAINT "CustomerPayment_saleId_fkey"
FOREIGN KEY ("saleId")
REFERENCES "Sale"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;


ALTER TABLE "CustomerPayment"
ADD CONSTRAINT "CustomerPayment_createdById_fkey"
FOREIGN KEY ("createdById")
REFERENCES "Employee"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;