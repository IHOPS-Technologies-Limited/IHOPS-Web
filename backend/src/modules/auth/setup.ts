import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  requireStaffAuth,
  allowWhenSuspended,
  requirePermission,
} from "../../middleware/auth";
import { generateTempPin } from "../../lib/ids";
import { nextStaffIdDisplay, blankToNull } from "../../services/staffService";
import { hashSecret } from "../../lib/hash";
import { sendSms, sendEmail } from "../../services/notificationService";
import { writeAuditLog } from "../../middleware/audit";

const router = Router();

// 9.1.4 First-Time Setup Wizard — must create at least one department before
// the Dashboard is usable; other steps are skippable.
//
// IDEMPOTENT by design. The wizard (and Settings → Departments) can submit a
// name that already exists — a retry after a flaky connection, a double click,
// a name the hospital already has, or a duplicate typed twice in the same
// request. Department has @@unique([tenantId, name]), so the old
// Promise.all(create()) turned every one of those into a Prisma P2002 → 500
// "A database error occurred", and left the wizard stuck on step 1.
//
// Now: names are trimmed, de-duplicated (case-insensitively, so "Pharmacy" and
// "pharmacy" can't both be created), checked against what the hospital already
// has, and only the genuinely new ones are inserted. The response always
// includes the hospital's full department list plus which names were
// `created` vs `skipped`, so callers can proceed (wizard) or tell the user
// "already exists" (Settings).
const MAX_DEPARTMENTS_PER_REQUEST = 30;
const MAX_DEPARTMENT_NAME_LENGTH = 80;

router.post(
  "/setup/departments",
  requireStaffAuth,
  requirePermission("settings.manage"),
  async (req, res, next) => {
    try {
      const raw = (req.body as { names?: unknown })?.names;
      if (!Array.isArray(raw) || raw.length === 0)
        return res
          .status(400)
          .json({ error: "At least one department is required" });
      if (raw.length > MAX_DEPARTMENTS_PER_REQUEST)
        return res.status(400).json({
          error: `You can add at most ${MAX_DEPARTMENTS_PER_REQUEST} departments at a time`,
        });

      // Normalise: strings only, trimmed, internal whitespace collapsed,
      // empties dropped, case-insensitive de-dupe keeping first spelling.
      const seen = new Set<string>();
      const requested: string[] = [];
      for (const item of raw) {
        if (typeof item !== "string") continue;
        const name = item.trim().replace(/\s+/g, " ");
        if (!name) continue;
        if (name.length > MAX_DEPARTMENT_NAME_LENGTH)
          return res.status(400).json({
            error: `Department names must be ${MAX_DEPARTMENT_NAME_LENGTH} characters or fewer`,
          });
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        requested.push(name);
      }
      if (requested.length === 0)
        return res
          .status(400)
          .json({ error: "At least one department name is required" });

      const tenantId = req.tenantId!;
      const existing = await prisma.department.findMany({
        where: { tenantId },
        select: { name: true },
      });
      const existingKeys = new Set(existing.map((d) => d.name.toLowerCase()));
      const toCreate = requested.filter(
        (n) => !existingKeys.has(n.toLowerCase()),
      );
      const skipped = requested.filter((n) =>
        existingKeys.has(n.toLowerCase()),
      );

      if (toCreate.length > 0) {
        // skipDuplicates covers the remaining race (two requests for the same
        // new name landing at the same instant) without throwing P2002.
        await prisma.department.createMany({
          data: toCreate.map((name) => ({ tenantId, name })),
          skipDuplicates: true,
        });
        await writeAuditLog({
          tenantId,
          staffId: req.staff!.id,
          actionType: "department.create",
          entityType: "Department",
          metadata: { names: toCreate },
        });
      }

      const departments = await prisma.department.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
      });
      res.status(toCreate.length > 0 ? 201 : 200).json({
        departments,
        created: toCreate,
        skipped,
      });
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
      const { name, role } = req.body;
      const email = blankToNull(req.body.email);
      const phone = blankToNull(req.body.phone);
      const departmentId = blankToNull(req.body.departmentId);
      if (!name || !role)
        return res.status(400).json({ error: "Name and role are required" });
      const pin = generateTempPin();
      const pinHash = await hashSecret(pin);
      const staff = await prisma.staff.create({
        data: {
          tenantId: req.tenantId!,
          staffIdDisplay: await nextStaffIdDisplay(req.tenantId!),
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
      res.status(201).json({
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
        return res.status(400).json({
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
