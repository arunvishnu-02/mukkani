-- CreateTable
CREATE TABLE "BoxPlan" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "boxes" INTEGER NOT NULL,
    "byId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoxPlan_date_idx" ON "BoxPlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BoxPlan_leadId_date_key" ON "BoxPlan"("leadId", "date");

-- AddForeignKey
ALTER TABLE "BoxPlan" ADD CONSTRAINT "BoxPlan_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
