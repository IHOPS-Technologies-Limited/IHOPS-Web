-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('active', 'inactive', 'deceased');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "status" "PatientStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "calledAt" TIMESTAMP(3);
