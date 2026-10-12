
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "sheetOrder" INTEGER;

-- CreateTable
CREATE TABLE "Issue" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "department" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "responsible" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "followUp" TEXT,
    "remarks" TEXT,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDay" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "idCard" BOOLEAN,
    "uniform" BOOLEAN,
    "onTimePickup" BOOLEAN,
    "inTime" TEXT,
    "outTime" TEXT,
    "startKm" INTEGER,
    "endKm" INTEGER,
    "remarks" TEXT,
    "byId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Due" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "repeatMonthly" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Due_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Issue_date_idx" ON "Issue"("date");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "StaffDay_date_idx" ON "StaffDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDay_staffId_date_key" ON "StaffDay"("staffId", "date");

-- CreateIndex
CREATE INDEX "Due_dueDate_idx" ON "Due"("dueDate");

-- AddForeignKey
ALTER TABLE "StaffDay" ADD CONSTRAINT "StaffDay_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
