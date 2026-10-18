import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../../lib/prisma";
import { hashSecret, compareSecret } from "../../lib/hash";
import { signStaffToken, signSuperAdminToken } from "../../lib/jwt";
import {
  generateStaffId,
  generateVerificationToken,
  generateTempPin,
} from "../../lib/ids";
import {
  signupSchema,
  loginSchema,
  pinLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./schemas";
import { hashResetToken } from "../../lib/secrets";
import { issuePasswordReset } from "../../services/passwordResetService";
import { sendEmail } from "../../services/notificationService";
import { writeAuditLog } from "../../middleware/audit";
import { requireStaffAuth, allowWhenSuspended } from "../../middleware/auth";

const router = Router();

const trialDays = Number(process.env.TRIAL_LENGTH_DAYS || 7);

const resendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.body?.email || req.ip,
});

// Password reset emails: a handful per address per 15 minutes is plenty for a
// real person and stops the endpoint being used to spam someone's inbox.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.body?.email || req.ip || "").toLowerCase(),
  message: {
    error: "Too many reset requests. Please try again in a few minutes.",
  },
});
// Guessing reset tokens / passwords: throttle per IP.
const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

// --- 9.1.1 / 9.1.2 Signup — Hospital Information + Plan Selection combined ---
router.post("/signup", async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const existing = await prisma.tenant.findUnique({
      where: { email: body.email },
    });
    if (existing)
      return res
        .status(409)
        .json({ error: "A hospital account with this email already exists" });

    const verificationToken = generateVerificationToken();
    const isPublicHospital = body.planCode === "public_hospital";

    const tenant = await prisma.tenant.create({
      data: {
        hospitalName: body.hospitalName,
        hospitalType: body.hospitalType,
        contactPerson: body.contactPerson,
        email: body.email,
        phone: body.phone,
        state: body.state,
        lga: body.lga,
        address: body.address,
        nearestLandmark: body.nearestLandmark,
        postalCode: body.postalCode,
        status: "pending_verification",
        publicHospitalRequested: isPublicHospital,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planCode: body.planCode as any,
        billingCycle: isPublicHospital ? "none" : (body.billingCycle as any),
        status: isPublicHospital ? "pending_approval" : "trialing",
        publicHospitalApprovalStatus: isPublicHospital ? "pending" : null,
      },
    });

    // First staff account = the Hospital Administrator, auto-assigned per PRD Table 1.
    const passwordHash = await hashSecret(body.adminPassword);
    const pin = generateTempPin();
    const pinHash = await hashSecret(pin);
    await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        staffIdDisplay: generateStaffId(1),
        name: body.adminName,
        email: body.email,
        role: "administrator",
        pinHash,
        passwordHash,
        mustChangePin: true,
      },
    });

    const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${verificationToken}`;
    await sendEmail(
      body.email,
      "Verify your IHOPS account",
      `Hello ${body.adminName},\n\nThanks for registering ${body.hospitalName} on IHOPS. We're glad to have you here — your account is almost ready to go.\n\nBefore anything else, we just need to confirm this is really your hospital's email address. Click the link below to verify it — this link expires in 24 hours, so it's best to do it now while it's fresh.\n\n${verifyUrl}\n\nOnce that's done, your ${isPublicHospital ? "application will move to review by our team" : "free trial starts immediately and you'll be able to sign in right away"}.\n\nOne more thing: we've set up a temporary Administrator PIN for the Attendance Kiosk — you'll use this alongside your Staff ID if you ever need to check in/out from the kiosk screen. Your temporary PIN is ${pin}. You'll be asked to set a personal PIN the first time you use it, so this one is just to get you started.\n\nIf you didn't request this, you can safely ignore this email — no account will be activated without email verification.\n\nWelcome aboard,\nThe IHOPS Team`,
    );

    // Notify the IHOPS team of every new hospital signup — including Public
    // Hospital applications, which the Super Admin Approval Queue already
    // surfaces in-app, but an email means it's not missed if nobody happens
    // to be looking at the console right then.
    const teamEmail = process.env.IHOPS_TEAM_EMAIL;
    if (teamEmail) {
      await sendEmail(
        teamEmail,
        `New hospital signup: ${body.hospitalName}`,
        `A new hospital just signed up on IHOPS.\n\nHospital: ${body.hospitalName} (${body.hospitalType})\nPlan: ${body.planCode}\nContact: ${body.contactPerson} <${body.email}>, ${body.phone}\nLocation: ${body.lga}, ${body.state}${isPublicHospital ? "\n\nThis is a Public Hospital application — it's now waiting on the applicant to verify their email, after which it will need manual review and approval in the Super Admin Approval Queue before they get access." : "\n\nThis is a paying-plan signup — their free trial has started and no action is needed from us unless they reach out."}`,
      );
    }

    res.status(201).json({
      tenantId: tenant.id,
      publicHospitalRequested: isPublicHospital,
      message: "Verification email sent.",
    });
  } catch (err) {
    next(err);
  }
});

