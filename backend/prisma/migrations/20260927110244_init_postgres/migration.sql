-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('pending_verification', 'pending_approval', 'active', 'trialing', 'grace_period', 'suspended', 'rejected');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('starter', 'standard', 'public_hospital');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual', 'none');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('administrator', 'doctor', 'receptionist', 'finance_officer', 'nurse');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "PreferredChannel" AS ENUM ('whatsapp', 'sms', 'email');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('waiting', 'in_consultation', 'closed');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('none', 'return_in_days', 'recurring');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'partially_paid', 'not_paid', 'covered_by_insurance');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'transfer', 'pos', 'other');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('whatsapp', 'sms', 'email');

-- CreateEnum
CREATE TYPE "CommStatus" AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "CommTrigger" AS ENUM ('ai_followup', 'birthday', 'manual', 'system', 'ai_restricted');

-- CreateEnum
CREATE TYPE "SmsWalletTxnType" AS ENUM ('topup', 'debit', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "SmsWalletTxnStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "ClinicalNoteStatus" AS ENUM ('draft', 'finalized');

-- CreateEnum
CREATE TYPE "CommunicationPayloadStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "hospitalType" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nearestLandmark" TEXT,
    "postalCode" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'pending_verification',
    "publicHospitalRequested" BOOLEAN NOT NULL DEFAULT false,
    "supportingDocumentUrl" TEXT,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "setupWizardCompleted" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "workingHours" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "birthdayMessagesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "restrictedAiMode" TEXT NOT NULL DEFAULT 'review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planCode" "PlanCode" NOT NULL DEFAULT 'starter',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "paystackCustomerCode" TEXT,
    "paystackSubscriptionCode" TEXT,
    "paystackPlanCode" TEXT,
    "publicHospitalApprovalStatus" TEXT,
    "approvedBySuperAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL,
    "paystackReference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffIdDisplay" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "departmentId" TEXT,
    "role" "StaffRole" NOT NULL,
    "pinHash" TEXT NOT NULL,
    "mustChangePin" BOOLEAN NOT NULL DEFAULT true,
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "status" "StaffStatus" NOT NULL DEFAULT 'active',
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "familyIdDisplay" TEXT NOT NULL,
    "primaryContactPatientId" TEXT,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platformPatientId" TEXT NOT NULL,
    "hospitalCardNumber" TEXT,
    "familyId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gender" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "emergencyContact" TEXT NOT NULL,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "preferredChannel" "PreferredChannel" NOT NULL,
    "administrativeNotes" TEXT,
    "species" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "departmentId" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'waiting',
    "treatmentNote" TEXT,
    "followUpType" "FollowUpType" NOT NULL DEFAULT 'none',
    "followUpInDays" INTEGER,
    "recurringEveryDays" INTEGER,
    "recurringCount" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "method" "PaymentMethod",
    "insuranceProvider" TEXT,
    "expectedInsuranceAmount" DOUBLE PRECISION,
    "insuranceReconciledAmount" DOUBLE PRECISION,
    "insuranceReconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recordedByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "hoursWorked" DOUBLE PRECISION,
    "isAbsentFlagged" BOOLEAN NOT NULL DEFAULT false,
    "correctedBy" TEXT,
    "correctionNote" TEXT,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "trigger" "CommTrigger" NOT NULL DEFAULT 'manual',
    "channel" "CommChannel" NOT NULL,
    "messageBody" TEXT NOT NULL,
    "status" "CommStatus" NOT NULL DEFAULT 'queued',
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadId" TEXT,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsWallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "balanceUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsWalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "SmsWalletTxnType" NOT NULL,
    "units" INTEGER NOT NULL,
    "amountKobo" INTEGER,
    "status" "SmsWalletTxnStatus" NOT NULL DEFAULT 'success',
    "packageKey" TEXT,
    "paystackReference" TEXT,
    "communicationLogId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "raisedByStaffId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "assignedSuperAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetSegment" TEXT NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdBySuperAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "staffId" TEXT,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "clinicianRole" TEXT NOT NULL,
    "status" "ClinicalNoteStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "chiefComplaint" TEXT,
    "symptomsReported" TEXT,
    "complaintDuration" TEXT,
    "complaintNotes" TEXT,
    "temperature" DOUBLE PRECISION,
    "bloodPressure" TEXT,
    "pulse" DOUBLE PRECISION,
    "respiratoryRate" DOUBLE PRECISION,
    "oxygenSaturation" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "observationNotes" TEXT,
    "diagnosisPrimary" TEXT,
    "diagnosisSecondary" TEXT,
    "diagnosisDifferential" TEXT,
    "diagnosisNotes" TEXT,
    "noKnownAllergies" BOOLEAN NOT NULL DEFAULT false,
    "allergiesJson" TEXT,
    "medicalHistoryJson" TEXT,
    "medicationHistoryJson" TEXT,
    "prescriptionJson" TEXT,
    "investigationsJson" TEXT,
    "imagingJson" TEXT,
    "treatmentPlan" TEXT,
    "treatmentDuration" TEXT,
    "treatmentFrequency" TEXT,
    "treatmentRoute" TEXT,
    "nextTreatmentDate" TIMESTAMP(3),
    "treatmentTimeOfDay" TEXT,
    "treatmentInstructions" TEXT,
    "treatmentNotes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpType" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpExpectedTime" TEXT,
    "followUpDurationOption" TEXT,
    "followUpFrequencyOption" TEXT,
    "communicationChannelOverride" TEXT,
    "approvedCommunicationInstruction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clinicalNoteId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedByStaffId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPayload" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clinicalNoteId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "guardianName" TEXT,
    "preferredChannel" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "hospitalType" TEXT NOT NULL,
    "species" TEXT,
    "approvedInstruction" TEXT NOT NULL,
    "followUpType" TEXT,
    "followUpDate" TIMESTAMP(3),
    "mode" TEXT NOT NULL,
    "status" "CommunicationPayloadStatus" NOT NULL DEFAULT 'pending_review',
    "generatedMessage" TEXT,
    "approvedByStaffId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientRecordRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestingTenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consentStatus" TEXT NOT NULL DEFAULT 'not_requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientRecordRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_tenantId_staffIdDisplay_key" ON "Staff"("tenantId", "staffIdDisplay");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_tenantId_email_key" ON "Staff"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Family_tenantId_familyIdDisplay_key" ON "Family"("tenantId", "familyIdDisplay");

-- CreateIndex
CREATE INDEX "Patient_tenantId_name_idx" ON "Patient"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Patient_tenantId_phone_idx" ON "Patient"("tenantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_tenantId_platformPatientId_key" ON "Patient"("tenantId", "platformPatientId");

-- CreateIndex
CREATE INDEX "Visit_tenantId_status_idx" ON "Visit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Visit_tenantId_patientId_idx" ON "Visit"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_visitId_key" ON "Payment"("visitId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Attendance_tenantId_date_idx" ON "Attendance"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Attendance_tenantId_staffId_idx" ON "Attendance"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "CommunicationLog_tenantId_patientId_idx" ON "CommunicationLog"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "CommunicationLog_tenantId_createdAt_idx" ON "CommunicationLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsWallet_tenantId_key" ON "SmsWallet"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsWalletTransaction_paystackReference_key" ON "SmsWalletTransaction"("paystackReference");

-- CreateIndex
CREATE INDEX "SmsWalletTransaction_walletId_createdAt_idx" ON "SmsWalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNote_previousVersionId_key" ON "ClinicalNote"("previousVersionId");

-- CreateIndex
CREATE INDEX "ClinicalNote_tenantId_patientId_isCurrent_idx" ON "ClinicalNote"("tenantId", "patientId", "isCurrent");

-- CreateIndex
CREATE INDEX "ClinicalNote_tenantId_visitId_idx" ON "ClinicalNote"("tenantId", "visitId");

-- CreateIndex
CREATE INDEX "ClinicalDocument_tenantId_patientId_idx" ON "ClinicalDocument"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPayload_clinicalNoteId_key" ON "CommunicationPayload"("clinicalNoteId");

-- CreateIndex
CREATE INDEX "CommunicationPayload_tenantId_status_idx" ON "CommunicationPayload"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedByStaffId_fkey" FOREIGN KEY ("recordedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsWallet" ADD CONSTRAINT "SmsWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsWalletTransaction" ADD CONSTRAINT "SmsWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SmsWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_raisedByStaffId_fkey" FOREIGN KEY ("raisedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPayload" ADD CONSTRAINT "CommunicationPayload_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRecordRequest" ADD CONSTRAINT "PatientRecordRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
