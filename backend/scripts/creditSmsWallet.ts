// Manually credit SMS units to a hospital's wallet WITHOUT a Paystack payment.
// Intended for internal testing / goodwill credits only — the credit is
// recorded as an "adjustment" transaction so it is clearly distinguishable
// from purchased top-ups in the wallet history.
//
// Run from backend/ (uses whatever DATABASE_URL is in .env — on your
// machine that is the live Neon database, so double-check the email):
//
//   npx ts-node --transpile-only scripts/creditSmsWallet.ts <hospital-email> <units>
//
// Example:
//   npx ts-node --transpile-only scripts/creditSmsWallet.ts admin@gracefamilyclinic.ng 200
//
// Run with no arguments to list all hospitals (name + email) first.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, unitsArg] = process.argv.slice(2);

  if (!email) {
    const tenants = await prisma.tenant.findMany({
      select: { hospitalName: true, email: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("Hospitals in this database:\n");
    for (const t of tenants)
      console.log(`  ${t.email}  —  ${t.hospitalName} (${t.status})`);
    console.log(
      "\nUsage: npx ts-node --transpile-only scripts/creditSmsWallet.ts <hospital-email> <units>",
    );
    return;
  }

  const units = Number(unitsArg);
  if (!Number.isInteger(units) || units <= 0 || units > 100000) {
    throw new Error("units must be a whole number between 1 and 100000");
  }

  const tenant = await prisma.tenant.findFirst({ where: { email } });
  if (!tenant) throw new Error(`No hospital found with email ${email}`);

  const wallet =
    (await prisma.smsWallet.findUnique({ where: { tenantId: tenant.id } })) ??
    (await prisma.smsWallet.create({ data: { tenantId: tenant.id } }));

  const [updated] = await prisma.$transaction([
    prisma.smsWallet.update({
      where: { id: wallet.id },
      data: { balanceUnits: { increment: units } },
    }),
    prisma.smsWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "adjustment",
        units,
        status: "success",
        description: `Manual credit (no payment) — ${units} units`,
      },
    }),
  ]);

  console.log(
    `Credited ${units} units to ${tenant.hospitalName}. New balance: ${updated.balanceUnits} units.`,
  );
}

main()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
