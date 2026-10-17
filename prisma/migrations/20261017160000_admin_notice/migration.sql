-- CreateTable
CREATE TABLE "AdminNotice" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "detail" TEXT,
    "byId" UUID,
    "byName" TEXT,
    "byRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "AdminNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotice_seenAt_idx" ON "AdminNotice"("seenAt");

-- CreateIndex
CREATE INDEX "AdminNotice_createdAt_idx" ON "AdminNotice"("createdAt");
