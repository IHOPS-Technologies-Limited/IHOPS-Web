-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "superAdminId" TEXT;

-- CreateIndex
CREATE INDEX "Staff_passwordResetTokenHash_idx" ON "Staff"("passwordResetTokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_superAdminId_createdAt_idx" ON "AuditLog"("superAdminId", "createdAt");
