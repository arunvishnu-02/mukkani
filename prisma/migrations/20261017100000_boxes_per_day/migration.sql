-- AlterTable
ALTER TABLE "Package" ADD COLUMN "boxesPerDay" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "boxes" INTEGER;
