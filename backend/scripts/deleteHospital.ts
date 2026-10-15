// Permanently delete a hospital account (tenant) and ALL of its data:
// staff, patients, visits, payments, clinical notes, communications,
// support tickets, SMS wallet, subscription, audit logs.
//
// Nothing in the schema cascades on delete, so this removes rows in
// dependency order inside a single transaction — if any step fails,
// nothing is deleted.
//
// Run from backend/ (uses DATABASE_URL from .env — on your machine that is
// the live Neon database, so double-check the email):
//
//   Preview (deletes nothing, shows what WOULD be removed):
//     npx ts-node --transpile-only scripts/deleteHospital.ts <hospital-email>
//
//   Actually delete:
//     npx ts-node --transpile-only scripts/deleteHospital.ts <hospital-email> --confirm
//
//   Delete a hospital that has real payment history (refused by default):
//     npx ts-node --transpile-only scripts/deleteHospital.ts <hospital-email> --confirm --force
//
// Notes:
//  - Uploaded clinical files (PDF/images) on the server's disk are NOT
//    removed by this script, only their database records.
//  - To remove a single staff member, deactivate them in the app's Staff
//    Directory instead — deleting staff rows would break visit/attendance
//    history for that hospital.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");

  if (!email) {
    const tenants = await prisma.tenant.findMany({
      select: { hospitalName: true, email: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("Hospitals in this database:\n");
    for (const t of tenants) {
      console.log(`  ${t.email}  —  ${t.hospitalName} (${t.status})`);
    }
    console.log(
      "\nUsage: npx ts-node --transpile-only scripts/deleteHospital.ts <hospital-email> [--confirm] [--force]",
    );
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { email } });
  if (!tenant) throw new Error(`No hospital found with email ${email}`);
  const tenantId = tenant.id;

  // Row counts per table, for the preview and the paying-customer guard.
  const counts = {
    "Clinical communication payloads": await prisma.communicationPayload.count({ where: { tenantId } }),
    "Clinical documents": await prisma.clinicalDocument.count({ where: { tenantId } }),
    "Clinical notes": await prisma.clinicalNote.count({ where: { tenantId } }),
    "Communication logs": await prisma.communicationLog.count({ where: { tenantId } }),
    Payments: await prisma.payment.count({ where: { tenantId } }),
    Visits: await prisma.visit.count({ where: { tenantId } }),
    Patients: await prisma.patient.count({ where: { tenantId } }),
    Families: await prisma.family.count({ where: { tenantId } }),
    Attendance: await prisma.attendance.count({ where: { tenantId } }),
    Expenses: await prisma.expense.count({ where: { tenantId } }),
    "Support tickets": await prisma.supportTicket.count({ where: { tenantId } }),
    "Patient record requests": await prisma.patientRecordRequest.count({ where: { tenantId } }),
    "Audit log entries": await prisma.auditLog.count({ where: { tenantId } }),
    "SMS wallet transactions": await prisma.smsWalletTransaction.count({ where: { wallet: { tenantId } } }),
    Staff: await prisma.staff.count({ where: { tenantId } }),
    Departments: await prisma.department.count({ where: { tenantId } }),
  };
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  const subscriptionPayments = subscription
    ? await prisma.paymentHistory.count({ where: { subscriptionId: subscription.id } })
    : 0;
  const wallet = await prisma.smsWallet.findUnique({ where: { tenantId } });

  console.log(`\nHospital: ${tenant.hospitalName} <${tenant.email}> — status: ${tenant.status}`);
  console.log("Records that will be deleted:");
  for (const [label, n] of Object.entries(counts)) console.log(`  ${label}: ${n}`);
  console.log(`  Subscription payment records: ${subscriptionPayments}`);
  console.log(`  SMS wallet balance: ${wallet ? wallet.balanceUnits : 0} units`);

  if (subscriptionPayments > 0 && !force) {
    throw new Error(
      "This hospital has subscription payment history (real money). Refusing to delete. Re-run with --force if you are certain.",
    );
  }

  if (!confirm) {
    console.log("\nPreview only — nothing was deleted. Re-run with --confirm to delete.");
    return;
  }

  // Dependency order: children before parents.
  await prisma.$transaction([
    prisma.communicationPayload.deleteMany({ where: { tenantId } }),
    prisma.clinicalDocument.deleteMany({ where: { tenantId } }),
    prisma.clinicalNote.deleteMany({ where: { tenantId } }),
    prisma.communicationLog.deleteMany({ where: { tenantId } }),
    prisma.payment.deleteMany({ where: { tenantId } }),
    prisma.visit.deleteMany({ where: { tenantId } }),
    prisma.patient.deleteMany({ where: { tenantId } }),
    prisma.family.deleteMany({ where: { tenantId } }),
    prisma.attendance.deleteMany({ where: { tenantId } }),
    prisma.expense.deleteMany({ where: { tenantId } }),
    prisma.supportTicketReply.deleteMany({ where: { ticket: { tenantId } } }),
    prisma.supportTicket.deleteMany({ where: { tenantId } }),
    prisma.patientRecordRequest.deleteMany({ where: { tenantId } }),
    // Audit rows may reference this hospital directly or via its staff.
    prisma.auditLog.deleteMany({
      where: { OR: [{ tenantId }, { staff: { tenantId } }] },
    }),
    prisma.smsWalletTransaction.deleteMany({ where: { wallet: { tenantId } } }),
    prisma.smsWallet.deleteMany({ where: { tenantId } }),
    prisma.staff.deleteMany({ where: { tenantId } }),
    prisma.department.deleteMany({ where: { tenantId } }),
    prisma.paymentHistory.deleteMany({ where: { subscription: { tenantId } } }),
    prisma.subscription.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } }),
  ]);

  console.log(`\nDeleted ${tenant.hospitalName} and all of its data. ${tenant.email} can now sign up again.`);
}

main()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
