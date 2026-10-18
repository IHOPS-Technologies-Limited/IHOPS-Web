// Account-level operations on a hospital (tenant), shared by the Super Admin
// console and the command-line scripts in backend/scripts so there is exactly
// one implementation of each. Nothing in here ever reads patient, visit,
// clinical or finance CONTENT — only counts and account/subscription data —
// consistent with the PRD rule that the internal console is account-level only.

import { prisma } from "../lib/prisma";

export type RecordCount = { key: string; label: string; count: number };

export async function tenantRecordCounts(tenantId: string): Promise<{
  counts: RecordCount[];
  subscriptionPayments: number;
  smsWalletBalance: number;
}> {
  const c = async (p: Promise<number>) => p;
  const entries: [string, string, Promise<number>][] = [
    ["communicationPayloads", "Clinical communication payloads", prisma.communicationPayload.count({ where: { tenantId } })],
    ["clinicalDocuments", "Clinical documents", prisma.clinicalDocument.count({ where: { tenantId } })],
    ["clinicalNotes", "Clinical notes", prisma.clinicalNote.count({ where: { tenantId } })],
    ["communicationLogs", "Communication logs", prisma.communicationLog.count({ where: { tenantId } })],
    ["payments", "Visit payments", prisma.payment.count({ where: { tenantId } })],
    ["visits", "Visits", prisma.visit.count({ where: { tenantId } })],
    ["patients", "Patients", prisma.patient.count({ where: { tenantId } })],
    ["families", "Families", prisma.family.count({ where: { tenantId } })],
    ["attendance", "Attendance records", prisma.attendance.count({ where: { tenantId } })],
    ["expenses", "Expenses", prisma.expense.count({ where: { tenantId } })],
    ["supportTickets", "Support tickets", prisma.supportTicket.count({ where: { tenantId } })],
    ["patientRecordRequests", "Patient record requests", prisma.patientRecordRequest.count({ where: { tenantId } })],
    ["auditLogs", "Audit log entries", prisma.auditLog.count({ where: { tenantId } })],
    ["smsWalletTransactions", "SMS wallet transactions", prisma.smsWalletTransaction.count({ where: { wallet: { tenantId } } })],
    ["staff", "Staff accounts", prisma.staff.count({ where: { tenantId } })],
    ["departments", "Departments", prisma.department.count({ where: { tenantId } })],
  ];
  const counts: RecordCount[] = [];
  for (const [key, label, p] of entries) counts.push({ key, label, count: await c(p) });

  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  const subscriptionPayments = subscription
    ? await prisma.paymentHistory.count({ where: { subscriptionId: subscription.id } })
    : 0;
  const wallet = await prisma.smsWallet.findUnique({ where: { tenantId } });
  return { counts, subscriptionPayments, smsWalletBalance: wallet?.balanceUnits ?? 0 };
}

// Things that make deleting a hospital more than a tidy-up. The caller must
// pass `force` to proceed past any of them.
export async function tenantDeletionWarnings(tenantId: string): Promise<string[]> {
  const warnings: string[] = [];
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (subscription) {
    const paid = await prisma.paymentHistory.count({
      where: { subscriptionId: subscription.id, status: "success" },
    });
    if (paid > 0)
      warnings.push(
        `This hospital has ${paid} successful subscription payment${paid === 1 ? "" : "s"} on record (real money). Deleting erases that payment history.`,
      );
    if (subscription.paystackSubscriptionCode && subscription.status === "active")
      warnings.push(
        "This hospital has an ACTIVE Paystack subscription. Deleting the account does NOT cancel it at Paystack — cancel it in the Paystack dashboard or the customer will keep being charged.",
      );
  }
  const wallet = await prisma.smsWallet.findUnique({ where: { tenantId } });
  if (wallet && wallet.balanceUnits > 0)
    warnings.push(`There are ${wallet.balanceUnits} unused SMS units in the wallet; they will be lost.`);
  return warnings;
}

// Permanently deletes a hospital and ALL of its data. Nothing in the schema
// cascades on delete, so rows are removed children-first inside ONE
// transaction — if any step fails, nothing is deleted.
// (Uploaded clinical files on the server's disk are not removed, only their
// database records.)
export async function deleteTenantCascade(tenantId: string): Promise<void> {
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
}

// Keeps Tenant.status and Subscription.status in step. The tenant status is
// what gates access (requireStaffAuth); the subscription status is what the
// billing screens and the trial/grace sweep read — setting only one leaves the
// account in a state the other half of the app disagrees with.
export async function setTenantStatus(
  tenantId: string,
  status: "active" | "trialing" | "grace_period" | "suspended",
  extra: { trialEndsAt?: Date | null; gracePeriodEndsAt?: Date | null } = {},
) {
  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status,
        ...(extra.trialEndsAt !== undefined ? { trialEndsAt: extra.trialEndsAt } : {}),
        ...(extra.gracePeriodEndsAt !== undefined
          ? { gracePeriodEndsAt: extra.gracePeriodEndsAt }
          : {}),
      },
    }),
    prisma.subscription.updateMany({ where: { tenantId }, data: { status } }),
  ]);
}
