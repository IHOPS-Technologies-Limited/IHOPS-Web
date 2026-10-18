// IHOPS Internal console — hospital (tenant) management.
//
// Everything a developer used to do from a terminal against a hospital's
// account — fix a stuck onboarding, reset a locked-out administrator, credit
// SMS units, suspend/reactivate, delete a test signup — is exposed here behind
// Super Admin auth, so non-technical IHOPS staff can do it from the console.
//
// Boundary (PRD 9.6.3): this module deals in ACCOUNT-LEVEL data only —
// hospital profile, subscription, staff accounts, departments, SMS wallet and
// record COUNTS. It never returns patient, visit, clinical-note or finance
// content.
//
// Every mutation writes an AuditLog row carrying superAdminId.

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../middleware/audit";
import { hashSecret } from "../../lib/hash";
import { generateTempPin, generateVerificationToken } from "../../lib/ids";
import { generateTempPassword } from "../../lib/secrets";
import { appUrl } from "../../lib/appUrl";
import { sendEmail, sendSms } from "../../services/notificationService";
import { issuePasswordReset } from "../../services/passwordResetService";
import { nextStaffIdDisplay, blankToNull } from "../../services/staffService";
import { getOrCreateWallet } from "../../services/smsWalletService";
import {
  tenantRecordCounts,
  tenantDeletionWarnings,
  deleteTenantCascade,
  setTenantStatus,
} from "../../services/tenantAdminService";
import { HOSPITAL_TYPES } from "../auth/schemas";

const router = Router();

const trialDays = () => Number(process.env.TRIAL_LENGTH_DAYS || 7);
const graceDays = () => Number(process.env.GRACE_PERIOD_DAYS || 5);
const DAY = 24 * 60 * 60 * 1000;

// Express 4 doesn't catch rejected promises from async handlers; wrap so every
// error reaches the shared errorHandler instead of hanging the request.
const h =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const actor = (req: Request) => req.superAdmin!.id;

async function loadTenant(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    include: { subscription: true },
  });
}

async function loadStaff(tenantId: string, staffId: string) {
  return prisma.staff.findFirst({ where: { id: staffId, tenantId } });
}

// A hospital must always keep at least one active administrator, otherwise
// nobody can manage staff, settings or billing and only the Super Admin could
// recover it.
async function otherActiveAdmins(tenantId: string, excludeStaffId: string) {
  return prisma.staff.count({
    where: {
      tenantId,
      role: "administrator",
      status: "active",
      id: { not: excludeStaffId },
    },
  });
}

// ---------------------------------------------------------------------------
// LIST + DETAIL
// ---------------------------------------------------------------------------

