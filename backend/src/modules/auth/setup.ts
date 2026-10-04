import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission,
} from "../../middleware/auth";
import { generateStaffId, generateTempPin } from "../../lib/ids";
import { hashSecret } from "../../lib/hash";
import { sendSms, sendEmail } from "../../services/notificationService";

const router = Router();

// 9.1.4 First-Time Setup Wizard — must create at least one department before
// the Dashboard is usable; other steps are skippable.
router.post(
  "/setup/departments",
  requireStaffAuth,
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const { names } = req.body as { names: string[] };
      if (!names?.length)
        return res
          .status(400)
          .json({ error: "At least one department is required" });
      const created = await Promise.all(
        names.map((name) =>
          prisma.department.create({ data: { tenantId: req.tenantId!, name } }),
        ),
      );
      res.status(201).json({ departments: created });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/setup/invite-staff",
  requireStaffAuth,
  requirePermission("staff.manage"),
  async (req, res, next) => {
    try {
      const { name, role, email, phone, departmentId } = req.body;
      const count = await prisma.staff.count({
        where: { tenantId: req.tenantId! },
      });
      const pin = generateTempPin();
      const pinHash = await hashSecret(pin);
      const staff = await prisma.staff.create({
        data: {
          tenantId: req.tenantId!,
          staffIdDisplay: generateStaffId(count + 1),
          name,
          role,
          email,
          phone,
          departmentId,
          pinHash,
          mustChangePin: true,
        },
      });
      if (phone)
        await sendSms(
          phone,
          `Welcome to IHOPS. Your Staff ID is ${staff.staffIdDisplay} and temporary PIN is ${pin}. You'll set a new PIN on first check-in.`,
        );
      if (email) {
        await sendEmail(
          email,
          "Your IHOPS staff account is ready",
          `Hello ${name},\n\nYou've been added as a staff member on IHOPS, with the role of ${role.replace("_", " ")}. Here's what you need to sign in for the first time:\n\nStaff ID: ${staff.staffIdDisplay}\nTemporary PIN: ${pin}\n\nYou can sign in from the Staff PIN option on the login screen, using your hospital's email address, your Staff ID above, and this temporary PIN. You'll be asked to choose your own personal PIN the moment you sign in — the one above is only for that first login, so don't worry about memorizing it long-term.\n\nIf you weren't expecting this, or think it was sent to you by mistake, just ignore this email or reach out to your hospital's administrator.\n\nWelcome to the team,\nThe IHOPS Team`,
        );
      }
      res
        .status(201)
        .json({
          staff: {
            id: staff.id,
            staffIdDisplay: staff.staffIdDisplay,
            name: staff.name,
            role: staff.role,
          },
        });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/setup/communication-channels",
  requireStaffAuth,
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const { workingHours } = req.body;
      await prisma.tenant.update({
        where: { id: req.tenantId! },
        data: { workingHours: JSON.stringify(workingHours || {}) },
      });
      res.json({ message: "Saved" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/setup/complete",
  requireStaffAuth,
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const deptCount = await prisma.department.count({
        where: { tenantId: req.tenantId! },
      });
      if (deptCount === 0)
        return res
          .status(400)
          .json({
            error: "At least one department must exist before finishing setup",
          });
      await prisma.tenant.update({
        where: { id: req.tenantId! },
        data: { setupWizardCompleted: true },
      });
      res.json({ message: "Setup complete" });
    } catch (err) {
      next(err);
    }
  },
);

// Live status check — used by the Pending Approval screen to detect an
// approval that happened mid-session without requiring re-login.
router.get(
  "/tenant-status",
  requireStaffAuth,
  allowWhenSuspended,
  async (req, res, next) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
        include: { subscription: true },
      });
      res.json({
        status: tenant!.status,
        setupWizardCompleted: tenant!.setupWizardCompleted,
        trialEndsAt: tenant!.trialEndsAt,
        gracePeriodEndsAt: tenant!.gracePeriodEndsAt,
        subscription: tenant!.subscription,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
