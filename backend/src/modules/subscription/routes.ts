import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission,
} from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import {
  initializeTransaction,
  verifyWebhookSignature,
} from "../../services/paystackService";
import { handleTopupWebhookEvent } from "../../services/smsWalletService";

// Ambient augmentation for the rawBody stashed by app.ts's express.json()
// verify callback — see app.ts for why this exists.
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const router = Router();

const PLAN_PRICES_KOBO: Record<string, number> = {
  starter_monthly: 1500000, // ₦15,000
  starter_annual: 15000000, // ₦150,000
  standard_monthly: 3500000, // ₦35,000
  standard_annual: 35000000, // ₦350,000
};

router.get(
  "/current",
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission("subscription.manage"),
  async (req, res, next) => {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenantId! },
        include: { payments: { orderBy: { paidAt: "desc" } } },
      });
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
      });
      res.json({
        subscription,
        tenantStatus: tenant?.status,
        trialEndsAt: tenant?.trialEndsAt,
        gracePeriodEndsAt: tenant?.gracePeriodEndsAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Initiates a Paystack checkout for upgrade/renewal. The client callback
// only improves perceived speed — see the webhook below for the source of truth.
router.post(
  "/checkout",
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission("subscription.manage"),
  async (req, res, next) => {
    try {
      const { planCode, billingCycle } = req.body;
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
      });
      const key = `${planCode}_${billingCycle}`;
      const amountKobo = PLAN_PRICES_KOBO[key];
      if (!amountKobo)
        return res
          .status(400)
          .json({ error: "Unknown plan/billing cycle combination" });

      const { authorizationUrl, reference } = await initializeTransaction({
        email: tenant!.email,
        amountKobo,
        planCode: key,
        metadata: { tenantId: req.tenantId, planCode, billingCycle },
        callbackUrl: `${process.env.APP_BASE_URL}/app/admin/subscription?paystack=callback`,
      });
      res.json({ authorizationUrl, reference });
    } catch (err) {
      next(err);
    }
  },
);

// Paystack webhook — authoritative source of truth for activation/renewal/restoration.
router.post("/webhook/paystack", async (req, res, next) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    // Use the exact bytes Paystack sent (captured by app.ts), not a
    // re-serialized req.body — see the declare global comment above.
    const raw = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body);
    if (!verifyWebhookSignature(raw, signature))
      return res.status(401).json({ error: "Invalid signature" });

    const event = req.body;

    // SMS wallet top-ups are one-off charges (see smsWalletService.
    // initializeTopup — they deliberately carry no recognized `plan`), so
    // they only ever fire charge.success, tagged with
    // metadata.purpose === "sms_topup". Handle and stop here so they never
    // fall through into the subscription-activation branch below.
    if (
      event.event === "charge.success" &&
      event.data?.metadata?.purpose === "sms_topup"
    ) {
      await handleTopupWebhookEvent(event);
      return res.json({ received: true });
    }

    if (
      event.event === "charge.success" ||
      event.event === "subscription.create"
    ) {
      const tenantId = event.data?.metadata?.tenantId;
      if (tenantId) {
        const subscription = await prisma.subscription.update({
          where: { tenantId },
          data: {
            status: "active",
            planCode: event.data?.metadata?.planCode,
            billingCycle: event.data?.metadata?.billingCycle,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        await prisma.tenant.update({
          where: { id: tenantId },
          // trialEndsAt cleared too — otherwise the old trial date lingers
          // in the UI forever on a tenant that's now actively paying.
          data: {
            status: "active",
            gracePeriodEndsAt: null,
            trialEndsAt: null,
          },
        });
        await prisma.paymentHistory.create({
          data: {
            subscriptionId: subscription.id,
            amount: (event.data.amount || 0) / 100,
            status: "success",
            paystackReference: event.data.reference,
          },
        });
        await writeAuditLog({
          tenantId,
          actionType: "subscription.activated_via_webhook",
          entityType: "Subscription",
          entityId: subscription.id,
        });
      }
    }
    if (
      event.event === "subscription.disable" ||
      event.event === "invoice.payment_failed"
    ) {
      const tenantId = event.data?.metadata?.tenantId;
      if (tenantId) {
        const graceDays = Number(process.env.GRACE_PERIOD_DAYS || 5);
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            status: "grace_period",
            gracePeriodEndsAt: new Date(
              Date.now() + graceDays * 24 * 60 * 60 * 1000,
            ),
          },
        });
        await prisma.subscription.update({
          where: { tenantId },
          data: { status: "grace_period" },
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// Hospital Administrator role transfer (Section 4/11.2).
router.post(
  "/transfer-admin",
  requireStaffAuth,
  requirePermission("subscription.manage"),
  async (req, res, next) => {
    try {
      const { newEmail } = req.body;
      // In production this would send a verification email to newEmail and
      // complete the transfer only once that link is clicked. Simplified here
      // to an immediate transfer for demonstration.
      await prisma.staff.update({
        where: { id: req.staff!.id },
        data: { email: newEmail },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "admin.transfer",
        entityType: "Staff",
        entityId: req.staff!.id,
        metadata: { newEmail },
      });
      res.json({ message: "Administrator role transferred" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