router.get(
  "/hospitals",
  h(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const tenants = await prisma.tenant.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { hospitalName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { contactPerson: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        subscription: true,
        smsWallet: { select: { balanceUnits: true } },
        _count: { select: { staff: true, patients: true, visits: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({
      hospitals: tenants.map((t) => ({
        id: t.id,
        hospitalName: t.hospitalName,
        hospitalType: t.hospitalType,
        email: t.email,
        phone: t.phone,
        state: t.state,
        status: t.status,
        plan: t.subscription?.planCode ?? null,
        billingCycle: t.subscription?.billingCycle ?? null,
        trialEndsAt: t.trialEndsAt,
        gracePeriodEndsAt: t.gracePeriodEndsAt,
        setupWizardCompleted: t.setupWizardCompleted,
        createdAt: t.createdAt,
        staffCount: t._count.staff,
        patientCount: t._count.patients,
        visitCount: t._count.visits,
        smsBalance: t.smsWallet?.balanceUnits ?? 0,
      })),
    });
  }),
);

router.get(
  "/hospitals/:id",
  h(async (req, res) => {
    const t = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: { include: { payments: { orderBy: { paidAt: "desc" }, take: 25 } } },
        departments: {
          orderBy: { name: "asc" },
          include: { _count: { select: { staff: true, visits: true } } },
        },
        staff: {
          orderBy: { createdAt: "asc" },
          include: { department: { select: { name: true } } },
        },
      },
    });
    if (!t) return res.status(404).json({ error: "Hospital not found" });

    const wallet = await prisma.smsWallet.findUnique({ where: { tenantId: t.id } });
    const walletTxns = wallet
      ? await prisma.smsWalletTransaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];
    const { counts, subscriptionPayments } = await tenantRecordCounts(t.id);
    const audit = await prisma.auditLog.findMany({
      where: { tenantId: t.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { staff: { select: { name: true, staffIdDisplay: true } } },
    });
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const failedComms = await prisma.communicationLog.groupBy({
      by: ["channel", "failureReason"],
      where: { tenantId: t.id, status: "failed", createdAt: { gte: weekAgo } },
      _count: { _all: true },
    });
    const openTickets = await prisma.supportTicket.count({
      where: { tenantId: t.id, status: { not: "resolved" } },
    });

    const now = new Date();
    res.json({
      hospital: {
        id: t.id,
        hospitalName: t.hospitalName,
        hospitalType: t.hospitalType,
        contactPerson: t.contactPerson,
        email: t.email,
        phone: t.phone,
        state: t.state,
        lga: t.lga,
        address: t.address,
        nearestLandmark: t.nearestLandmark,
        postalCode: t.postalCode,
        status: t.status,
        publicHospitalRequested: t.publicHospitalRequested,
        supportingDocumentUrl: t.supportingDocumentUrl,
        setupWizardCompleted: t.setupWizardCompleted,
        trialEndsAt: t.trialEndsAt,
        gracePeriodEndsAt: t.gracePeriodEndsAt,
        currency: t.currency,
        restrictedAiMode: t.restrictedAiMode,
        aiRemindersEnabled: t.aiRemindersEnabled,
        birthdayMessagesEnabled: t.birthdayMessagesEnabled,
        // Never the token itself — only whether a verification is outstanding.
        verificationPending: t.status === "pending_verification",
        verificationExpires: t.emailVerificationExpires,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      },
      subscription: t.subscription,
      payments: t.subscription?.payments ?? [],
      subscriptionPayments,
      departments: t.departments.map((d) => ({
        id: d.id,
        name: d.name,
        staffCount: d._count.staff,
        visitCount: d._count.visits,
      })),
      staff: t.staff.map((s) => ({
        id: s.id,
        staffIdDisplay: s.staffIdDisplay,
        name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role,
        status: s.status,
        departmentId: s.departmentId,
        department: s.department?.name ?? null,
        hasPassword: !!s.passwordHash,
        mustChangePin: s.mustChangePin,
        failedPinAttempts: s.failedPinAttempts,
        locked: !!s.lockedUntil && s.lockedUntil > now,
        lockedUntil: s.lockedUntil,
        resetPending: !!s.passwordResetExpires && s.passwordResetExpires > now,
        createdAt: s.createdAt,
      })),
      records: counts,
      smsWallet: { balanceUnits: wallet?.balanceUnits ?? 0, transactions: walletTxns },
      support: { openTickets },
      failedMessages7d: failedComms.map((f) => ({
        channel: f.channel,
        reason: f.failureReason,
        count: f._count._all,
      })),
      activity: audit.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        entityType: a.entityType,
        entityId: a.entityId,
        actor: a.superAdminId
          ? "IHOPS Internal"
          : a.staff
            ? `${a.staff.name} (${a.staff.staffIdDisplay})`
            : "System",
        createdAt: a.createdAt,
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------

const profileSchema = z
  .object({
    hospitalName: z.string().trim().min(2).max(120),
    hospitalType: z.enum(HOSPITAL_TYPES),
    contactPerson: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(7).max(30),
    state: z.string().trim().min(2).max(60),
    lga: z.string().trim().min(2).max(80),
    address: z.string().trim().min(3).max(300),
    nearestLandmark: z.string().trim().max(200).nullable(),
    postalCode: z.string().trim().max(20).nullable(),
  })
  .partial()
  .strict();

router.patch(
  "/hospitals/:id",
  h(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const tenant = await loadTenant(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Hospital not found" });
    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: "Nothing to update" });

    let emailChange: { from: string; to: string } | null = null;
    if (data.email && data.email.toLowerCase() !== tenant.email.toLowerCase()) {
      const clash = await prisma.tenant.findFirst({
        where: { email: { equals: data.email, mode: "insensitive" }, id: { not: tenant.id } },
      });
      if (clash)
        return res
          .status(409)
          .json({ error: "Another hospital already uses that email address" });
      emailChange = { from: tenant.email, to: data.email };
    }

    // Changing the hospital's email also moves the administrator login(s) that
    // were created with it, so the hospital isn't locked out of email+password
    // sign-in after fixing a typo made at signup.
    await prisma.$transaction([
      prisma.tenant.update({ where: { id: tenant.id }, data }),
      ...(emailChange
        ? [
            prisma.staff.updateMany({
              where: {
                tenantId: tenant.id,
                email: { equals: emailChange.from, mode: "insensitive" },
              },
              data: { email: emailChange.to },
            }),
          ]
        : []),
    ]);
    await writeAuditLog({
      tenantId: tenant.id,
      superAdminId: actor(req),
      actionType: "superadmin.hospital_update",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { fields: Object.keys(data), emailChange },
    });
    res.json({ message: "Hospital updated" });
  }),
);

// ---------------------------------------------------------------------------
// STATUS / TRIAL / SUBSCRIPTION / VERIFICATION / SETUP
// ---------------------------------------------------------------------------

const statusSchema = z.object({
  status: z.enum(["active", "trialing", "grace_period", "suspended"]),
  notify: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
});

router.post(
  "/hospitals/:id/status",
  h(async (req, res) => {
    const { status, notify, reason } = statusSchema.parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    if (t.status === "pending_verification")
      return res.status(400).json({
        error: "This hospital hasn't verified its email yet. Use “Verify email now” first.",
      });
    if (t.status === "pending_approval")
      return res.status(400).json({
        error: "This is a pending Public Hospital application. Approve or reject it from the Approval Queue.",
      });
    if (t.subscription?.planCode === "public_hospital" && (status === "trialing" || status === "grace_period"))
      return res.status(400).json({
        error: "Public Hospitals don't have trials or grace periods — set them to Active or Suspended.",
      });

    const now = Date.now();
    const extra: { trialEndsAt?: Date | null; gracePeriodEndsAt?: Date | null } = {};
    if (status === "trialing") {
      if (!t.trialEndsAt || t.trialEndsAt.getTime() < now)
        extra.trialEndsAt = new Date(now + trialDays() * DAY);
      extra.gracePeriodEndsAt = null;
    } else if (status === "grace_period") {
      extra.gracePeriodEndsAt = new Date(now + graceDays() * DAY);
    } else if (status === "active") {
      extra.gracePeriodEndsAt = null;
    }
    await setTenantStatus(t.id, status, extra);

    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.hospital_status",
      entityType: "Tenant",
      entityId: t.id,
      metadata: { from: t.status, to: status, reason: reason || null },
    });

    if (notify) {
      const wasSuspended = t.status === "suspended";
      if (status === "suspended") {
        await sendEmail(
          t.email,
          "Your IHOPS account has been suspended",
          `Hello,\n\nAccess to IHOPS for ${t.hospitalName} has been suspended.${reason ? `\n\nReason: ${reason}` : ""}\n\nNothing has been deleted — all your records are safe. If you believe this is a mistake, reply to this email or contact IHOPS support and we'll sort it out.\n\nThe IHOPS Team`,
        );
      } else if (wasSuspended) {
        await sendEmail(
          t.email,
          "Your IHOPS access has been restored",
          `Hello,\n\nGood news — access to IHOPS for ${t.hospitalName} has been restored. Your team can sign in again as normal:\n\n${appUrl("/login")}\n\nThe IHOPS Team`,
        );
      }
    }
    res.json({ message: `Hospital set to ${status.replace("_", " ")}` });
  }),
);

router.post(
  "/hospitals/:id/extend-trial",
  h(async (req, res) => {
    const { days } = z
      .object({ days: z.number().int().min(1).max(90) })
      .parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    if (!["trialing", "grace_period", "suspended"].includes(t.status))
      return res.status(400).json({
        error: `A hospital that is “${t.status.replace("_", " ")}” has no trial to extend.`,
      });
    const base = t.trialEndsAt && t.trialEndsAt.getTime() > Date.now() ? t.trialEndsAt.getTime() : Date.now();
    const trialEndsAt = new Date(base + days * DAY);
    // Extending a lapsed trial puts the hospital back into trialing so they
    // regain access immediately; the hourly sweep will pick up the new date.
    await setTenantStatus(t.id, "trialing", { trialEndsAt, gracePeriodEndsAt: null });
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.trial_extended",
      entityType: "Tenant",
      entityId: t.id,
      metadata: { days, previousStatus: t.status, trialEndsAt },
    });
    res.json({ message: `Trial extended by ${days} day${days === 1 ? "" : "s"}`, trialEndsAt });
  }),
);

