-- CreateTable
CREATE TABLE "SmsSendLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "purpose" TEXT NOT NULL,
    "toMasked" TEXT NOT NULL,
    "characters" INTEGER NOT NULL,
    "encoding" TEXT NOT NULL,
    "pages" INTEGER NOT NULL,
    "unitsBilled" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL,
    "providerRef" TEXT,
    "providerBalanceAfter" DOUBLE PRECISION,
    "costNaira" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsSendLog_createdAt_idx" ON "SmsSendLog"("createdAt");

-- CreateIndex
CREATE INDEX "SmsSendLog_tenantId_createdAt_idx" ON "SmsSendLog"("tenantId", "createdAt");
