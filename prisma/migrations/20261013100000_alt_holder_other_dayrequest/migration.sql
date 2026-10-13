-- AlterTable
ALTER TABLE "AltBox" ADD COLUMN     "holder" TEXT,
ALTER COLUMN "leadId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "sourceOther" TEXT;

-- CreateTable
CREATE TABLE "DayRequest" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "userId" UUID NOT NULL,
    "area" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DayRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayRequest_status_idx" ON "DayRequest"("status");

-- CreateIndex
CREATE INDEX "DayRequest_userId_date_idx" ON "DayRequest"("userId", "date");