const subscriptionSchema = z
  .object({
    planCode: z.enum(["starter", "standard", "public_hospital"]),
    billingCycle: z.enum(["monthly", "annual", "none"]),
    activate: z.boolean().optional(),
    currentPeriodEnd: z.string().datetime().nullable().optional(),
    payment: z
      .object({
        amountNaira: z.number().positive().max(100_000_000),
        note: z.string().trim().min(2).max(200),
      })
      .optional(),
  })
  .refine((v) => (v.planCode === "public_hospital") === (v.billingCycle === "none"), {
    message: "Public Hospital uses billing cycle “none”; Starter/Standard need monthly or annual",
  });

// Manual subscription override — for a hospital that paid by bank transfer, a
// goodwill upgrade, or correcting a plan. Optionally records the payment so
// it appears in the hospital's payment history and platform revenue.
router.post(
  "/hospitals/:id/subscription",
  h(async (req, res) => {
    const body = subscriptionSchema.parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t?.subscription) return res.status(404).json({ error: "Hospital not found" });
    const sub = t.subscription;
    const toPublic = body.planCode === "public_hospital";

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planCode: body.planCode,
        billingCycle: body.billingCycle,
        publicHospitalApprovalStatus: toPublic ? "approved" : null,
        ...(body.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : null }
          : {}),
      },
    });
    if (body.payment) {
      await prisma.paymentHistory.create({
        data: {
          subscriptionId: sub.id,
          amount: body.payment.amountNaira,
          status: "success",
          paystackReference: `manual:${body.payment.note}`,
        },
      });
    }
    const shouldActivate = body.activate || toPublic;
    if (shouldActivate && !["pending_verification", "pending_approval"].includes(t.status)) {
      await setTenantStatus(t.id, "active", { gracePeriodEndsAt: null, trialEndsAt: null });
    }
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.subscription_override",
      entityType: "Subscription",
      entityId: sub.id,
      metadata: {
        from: { plan: sub.planCode, cycle: sub.billingCycle },
        to: { plan: body.planCode, cycle: body.billingCycle },
        activated: !!shouldActivate,
        manualPayment: body.payment ?? null,
      },
    });
    res.json({ message: "Subscription updated" });
  }),
);

