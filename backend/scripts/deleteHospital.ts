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
import {
  tenantRecordCounts,
  tenantDeletionWarnings,
  deleteTenantCascade,
} from "../src/services/tenantAdminService";

// NOTE: the same operation is available (with a typed-name confirmation) in
// the IHOPS Internal console → Hospitals → <hospital> → Danger zone. This
// script remains as a break-glass option and shares the same implementation
// (src/services/tenantAdminService.ts), so the two can never drift apart.

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

  const { counts, subscriptionPayments, smsWalletBalance } =
    await tenantRecordCounts(tenant.id);
  const warnings = await tenantDeletionWarnings(tenant.id);

  console.log(
    `\nHospital: ${tenant.hospitalName} <${tenant.email}> — status: ${tenant.status}`,
  );
  console.log("Records that will be deleted:");
  for (const c of counts) console.log(`  ${c.label}: ${c.count}`);
  console.log(`  Subscription payment records: ${subscriptionPayments}`);
  console.log(`  SMS wallet balance: ${smsWalletBalance} units`);
  for (const w of warnings) console.log(`  ! ${w}`);

  if (warnings.length > 0 && !force) {
    throw new Error(
      "Refusing to delete: see the warnings above. Re-run with --force if you are certain.",
    );
  }

  if (!confirm) {
    console.log(
      "\nPreview only — nothing was deleted. Re-run with --confirm to delete.",
    );
    return;
  }

  await deleteTenantCascade(tenant.id);
  console.log(
    `\nDeleted ${tenant.hospitalName} and all of its data. ${tenant.email} can now sign up again.`,
  );
}

main()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
