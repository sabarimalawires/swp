-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");