// A hospital whose verification email never arrived (spam folder, wrong
// provider config, typo) can be verified directly by IHOPS.
router.post(
  "/hospitals/:id/verify-email",
  h(async (req, res) => {
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    if (t.status !== "pending_verification")
      return res.status(400).json({ error: "This hospital's email is already verified" });
    const newStatus = t.publicHospitalRequested ? "pending_approval" : "trialing";
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        status: newStatus,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        trialEndsAt: t.publicHospitalRequested ? null : new Date(Date.now() + trialDays() * DAY),
      },
    });
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.verify_email",
      entityType: "Tenant",
      entityId: t.id,
      metadata: { resultingStatus: newStatus },
    });
    res.json({
      status: newStatus,
      message: t.publicHospitalRequested
        ? "Email marked verified. The application is now in the Approval Queue."
        : `Email marked verified. The ${trialDays()}-day trial has started.`,
    });
  }),
);

router.post(
  "/hospitals/:id/resend-verification",
  h(async (req, res) => {
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    if (t.status !== "pending_verification")
      return res.status(400).json({ error: "This hospital's email is already verified" });
    const token = generateVerificationToken();
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: new Date(Date.now() + DAY),
      },
    });
    const verifyUrl = appUrl(`/verify-email?token=${token}`);
    const result = await sendEmail(
      t.email,
      "Verify your IHOPS account",
      `Hello,\n\nHere's a fresh verification link for ${t.hospitalName} — click it to confirm your hospital's email address and finish setting up your IHOPS account. It expires in 24 hours.\n\n${verifyUrl}\n\nThe IHOPS Team`,
    );
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.resend_verification",
      entityType: "Tenant",
      entityId: t.id,
    });
    // The link is returned so it can be sent over WhatsApp if email is failing.
    res.json({ emailed: result.ok, error: result.ok ? undefined : result.error, verifyUrl });
  }),
);

