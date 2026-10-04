import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission,
} from "../../middleware/auth";
import {
  listSmsPackages,
  getWalletSummary,
  initializeTopup,
  SMS_PACKAGES,
} from "../../services/smsWalletService";

const router = Router();

// Same permission as billing/subscription — SMS top-ups are a billing
// action, and only a Hospital Administrator manages either.
router.get(
  "/",
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission("subscription.manage"),
  async (req, res, next) => {
    try {
      const { wallet, transactions } = await getWalletSummary(req.tenantId!);
      res.json({
        balanceUnits: wallet.balanceUnits,
        transactions,
        packages: listSmsPackages(),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/packages",
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission("subscription.manage"),
  async (_req, res) => {
    res.json({ packages: listSmsPackages() });
  },
);

// Starts a Paystack checkout for a one-off SMS unit top-up. Units are
// credited only once the webhook confirms payment — see
// modules/subscription/routes.ts's webhook handler, which is the single
// shared Paystack webhook endpoint for both subscriptions and SMS top-ups.
router.post(
  "/topup",
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission("subscription.manage"),
  async (req, res, next) => {
    try {
      const { packageKey } = req.body;
      if (!SMS_PACKAGES[packageKey]) {
        return res.status(400).json({ error: "Unknown SMS package" });
      }
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
      });
      const {
        authorizationUrl,
        reference,
        package: pkg,
      } = await initializeTopup({
        tenantId: req.tenantId!,
        email: tenant!.email,
        packageKey,
        callbackUrl: `${process.env.APP_BASE_URL}/app/admin/subscription?paystack=sms_topup_callback`,
      });
      res.json({ authorizationUrl, reference, package: pkg });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