// --- 9.1.3 Email Verification ---
router.get("/verify-email", async (req, res, next) => {
  try {
    const token = String(req.query.token || "");
    const tenant = await prisma.tenant.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!tenant)
      return res.status(400).json({ error: "Invalid verification link" });
    if (
      !tenant.emailVerificationExpires ||
      tenant.emailVerificationExpires < new Date()
    ) {
      return res
        .status(400)
        .json({ error: "Verification link has expired. Request a new one." });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: tenant.id },
    });
    const newStatus = tenant.publicHospitalRequested
      ? "pending_approval"
      : "trialing";

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: newStatus,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        trialEndsAt: tenant.publicHospitalRequested
          ? null
          : new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actionType: "tenant.verify_email",
      entityType: "Tenant",
      entityId: tenant.id,
    });

    res.json({
      tenantId: tenant.id,
      status: newStatus,
      message: tenant.publicHospitalRequested
        ? "Email verified. Your Public Hospital application is now pending IHOPS review."
        : `Email verified. Your ${trialDays}-day free trial has started.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/resend-verification", resendLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || "");
    const tenant = await prisma.tenant.findUnique({ where: { email } });
    if (!tenant || tenant.status !== "pending_verification") {
      return res.json({
        message:
          "If an account is pending verification, a new email has been sent.",
      });
    }
    const token = generateVerificationToken();
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${token}`;
    await sendEmail(
      email,
      "Verify your IHOPS account",
      `Hello,\n\nHere's the new verification link you asked for — click below to confirm your hospital's email address and finish setting up your IHOPS account. This link expires in 24 hours.\n\n${verifyUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\nThe IHOPS Team`,
    );
    res.json({ message: "Verification email resent." });
  } catch (err) {
    next(err);
  }
});