router.post(
  "/hospitals/:id/setup-wizard",
  h(async (req, res) => {
    const { completed } = z.object({ completed: z.boolean() }).parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    await prisma.tenant.update({
      where: { id: t.id },
      data: { setupWizardCompleted: completed },
    });
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.setup_wizard",
      entityType: "Tenant",
      entityId: t.id,
      metadata: { completed },
    });
    res.json({
      message: completed
        ? "Setup marked complete — the hospital goes straight to its dashboard."
        : "Setup reopened — the administrator will see the setup wizard on next sign-in.",
    });
  }),
);

// ---------------------------------------------------------------------------
// DELETE HOSPITAL
// ---------------------------------------------------------------------------

router.get(
  "/hospitals/:id/delete-preview",
  h(async (req, res) => {
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    const { counts, subscriptionPayments, smsWalletBalance } = await tenantRecordCounts(t.id);
    const warnings = await tenantDeletionWarnings(t.id);
    res.json({
      hospitalName: t.hospitalName,
      email: t.email,
      status: t.status,
      records: counts,
      subscriptionPayments,
      smsWalletBalance,
      warnings,
    });
  }),
);

router.delete(
  "/hospitals/:id",
  h(async (req, res) => {
    const { confirmName, force } = z
      .object({ confirmName: z.string(), force: z.boolean().optional() })
      .parse(req.body ?? {});
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    // Typed-name confirmation, enforced HERE and not just in the UI.
    if (confirmName.trim() !== t.hospitalName.trim())
      return res
        .status(400)
        .json({ error: "The hospital name you typed doesn't match. Nothing was deleted." });

    const warnings = await tenantDeletionWarnings(t.id);
    if (warnings.length > 0 && !force)
      return res.status(409).json({
        error: "This deletion needs an extra confirmation.",
        warnings,
        requiresForce: true,
      });

    const { counts } = await tenantRecordCounts(t.id);
    await deleteTenantCascade(t.id);
    // The hospital's own audit rows were deleted with it, so this platform-level
    // record (tenantId = null) is what remains as proof of the deletion.
    await writeAuditLog({
      superAdminId: actor(req),
      actionType: "superadmin.hospital_deleted",
      entityType: "Tenant",
      entityId: t.id,
      metadata: {
        hospitalName: t.hospitalName,
        email: t.email,
        statusAtDeletion: t.status,
        forced: !!force,
        deleted: Object.fromEntries(counts.filter((c) => c.count > 0).map((c) => [c.key, c.count])),
      },
    });
    res.json({ message: `${t.hospitalName} and all of its data were deleted. ${t.email} can sign up again.` });
  }),
);

// ---------------------------------------------------------------------------
// DEPARTMENTS
// ---------------------------------------------------------------------------

const deptName = z.string().trim().min(1).max(80).transform((s) => s.replace(/\s+/g, " "));

router.post(
  "/hospitals/:id/departments",
  h(async (req, res) => {
    const { name } = z.object({ name: deptName }).parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    const dupe = await prisma.department.findFirst({
      where: { tenantId: t.id, name: { equals: name, mode: "insensitive" } },
    });
    if (dupe) return res.status(409).json({ error: `“${dupe.name}” already exists` });
    const dept = await prisma.department.create({ data: { tenantId: t.id, name } });
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.department_create",
      entityType: "Department",
      entityId: dept.id,
      metadata: { name },
    });
    res.status(201).json({ department: dept });
  }),
);

