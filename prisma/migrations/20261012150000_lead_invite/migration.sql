-- CreateTable
CREATE TABLE "LeadInvite" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "filledAt" TIMESTAMP(3),
    "leadId" UUID,

    CONSTRAINT "LeadInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadInvite_token_key" ON "LeadInvite"("token");

-- CreateIndex
CREATE INDEX "LeadInvite_createdAt_idx" ON "LeadInvite"("createdAt");

