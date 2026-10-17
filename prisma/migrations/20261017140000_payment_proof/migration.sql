-- AlterTable
ALTER TABLE "Package" ADD COLUMN "paymentProofIds" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN "paymentNote" TEXT;