router.patch(
  "/hospitals/:id/departments/:deptId",
  h(async (req, res) => {
    const { name } = z.object({ name: deptName }).parse(req.body);
    const dept = await prisma.department.findFirst({
      where: { id: req.params.deptId, tenantId: req.params.id },
    });
    if (!dept) return res.status(404).json({ error: "Department not found" });
    const dupe = await prisma.department.findFirst({
      where: {
        tenantId: dept.tenantId,
        id: { not: dept.id },
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (dupe) return res.status(409).json({ error: `“${dupe.name}” already exists` });
    await prisma.department.update({ where: { id: dept.id }, data: { name } });
    await writeAuditLog({
      tenantId: dept.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.department_rename",
      entityType: "Department",
      entityId: dept.id,
      metadata: { from: dept.name, to: name },
    });
    res.json({ message: "Department renamed" });
  }),
);

router.delete(
  "/hospitals/:id/departments/:deptId",
  h(async (req, res) => {
    const { moveToDepartmentId } = z
      .object({ moveToDepartmentId: z.string().nullable().optional() })
      .parse(req.body ?? {});
    const dept = await prisma.department.findFirst({
      where: { id: req.params.deptId, tenantId: req.params.id },
    });
    if (!dept) return res.status(404).json({ error: "Department not found" });
    const [staffCount, visitCount] = await Promise.all([
      prisma.staff.count({ where: { departmentId: dept.id } }),
      prisma.visit.count({ where: { departmentId: dept.id } }),
    ]);
    if ((staffCount > 0 || visitCount > 0) && !moveToDepartmentId)
      return res.status(409).json({
        error: `“${dept.name}” is used by ${staffCount} staff member(s) and ${visitCount} visit(s). Choose a department to move them to, then delete.`,
        staffCount,
        visitCount,
        needsMove: true,
      });
    if (moveToDepartmentId) {
      const target = await prisma.department.findFirst({
        where: { id: moveToDepartmentId, tenantId: dept.tenantId, NOT: { id: dept.id } },
      });
      if (!target) return res.status(400).json({ error: "The department to move into wasn't found" });
      await prisma.$transaction([
        prisma.staff.updateMany({ where: { departmentId: dept.id }, data: { departmentId: target.id } }),
        prisma.visit.updateMany({ where: { departmentId: dept.id }, data: { departmentId: target.id } }),
        prisma.department.delete({ where: { id: dept.id } }),
      ]);
    } else {
      await prisma.department.delete({ where: { id: dept.id } });
    }
    await writeAuditLog({
      tenantId: dept.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.department_delete",
      entityType: "Department",
      entityId: dept.id,
      metadata: { name: dept.name, movedTo: moveToDepartmentId ?? null },
    });
    res.json({ message: "Department deleted" });
  }),
);

// ---------------------------------------------------------------------------
// STAFF ACCOUNTS
// ---------------------------------------------------------------------------

const ROLES = ["administrator", "doctor", "receptionist", "finance_officer", "nurse"] as const;

router.post(
  "/hospitals/:id/staff",
  h(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(120),
        role: z.enum(ROLES),
        email: z.string().trim().email().nullable().optional(),
        phone: z.string().trim().max(30).nullable().optional(),
        departmentId: z.string().nullable().optional(),
      })
      .parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    const email = blankToNull(body.email);
    const phone = blankToNull(body.phone);
    if (body.role === "administrator" && !email)
      return res.status(400).json({ error: "An administrator needs an email address to sign in with" });
    if (body.departmentId) {
      const d = await prisma.department.findFirst({ where: { id: body.departmentId, tenantId: t.id } });
      if (!d) return res.status(400).json({ error: "Department not found for this hospital" });
    }
    const pin = generateTempPin();
    const temporaryPassword = body.role === "administrator" ? generateTempPassword() : null;
    const staff = await prisma.staff.create({
      data: {
        tenantId: t.id,
        staffIdDisplay: await nextStaffIdDisplay(t.id),
        name: body.name,
        role: body.role,
        email,
        phone,
        departmentId: body.departmentId || null,
        pinHash: await hashSecret(pin),
        passwordHash: temporaryPassword ? await hashSecret(temporaryPassword) : null,
        mustChangePin: true,
      },
    });
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.staff_create",
      entityType: "Staff",
      entityId: staff.id,
      metadata: { role: body.role },
    });
    // Credentials are returned ONCE for the console to display; they're not
    // stored anywhere in plain text.
    res.status(201).json({
      staff: { id: staff.id, staffIdDisplay: staff.staffIdDisplay, name: staff.name, role: staff.role },
      temporaryPin: pin,
      temporaryPassword,
    });
  }),
);

const staffPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().nullable(),
    phone: z.string().trim().max(30).nullable(),
    role: z.enum(ROLES),
    departmentId: z.string().nullable(),
    status: z.enum(["active", "inactive"]),
  })
  .partial()
  .strict();

