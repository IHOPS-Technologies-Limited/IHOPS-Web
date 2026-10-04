// Prepaid SMS wallet (pay-as-you-go, bought in bulk packages).
//
// Model: a hospital buys a fixed package of SMS "units" up front through
// Paystack (a one-off charge, not a subscription — see initializeTopup
// below). Every outbound SMS to a patient debits exactly 1 unit at send
// time (see debitSmsUnit, called from notificationService.sendOnChannel).
// If the provider send then fails, the unit is refunded. A hospital with 0
// balance simply cannot send SMS until they top up again — WhatsApp and
// email are unaffected, since only the `sms` channel is billed this way.
//
// Pricing here is illustrative (₦10/unit at the entry tier, cheaper per-unit
// at bulk tiers) — adjust SMS_PACKAGES to match whatever margin you want
// over your upstream SMS provider's (Termii/Africa's Talking) per-SMS cost.

import { prisma } from "../lib/prisma";
import { initializeTransaction } from "./paystackService";

export type SmsPackage = {
  key: string;
  units: number;
  amountKobo: number;
  label: string;
};

// Naira-per-unit gets cheaper at higher tiers, same shape as the SMS
// resellers Malik was comparing (Termii etc. charge IHOPS a near-flat rate
// per SMS, so the spread between what's charged here and that upstream
// cost is the margin).
export const SMS_PACKAGES: Record<string, SmsPackage> = {
  starter_1k: {
    key: "starter_1k",
    units: 100,
    amountKobo: 100_000, // ₦1,000 -> ₦10.00/unit
    label: "100 SMS units",
  },
  growth_5k: {
    key: "growth_5k",
    units: 550,
    amountKobo: 500_000, // ₦5,000 -> ₦9.09/unit
    label: "550 SMS units",
  },
  bulk_10k: {
    key: "bulk_10k",
    units: 1_200,
    amountKobo: 1_000_000, // ₦10,000 -> ₦8.33/unit
    label: "1,200 SMS units",
  },
};

export function listSmsPackages(): SmsPackage[] {
  return Object.values(SMS_PACKAGES);
}

export async function getOrCreateWallet(tenantId: string) {
  const existing = await prisma.smsWallet.findUnique({ where: { tenantId } });
  if (existing) return existing;
  // Two concurrent first-touches (rare) would race here; catch the unique
  // constraint and re-read rather than crash the caller.
  try {
    return await prisma.smsWallet.create({ data: { tenantId } });
  } catch {
    return prisma.smsWallet.findUniqueOrThrow({ where: { tenantId } });
  }
}

export async function getWalletSummary(tenantId: string) {
  const wallet = await getOrCreateWallet(tenantId);
  const transactions = await prisma.smsWalletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { wallet, transactions };
}

// Starts a Paystack checkout for a one-off wallet top-up. Deliberately does
// NOT pass a `planCode` that resolves in PLAN_CODE_MAP — leaving it
// unresolved means paystackService sends no `plan` field, so Paystack
// treats this as a plain one-time charge for `amountKobo`, not a
// recurring subscription. Units are credited only once the webhook
// confirms payment (see handleTopupWebhookEvent) — never on the client
// redirect alone.
export async function initializeTopup(params: {
  tenantId: string;
  email: string;
  packageKey: string;
  callbackUrl?: string;
}): Promise<{
  authorizationUrl: string;
  reference: string;
  package: SmsPackage;
}> {
  const pkg = SMS_PACKAGES[params.packageKey];
  if (!pkg) throw new Error("Unknown SMS package");

  const { authorizationUrl, reference } = await initializeTransaction({
    email: params.email,
    amountKobo: pkg.amountKobo,
    planCode: "__sms_topup_not_a_plan__", // intentionally unmatched, see comment above
    metadata: {
      tenantId: params.tenantId,
      purpose: "sms_topup",
      packageKey: pkg.key,
      units: pkg.units,
    },
    callbackUrl: params.callbackUrl,
  });

  const wallet = await getOrCreateWallet(params.tenantId);
  // Recorded as `pending` immediately so the hospital sees "top-up in
  // progress" even before the webhook lands; the webhook flips it to
  // `success` and is the only thing that ever credits balanceUnits.
  await prisma.smsWalletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "topup",
      units: pkg.units,
      amountKobo: pkg.amountKobo,
      status: "pending",
      packageKey: pkg.key,
      paystackReference: reference,
      description: `Top-up initiated: ${pkg.label}`,
    },
  });

  return { authorizationUrl, reference, package: pkg };
}

// Called from the shared Paystack webhook handler
// (modules/subscription/routes.ts) when metadata.purpose === "sms_topup".
// Idempotent: a webhook Paystack retries (or that arrives twice) will not
// double-credit, because the pending transaction row created in
// initializeTopup is looked up by its unique paystackReference and only
// flipped from pending -> success once.
export async function handleTopupWebhookEvent(event: {
  data?: {
    reference?: string;
    metadata?: { tenantId?: string; purpose?: string; units?: number };
  };
}): Promise<void> {
  const reference = event.data?.reference;
  const tenantId = event.data?.metadata?.tenantId;
  if (!reference || !tenantId) return;

  const txn = await prisma.smsWalletTransaction.findUnique({
    where: { paystackReference: reference },
  });
  if (!txn || txn.status !== "pending") return; // already processed, or not a topup we started

  const wallet = await getOrCreateWallet(tenantId);
  await prisma.$transaction([
    prisma.smsWallet.update({
      where: { id: wallet.id },
      data: { balanceUnits: { increment: txn.units } },
    }),
    prisma.smsWalletTransaction.update({
      where: { id: txn.id },
      data: {
        status: "success",
        description: `${txn.description} — confirmed`,
      },
    }),
  ]);
}

// Atomically consumes 1 unit if (and only if) the balance is >= 1. The
// WHERE clause on balanceUnits means two simultaneous sends can never both
// succeed off the last unit — one of the two updateMany calls will match 0
// rows. Returns false (no debit performed) when the wallet is empty.
export async function debitSmsUnit(
  tenantId: string,
  communicationLogId?: string,
): Promise<boolean> {
  const wallet = await getOrCreateWallet(tenantId);
  const result = await prisma.smsWallet.updateMany({
    where: { tenantId, balanceUnits: { gte: 1 } },
    data: { balanceUnits: { decrement: 1 } },
  });
  if (result.count !== 1) return false;

  await prisma.smsWalletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "debit",
      units: -1,
      status: "success",
      communicationLogId,
      description: "1 unit — patient SMS sent",
    },
  });
  return true;
}

// Returns the unit to the wallet after a debited send fails at the
// provider (Termii/Africa's Talking error) — the hospital shouldn't be
// charged for an SMS that never actually went out.
export async function refundSmsUnit(
  tenantId: string,
  reason: string,
  communicationLogId?: string,
): Promise<void> {
  const wallet = await getOrCreateWallet(tenantId);
  await prisma.$transaction([
    prisma.smsWallet.update({
      where: { id: wallet.id },
      data: { balanceUnits: { increment: 1 } },
    }),
    prisma.smsWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "refund",
        units: 1,
        status: "success",
        communicationLogId,
        description: `1 unit refunded — ${reason}`,
      },
    }),
  ]);
}
