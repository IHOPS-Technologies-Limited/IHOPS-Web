import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding IHOPS demo data...");

  // --- Super Admin ---
  await prisma.superAdmin.upsert({
    where: { email: "superadmin@ihops.africa" },
    update: {},
    create: { name: "IHOPS Platform Team", email: "superadmin@ihops.africa", passwordHash: await bcrypt.hash("SuperAdmin!23", 10) },
  });

  // --- Demo tenant: Grace Family Clinic (Starter, active) ---
  const tenant = await prisma.tenant.upsert({
    where: { email: "admin@gracefamilyclinic.ng" },
    update: {},
    create: {
      hospitalName: "Grace Family Clinic",
      hospitalType: "Private Clinic",
      contactPerson: "Dr. Blessing Adeyemi",
      email: "admin@gracefamilyclinic.ng",
      phone: "+2348012345678",
      state: "Lagos",
      lga: "Ikeja",
      address: "12 Awolowo Road, Ikeja",
      status: "active",
      setupWizardCompleted: true,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, planCode: "starter", billingCycle: "monthly", status: "active" },
  });

  const reception = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "General Reception" } },
    update: {},
    create: { tenantId: tenant.id, name: "General Reception" },
  });

  const pinHash = await bcrypt.hash("1234", 10);
  const adminPasswordHash = await bcrypt.hash("Password!23", 10);

  const admin = await prisma.staff.upsert({
    where: { tenantId_staffIdDisplay: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0001" } },
    update: {},
    create: {
      tenantId: tenant.id, staffIdDisplay: "IHOPS-0001", name: "Dr. Blessing Adeyemi",
      email: "admin@gracefamilyclinic.ng", role: "administrator", pinHash, passwordHash: adminPasswordHash,
      mustChangePin: false, departmentId: reception.id,
    },
  });

  const doctor = await prisma.staff.upsert({
    where: { tenantId_staffIdDisplay: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0002" } },
    update: {},
    create: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0002", name: "Dr. Chinedu Okafor", role: "doctor", pinHash, mustChangePin: false, departmentId: reception.id },
  });

  await prisma.staff.upsert({
    where: { tenantId_staffIdDisplay: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0003" } },
    update: {},
    create: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0003", name: "Ngozi Umeh", role: "receptionist", pinHash, mustChangePin: false, departmentId: reception.id },
  });

  await prisma.staff.upsert({
    where: { tenantId_staffIdDisplay: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0004" } },
    update: {},
    create: { tenantId: tenant.id, staffIdDisplay: "IHOPS-0004", name: "Amaka Nwosu", role: "finance_officer", pinHash, mustChangePin: false },
  });

  const existingPatient = await prisma.patient.findFirst({ where: { tenantId: tenant.id, platformPatientId: "PT-000001" } });
  if (!existingPatient) {
    const patient = await prisma.patient.create({
      data: {
        tenantId: tenant.id, platformPatientId: "PT-000001", hospitalCardNumber: "GFC-0091",
        name: "Ade Bello", phone: "+2348098765432", gender: "Male", dob: new Date("1990-05-14"),
        address: "5 Allen Avenue, Ikeja", emergencyContact: "+2348011122233", preferredChannel: "sms",
      },
    });
    const visit = await prisma.visit.create({
      data: {
        tenantId: tenant.id, patientId: patient.id, doctorId: doctor.id, departmentId: reception.id,
        status: "closed", treatmentNote: "Malaria treatment administered", followUpType: "return_in_days", followUpInDays: 3,
        closedAt: new Date(),
      },
    });
    await prisma.payment.create({ data: { tenantId: tenant.id, visitId: visit.id, status: "paid", amount: 12000, method: "cash" } });
  }

  // --- Pending Public Hospital applicant (to demo the Super Admin approval queue) ---
  const pending = await prisma.tenant.upsert({
    where: { email: "admin@lagosstategeneral.gov.ng" },
    update: {},
    create: {
      hospitalName: "Lagos State General Hospital, Ikorodu",
      hospitalType: "General Hospital",
      contactPerson: "Mrs. Funke Alabi",
      email: "admin@lagosstategeneral.gov.ng",
      phone: "+2348023456789",
      state: "Lagos", lga: "Ikorodu", address: "Ikorodu Road, Ikorodu",
      status: "pending_approval", publicHospitalRequested: true,
    },
  });
  await prisma.subscription.upsert({
    where: { tenantId: pending.id },
    update: {},
    create: { tenantId: pending.id, planCode: "public_hospital", billingCycle: "none", status: "pending_approval", publicHospitalApprovalStatus: "pending" },
  });

  // --- Module 5 demo: a finalized Clinical Note with a follow-up (added on top of the existing seed, nothing above this block changed) ---
  const demoVisit = await prisma.visit.findFirst({ where: { tenantId: tenant.id }, orderBy: { startedAt: "desc" } });
  if (demoVisit) {
    const existingNote = await prisma.clinicalNote.findFirst({ where: { visitId: demoVisit.id } });
    if (!existingNote) {
      await prisma.clinicalNote.create({
        data: {
          tenantId: tenant.id, visitId: demoVisit.id, patientId: demoVisit.patientId,
          clinicianId: doctor.id, clinicianRole: "doctor", status: "finalized", finalizedAt: new Date(),
          chiefComplaint: "Fever and chills for 3 days", symptomsReported: "Fever, chills, headache", complaintDuration: "3 days",
          temperature: 38.6, bloodPressure: "118/76", pulse: 92,
          diagnosisPrimary: "Malaria (uncomplicated)",
          noKnownAllergies: true,
          treatmentPlan: "Artemether-lumefantrine course administered", treatmentDuration: "3 days",
          followUpRequired: true, followUpType: "Review", followUpDurationOption: "2 days",
          approvedCommunicationInstruction: "Please remind the patient to return in 2 days for a review of their treatment progress.",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log("Tenant login (admin, email+password): admin@gracefamilyclinic.ng / Password!23");
  console.log("Staff PIN login: tenantEmail=admin@gracefamilyclinic.ng, staffIdDisplay=IHOPS-0001..0004, pin=1234");
  console.log("Super Admin login: superadmin@ihops.africa / SuperAdmin!23");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