router.patch(
  "/hospitals/:id/staff/:staffId",
  h(async (req, res) => {
    const body = staffPatchSchema.parse(req.body);
    const staff = await loadStaff(req.params.id, req.params.staffId);
    if (!staff) return res.status(404).json({ error: "Staff member not found" });
    if (Object.keys(body).length === 0) return res.status(400).json({ error: "Nothing to update" });

    const losesAdmin =
      staff.role === "administrator" &&
      staff.status === "active" &&
      ((body.role && body.role !== "administrator") || body.status === "inactive");
    if (losesAdmin && (await otherActiveAdmins(staff.tenantId, staff.id)) === 0)
      return res.status(400).json({
        error: "This is the hospital's only active administrator. Add or promote another administrator first.",
      });
    if (body.departmentId) {
      const d = await prisma.department.findFirst({ where: { id: body.departmentId, tenantId: staff.tenantId } });
      if (!d) return res.status(400).json({ error: "Department not found for this hospital" });
    }
    const data: any = { ...body };
    if ("email" in body) data.email = blankToNull(body.email);
    if ("phone" in body) data.phone = blankToNull(body.phone);
    await prisma.staff.update({ where: { id: staff.id }, data });
    await writeAuditLog({
      tenantId: staff.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.staff_update",
      entityType: "Staff",
      entityId: staff.id,
      metadata: { fields: Object.keys(body), status: body.status ?? undefined, role: body.role ?? undefined },
    });
    res.json({ message: "Staff account updated" });
  }),
);

router.post(
  "/hospitals/:id/staff/:staffId/reset-pin",
  h(async (req, res) => {
    const { sendSmsToStaff } = z
      .object({ sendSmsToStaff: z.boolean().optional() })
      .parse(req.body ?? {});
    const staff = await loadStaff(req.params.id, req.params.staffId);
    if (!staff) return res.status(404).json({ error: "Staff member not found" });
    const pin = generateTempPin();
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        pinHash: await hashSecret(pin),
        mustChangePin: true,
        failedPinAttempts: 0,
        lockedUntil: null,
      },
    });
    let smsSent = false;
    if (sendSmsToStaff && staff.phone) {
      const r = await sendSms(staff.phone, `Your IHOPS PIN was reset. New temporary PIN: ${pin}`);
      smsSent = r.ok;
    }
    await writeAuditLog({
      tenantId: staff.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.staff_reset_pin",
      entityType: "Staff",
      entityId: staff.id,
      metadata: { smsSent },
    });
    res.json({ temporaryPin: pin, smsSent });
  }),
);

router.post(
  "/hospitals/:id/staff/:staffId/reset-password",
  h(async (req, res) => {
    const { mode, sendEmailToStaff } = z
      .object({
        mode: z.enum(["link", "temporary"]),
        sendEmailToStaff: z.boolean().optional(),
      })
      .parse(req.body);
    const staff = await loadStaff(req.params.id, req.params.staffId);
    if (!staff) return res.status(404).json({ error: "Staff member not found" });
    if (!staff.email)
      return res.status(400).json({
        error: "This account has no email address, so it can't sign in with a password. Add an email first.",
      });

    let payload: Record<string, unknown>;
    if (mode === "link") {
      const r = await issuePasswordReset(staff, { email: sendEmailToStaff !== false });
      payload = { resetUrl: r.resetUrl, expiresAt: r.expiresAt, emailed: r.emailed };
    } else {
      const temporaryPassword = generateTempPassword();
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          passwordHash: await hashSecret(temporaryPassword),
          // A temporary password supersedes any outstanding emailed link.
          passwordResetTokenHash: null,
          passwordResetExpires: null,
        },
      });
      payload = { temporaryPassword };
    }
    await writeAuditLog({
      tenantId: staff.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.staff_reset_password",
      entityType: "Staff",
      entityId: staff.id,
      metadata: { mode },
    });
    res.json(payload);
  }),
);

router.post(
  "/hospitals/:id/staff/:staffId/unlock",
  h(async (req, res) => {
    const staff = await loadStaff(req.params.id, req.params.staffId);
    if (!staff) return res.status(404).json({ error: "Staff member not found" });
    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedPinAttempts: 0, lockedUntil: null },
    });
    await writeAuditLog({
      tenantId: staff.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.staff_unlock",
      entityType: "Staff",
      entityId: staff.id,
    });
    res.json({ message: "Account unlocked" });
  }),
);