// --- Administrator email+password login (also used for desktop dashboard access) ---
router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const staff = await prisma.staff.findFirst({
      where: { email: body.email },
      include: { tenant: true },
    });
    if (
      !staff ||
      !staff.passwordHash ||
      !(await compareSecret(body.password, staff.passwordHash))
    ) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (staff.status !== "active")
      return res.status(403).json({ error: "Account is deactivated" });

    const token = signStaffToken({
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
    });
    await writeAuditLog({
      tenantId: staff.tenantId,
      staffId: staff.id,
      actionType: "auth.login",
      entityType: "Staff",
      entityId: staff.id,
    });

    res.json({
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        staffIdDisplay: staff.staffIdDisplay,
        mustChangePin: staff.mustChangePin,
      },
      tenant: {
        id: staff.tenant.id,
        hospitalName: staff.tenant.hospitalName,
        status: staff.tenant.status,
        setupWizardCompleted: staff.tenant.setupWizardCompleted,
        trialEndsAt: staff.tenant.trialEndsAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- PIN-based login: used by the Attendance Kiosk and general staff sign-in ---
router.post("/pin-login", async (req, res, next) => {
  try {
    const body = pinLoginSchema.parse(req.body);
    const tenant = await prisma.tenant.findUnique({
      where: { email: body.tenantEmail },
    });
    if (!tenant) return res.status(401).json({ error: "Hospital not found" });

    const staff = await prisma.staff.findUnique({
      where: {
        tenantId_staffIdDisplay: {
          tenantId: tenant.id,
          staffIdDisplay: body.staffIdDisplay,
        },
      },
    });
    if (!staff)
      return res.status(401).json({ error: "Invalid Staff ID or PIN" });

    if (staff.lockedUntil && staff.lockedUntil > new Date()) {
      return res.status(423).json({
        error: "Account temporarily locked due to repeated failed attempts",
      });
    }

    const ok = await compareSecret(body.pin, staff.pinHash);
    if (!ok) {
      const attempts = staff.failedPinAttempts + 1;
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          failedPinAttempts: attempts,
          lockedUntil:
            attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      return res.status(401).json({ error: "Invalid Staff ID or PIN" });
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedPinAttempts: 0, lockedUntil: null },
    });

    const token = signStaffToken({
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
    });
    res.json({
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        staffIdDisplay: staff.staffIdDisplay,
        mustChangePin: staff.mustChangePin,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Staff changes their own PIN after first login ---
router.post(
  "/change-pin",
  requireStaffAuth,
  allowWhenSuspended,
  async (req, res, next) => {
    try {
      const { newPin } = req.body;
      if (!/^\d{4,6}$/.test(newPin || ""))
        return res.status(400).json({ error: "PIN must be 4-6 digits" });
      const staff = await prisma.staff.findUnique({
        where: { id: req.staff!.id },
      });
      if (newPin === staff!.staffIdDisplay)
        return res.status(400).json({ error: "PIN cannot match Staff ID" });
      const pinHash = await hashSecret(newPin);
      await prisma.staff.update({
        where: { id: req.staff!.id },
        data: { pinHash, mustChangePin: false },
      });
      res.json({ message: "PIN updated" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/me",
  requireStaffAuth,
  allowWhenSuspended,
  async (req, res, next) => {
    try {
      const staff = await prisma.staff.findUnique({
        where: { id: req.staff!.id },
        include: { tenant: true, department: true },
      });
      if (!staff) return res.status(404).json({ error: "Not found" });
      res.json({
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          staffIdDisplay: staff.staffIdDisplay,
          mustChangePin: staff.mustChangePin,
          department: staff.department?.name || null,
        },
        tenant: {
          id: staff.tenant.id,
          hospitalName: staff.tenant.hospitalName,
          hospitalType: staff.tenant.hospitalType,
          status: staff.tenant.status,
          setupWizardCompleted: staff.tenant.setupWizardCompleted,
          trialEndsAt: staff.tenant.trialEndsAt,
          currency: staff.tenant.currency,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// --- Forgot password -------------------------------------------------------
// Always answers with the same message whether or not the address matches an
// account, so the endpoint can't be used to discover which emails are
// registered. Only accounts that actually have an email+password login
// (administrators) are eligible — PIN-only staff reset their PIN via their
// administrator instead.
router.post("/forgot-password", forgotLimiter, async (req, res, next) => {
  const generic = {
    message:
      "If an account exists for that email, we've sent a link to reset the password.",
  };
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const staff = await prisma.staff.findFirst({
      where: {
        email: { equals: email.trim(), mode: "insensitive" },
        passwordHash: { not: null },
        status: "active",
      },
    });
    if (staff) {
      await issuePasswordReset(staff);
      await writeAuditLog({
        tenantId: staff.tenantId,
        staffId: staff.id,
        actionType: "auth.password_reset_requested",
        entityType: "Staff",
        entityId: staff.id,
      });
    }
    res.json(generic);
  } catch (err) {
    // A malformed email is the caller's mistake and safe to report; anything
    // else (e.g. the mail provider is down) must not change the response.
    if ((err as any)?.name === "ZodError") return next(err);
    console.error("[forgot-password]", err);
    res.json(generic);
  }
});

// --- Complete a password reset from the emailed link -----------------------
router.post("/reset-password", authAttemptLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const staff = await prisma.staff.findFirst({
      where: {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!staff) {
      return res.status(400).json({
        error:
          "This reset link is invalid or has expired. Request a new one from the sign-in page.",
      });
    }
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        passwordHash: await hashSecret(newPassword),
        // One-time use: burn the token the moment it succeeds.
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });
    await writeAuditLog({
      tenantId: staff.tenantId,
      staffId: staff.id,
      actionType: "auth.password_reset_completed",
      entityType: "Staff",
      entityId: staff.id,
    });
    if (staff.email) {
      // Security notice — lets the real owner react if it wasn't them.
      sendEmail(
        staff.email,
        "Your IHOPS password was changed",
        `Hello ${staff.name},\n\nThe password for your IHOPS account was just changed. If that was you, there's nothing more to do.\n\nIf it wasn't you, reset your password again right away from the sign-in page and contact IHOPS support.\n\nThe IHOPS Team`,
      ).catch((e) => console.error("[reset-password] notice failed", e));
    }
    res.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    next(err);
  }
});

// --- Signed-in administrator changes their own password --------------------
router.post(
  "/change-password",
  requireStaffAuth,
  allowWhenSuspended,
  authAttemptLimiter,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(
        req.body,
      );
      const staff = await prisma.staff.findUnique({
        where: { id: req.staff!.id },
      });
      if (
        !staff?.passwordHash ||
        !(await compareSecret(currentPassword, staff.passwordHash))
      ) {
        return res
          .status(400)
          .json({ error: "Your current password is incorrect" });
      }
      if (currentPassword === newPassword)
        return res
          .status(400)
          .json({ error: "Choose a password different from your current one" });
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          passwordHash: await hashSecret(newPassword),
          passwordResetTokenHash: null,
          passwordResetExpires: null,
        },
      });
      await writeAuditLog({
        tenantId: staff.tenantId,
        staffId: staff.id,
        actionType: "auth.password_changed",
        entityType: "Staff",
        entityId: staff.id,
      });
      res.json({ message: "Password updated" });
    } catch (err) {
      next(err);
    }
  },
);

// --- Super Admin login (separate console, separate credential store & token secret) ---
router.post(
  "/super-admin/login",
  authAttemptLimiter,
  async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const admin = await prisma.superAdmin.findUnique({
        where: { email: body.email },
      });
      if (!admin || !(await compareSecret(body.password, admin.passwordHash))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const token = signSuperAdminToken({ superAdminId: admin.id });
      res.json({ token, superAdmin: { id: admin.id, name: admin.name } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
