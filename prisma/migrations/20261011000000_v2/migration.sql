-- V2 (plan doc 10 Oct 2026). Existing data is carried over:
-- lead statuses become the 4 categories, trial boxes become one-date trials,
-- paused packages become active packages on a paused customer.

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('DELIVERED', 'ABSENT', 'NOT_DELIVERED');

-- CreateEnum
CREATE TYPE "MoneyType" AS ENUM ('PURCHASE', 'EXPENSE');

-- Lead: new fields
ALTER TABLE "Lead" RENAME COLUMN "foodNotes" TO "avoidFoods";
ALTER TABLE "Lead" ADD COLUMN     "customerStatus" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "deliveryTime" TEXT,
ADD COLUMN     "dob" DATE,
ADD COLUMN     "healthNotes" TEXT,
ADD COLUMN     "notInterestedReason" TEXT,
ADD COLUMN     "pausedUntil" DATE;

-- A paused package becomes an active package on a paused customer
UPDATE "Lead" l SET "customerStatus" = 'PAUSED' FROM "Package" p WHERE p."leadId" = l."id" AND p."status" = 'PAUSED';

-- Lead source: Instagram becomes Insta DM, sources no longer used become Other
CREATE TYPE "LeadSource_new" AS ENUM ('WHATSAPP', 'INSTA_DM', 'INSTA_COMMENT', 'GBM', 'CALL', 'OTHER');
ALTER TABLE "Lead" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "source" TYPE "LeadSource_new" USING (
  CASE "source"::text
    WHEN 'CALL' THEN 'CALL'
    WHEN 'WHATSAPP' THEN 'WHATSAPP'
    WHEN 'INSTAGRAM' THEN 'INSTA_DM'
    ELSE 'OTHER'
  END::"LeadSource_new");
ALTER TYPE "LeadSource" RENAME TO "LeadSource_old";
ALTER TYPE "LeadSource_new" RENAME TO "LeadSource";
DROP TYPE "LeadSource_old";
ALTER TABLE "Lead" ALTER COLUMN "source" SET DEFAULT 'CALL';

-- Lead status: 8 statuses become the 4 categories
CREATE TYPE "LeadStatus_new" AS ENUM ('FOLLOW_UP', 'TRIAL', 'MONTHLY', 'NOT_INTERESTED');
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE "status"::text
    WHEN 'TRIAL_REQUESTED' THEN 'TRIAL'
    WHEN 'TRIAL_ACTIVE' THEN 'TRIAL'
    WHEN 'CONVERTED' THEN 'MONTHLY'
    WHEN 'NOT_INTERESTED' THEN 'NOT_INTERESTED'
    WHEN 'LOST' THEN 'NOT_INTERESTED'
    ELSE 'FOLLOW_UP'
  END::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "LeadStatus_old";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'FOLLOW_UP';

-- Package: new fields, no paused status
ALTER TABLE "Package" ADD COLUMN     "buttermilkPrice" INTEGER NOT NULL DEFAULT 299,
ADD COLUMN     "buttermilkQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 3430,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reportNote" TEXT,
ALTER COLUMN "packageType" SET DEFAULT 'Monthly package';

CREATE TYPE "PackageStatus_new" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Package" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Package" ALTER COLUMN "status" TYPE "PackageStatus_new" USING (
  CASE "status"::text WHEN 'PAUSED' THEN 'ACTIVE' ELSE "status"::text END::"PackageStatus_new");
ALTER TYPE "PackageStatus" RENAME TO "PackageStatus_old";
ALTER TYPE "PackageStatus_new" RENAME TO "PackageStatus";
DROP TYPE "PackageStatus_old";
ALTER TABLE "Package" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- TrialBox: one delivery date, no kitchen assignee
ALTER TABLE "TrialBox" DROP CONSTRAINT "TrialBox_assignedToId_fkey";
ALTER TABLE "TrialBox" RENAME COLUMN "startDate" TO "deliveryDate";
ALTER TABLE "TrialBox" DROP COLUMN "assignedToId",
DROP COLUMN "endDate",
ADD COLUMN     "boxNo" INTEGER,
ADD COLUMN     "boxReturned" BOOLEAN,
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "slot" TEXT;
UPDATE "TrialBox" t SET "slot" = l."slot" FROM "Lead" l WHERE l."id" = t."leadId";

CREATE TYPE "TrialStatus_new" AS ENUM ('BOOKED', 'DELIVERED', 'DONE');
ALTER TABLE "TrialBox" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TrialBox" ALTER COLUMN "status" TYPE "TrialStatus_new" USING (
  CASE "status"::text
    WHEN 'DELIVERED' THEN 'DELIVERED'
    WHEN 'TRIAL_ACTIVE' THEN 'DELIVERED'
    WHEN 'COMPLETED' THEN 'DONE'
    ELSE 'BOOKED'
  END::"TrialStatus_new");
ALTER TYPE "TrialStatus" RENAME TO "TrialStatus_old";
ALTER TYPE "TrialStatus_new" RENAME TO "TrialStatus";
DROP TYPE "TrialStatus_old";
ALTER TABLE "TrialBox" ALTER COLUMN "status" SET DEFAULT 'BOOKED';

CREATE TYPE "TrialResult_new" AS ENUM ('MONTHLY', 'FOLLOW_UP', 'NOT_INTERESTED');
ALTER TABLE "TrialBox" ALTER COLUMN "result" TYPE "TrialResult_new" USING (
  CASE "result"::text
    WHEN 'CONVERTED' THEN 'MONTHLY'
    WHEN 'NOT_CONVERTED' THEN 'FOLLOW_UP'
  END::"TrialResult_new");
ALTER TYPE "TrialResult" RENAME TO "TrialResult_old";
ALTER TYPE "TrialResult_new" RENAME TO "TrialResult";
DROP TYPE "TrialResult_old";

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "leadId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "buttermilk" BOOLEAN NOT NULL DEFAULT false,
    "boxBack" BOOLEAN,
    "remarks" TEXT,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AltBox" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "boxNo" INTEGER NOT NULL,
    "givenOn" DATE NOT NULL,
    "collectedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AltBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCall" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "dayNo" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "renewal" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "fruits" TEXT NOT NULL,
    "salad" TEXT,
    "swapFruits" TEXT NOT NULL,
    "note" TEXT,
    "byId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "fruit" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "qtyKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wastage" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "fruit" TEXT NOT NULL,
    "cutKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wasteKg" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wastage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyEntry" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "MoneyType" NOT NULL,
    "item" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" TEXT,
    "amount" INTEGER NOT NULL,
    "paidTo" TEXT,
    "billId" UUID,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_leadId_date_key" ON "Attendance"("leadId", "date");

-- CreateIndex
CREATE INDEX "AltBox_collectedOn_idx" ON "AltBox"("collectedOn");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCall_packageId_dayNo_key" ON "CustomerCall"("packageId", "dayNo");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_date_key" ON "Menu"("date");

-- CreateIndex
CREATE INDEX "StockEntry_date_idx" ON "StockEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Wastage_date_fruit_key" ON "Wastage"("date", "fruit");

-- CreateIndex
CREATE INDEX "MoneyEntry_date_idx" ON "MoneyEntry"("date");

-- CreateIndex
CREATE INDEX "TrialBox_deliveryDate_idx" ON "TrialBox"("deliveryDate");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltBox" ADD CONSTRAINT "AltBox_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCall" ADD CONSTRAINT "CustomerCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCall" ADD CONSTRAINT "CustomerCall_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