// Permanent removal of a staff account. Staff who have any history are
// protected: deactivating is the right tool for them (it keeps visit and
// attendance records intact). `force` exists for test/mistaken accounts and
// detaches that history instead of failing — see below.
router.delete(
  "/hospitals/:id/staff/:staffId",
  h(async (req, res) => {
    const { confirm, force } = z
      .object({ confirm: z.string(), force: z.boolean().optional() })
      .parse(req.body ?? {});
    const staff = await loadStaff(req.params.id, req.params.staffId);
    if (!staff) return res.status(404).json({ error: "Staff member not found" });
    if (confirm.trim().toUpperCase() !== staff.staffIdDisplay.toUpperCase())
      return res.status(400).json({
        error: `Type the Staff ID (${staff.staffIdDisplay}) exactly to confirm. Nothing was deleted.`,
      });
    if (
      staff.role === "administrator" &&
      staff.status === "active" &&
      (await otherActiveAdmins(staff.tenantId, staff.id)) === 0
    )
      return res.status(400).json({
        error: "This is the hospital's only active administrator. Add another administrator first, or delete the whole hospital instead.",
      });

    const [visits, attendance, expenses, tickets, audits] = await Promise.all([
      prisma.visit.count({ where: { doctorId: staff.id } }),
      prisma.attendance.count({ where: { staffId: staff.id } }),
      prisma.expense.count({ where: { recordedByStaffId: staff.id } }),
      prisma.supportTicket.count({ where: { raisedByStaffId: staff.id } }),
      prisma.auditLog.count({ where: { staffId: staff.id } }),
    ]);
    // Expenses and support tickets REQUIRE a staff author in the schema and are
    // financial/support records — never silently orphaned or erased here.
    if (expenses > 0 || tickets > 0)
      return res.status(409).json({
        error: `This account recorded ${expenses} expense(s) and raised ${tickets} support ticket(s), so it can't be permanently deleted. Deactivate it instead — they'll no longer be able to sign in.`,
        blocking: { expenses, tickets },
      });
    const history = visits + attendance + audits;
    if (history > 0 && !force)
      return res.status(409).json({
        error: `This account has history (${visits} visit(s) as doctor, ${attendance} attendance record(s), ${audits} audit entr${audits === 1 ? "y" : "ies"}). Deactivate it to keep that history, or tick “also detach history” to delete anyway.`,
        history: { visits, attendance, audits },
        requiresForce: true,
      });

    await prisma.$transaction([
      // Visits keep existing — they just lose the doctor assignment.
      prisma.visit.updateMany({ where: { doctorId: staff.id }, data: { doctorId: null } }),
      prisma.attendance.deleteMany({ where: { staffId: staff.id } }),
      // Audit entries are KEPT but anonymised (staff reference removed).
      prisma.auditLog.updateMany({ where: { staffId: staff.id }, data: { staffId: null } }),
      prisma.staff.delete({ where: { id: staff.id } }),
    ]);
    await writeAuditLog({
      tenantId: staff.tenantId,
      superAdminId: actor(req),
      actionType: "superadmin.staff_deleted",
      entityType: "Staff",
      entityId: staff.id,
      metadata: {
        staffIdDisplay: staff.staffIdDisplay,
        name: staff.name,
        role: staff.role,
        detached: { visits, attendance, audits },
      },
    });
    res.json({ message: `${staff.name} (${staff.staffIdDisplay}) was permanently deleted` });
  }),
);

// ---------------------------------------------------------------------------
// SMS WALLET
// ---------------------------------------------------------------------------

router.post(
  "/hospitals/:id/sms-wallet/adjust",
  h(async (req, res) => {
    const { units, note } = z
      .object({
        units: z
          .number()
          .int()
          .refine((n) => n !== 0, "Units can't be zero")
          .refine((n) => Math.abs(n) <= 100000, "Maximum adjustment is 100,000 units"),
        note: z.string().trim().min(3).max(200),
      })
      .parse(req.body);
    const t = await loadTenant(req.params.id);
    if (!t) return res.status(404).json({ error: "Hospital not found" });
    const wallet = await getOrCreateWallet(t.id);
    if (wallet.balanceUnits + units < 0)
      return res.status(400).json({
        error: `Balance is ${wallet.balanceUnits} units — that deduction would make it negative.`,
      });
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
          description: `Manual ${units > 0 ? "credit" : "deduction"} by IHOPS — ${note}`,
        },
      }),
    ]);
    await writeAuditLog({
      tenantId: t.id,
      superAdminId: actor(req),
      actionType: "superadmin.sms_wallet_adjust",
      entityType: "SmsWallet",
      entityId: wallet.id,
      metadata: { units, note, newBalance: updated.balanceUnits },
    });
    res.json({ balanceUnits: updated.balanceUnits, message: `Wallet ${units > 0 ? "credited" : "debited"} by ${Math.abs(units)} units` });
  }),
);

export default router;
