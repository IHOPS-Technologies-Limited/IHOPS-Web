import { Router } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import { generateStaffId, generateTempPin } from "../../lib/ids";
import { hashSecret, compareSecret } from "../../lib/hash";
import { sendSms, sendEmail } from "../../services/notificationService";

const router = Router();
router.use(requireStaffAuth);

// 9.4.1 Staff Directory
router.get(
  "/staff",
  requirePermission("staff.manage"),
  async (req, res, next) => {
    try {
      const staff = await prisma.staff.findMany({
        where: { tenantId: req.tenantId! },
        include: { department: true },
        orderBy: { createdAt: "asc" },
      });
      res.json({
        staff: staff.map((s) => ({
          id: s.id,
          staffIdDisplay: s.staffIdDisplay,
          name: s.name,
          email: s.email,
          phone: s.phone,
          department: s.department?.name,
          departmentId: s.departmentId,
          role: s.role,
          status: s.status,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/staff",
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
          `Your IHOPS Staff ID: ${staff.staffIdDisplay}, temporary PIN: ${pin}`,
        );
      if (email) {
        await sendEmail(
          email,
          "Your IHOPS staff account is ready",
          `Hello ${name},\n\nYou've been added as a staff member on IHOPS, with the role of ${role.replace("_", " ")}. Here's what you need to sign in for the first time:\n\nStaff ID: ${staff.staffIdDisplay}\nTemporary PIN: ${pin}\n\nYou can sign in from the Staff PIN option on the login screen, using your hospital's email address, your Staff ID above, and this temporary PIN. You'll be asked to choose your own personal PIN the moment you sign in — the one above is only for that first login, so don't worry about memorizing it long-term.\n\nIf you weren't expecting this, or think it was sent to you by mistake, just ignore this email or reach out to your hospital's administrator.\n\nWelcome to the team,\nThe IHOPS Team`,
        );
      }
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "staff.create",
        entityType: "Staff",
        entityId: staff.id,
      });
      res
        .status(201)
        .json({
          staff: { id: staff.id, staffIdDisplay: staff.staffIdDisplay },
        });
    } catch (err) {
      next(err);
    }
  },
);

// Update a staff member's department — the original create form never
// collected one either, but department was already a real field on Staff;
// this closes the gap so it can be set after the fact too, not just at
// creation.
router.patch(
  "/staff/:id/department",
  requirePermission("staff.manage"),
  async (req, res, next) => {
    try {
      const { departmentId } = req.body;
      const existing = await prisma.staff.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing)
        return res.status(404).json({ error: "Staff member not found" });
      if (departmentId) {
        const dept = await prisma.department.findFirst({
          where: { id: departmentId, tenantId: req.tenantId! },
        });
        if (!dept)
          return res.status(400).json({ error: "Department not found" });
      }
      const staff = await prisma.staff.update({
        where: { id: existing.id },
        data: { departmentId: departmentId || null },
        include: { department: true },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "staff.update_department",
        entityType: "Staff",
        entityId: staff.id,
        metadata: { departmentId },
      });
      res.json({
        staff: {
          id: staff.id,
          department: staff.department?.name,
          departmentId: staff.departmentId,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/staff/:id/reset-pin",
  requirePermission("staff.reset_pin"),
  async (req, res, next) => {
    try {
      const pin = generateTempPin();
      const pinHash = await hashSecret(pin);
      const staff = await prisma.staff.update({
        where: { id: req.params.id },
        data: {
          pinHash,
          mustChangePin: true,
          failedPinAttempts: 0,
          lockedUntil: null,
        },
      });
      if (staff.phone)
        await sendSms(
          staff.phone,
          `Your IHOPS PIN was reset. New temporary PIN: ${pin}`,
        );
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "staff.reset_pin",
        entityType: "Staff",
        entityId: staff.id,
      });
      res.json({ message: "PIN reset and sent to staff member" });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/staff/:id",
  requirePermission("staff.delete"),
  async (req, res, next) => {
    try {
      await prisma.staff.update({
        where: { id: req.params.id },
        data: { status: "inactive" },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "staff.deactivate",
        entityType: "Staff",
        entityId: req.params.id,
      });
      res.json({ message: "Staff member deactivated" });
    } catch (err) {
      next(err);
    }
  },
);

// 9.4.2 Attendance Kiosk — PIN-only check in/out.
router.post(
  "/attendance/check-in",
  requirePermission("attendance.self_check"),
  async (req, res, next) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.attendance.findFirst({
        where: { tenantId: req.tenantId!, staffId: req.staff!.id, date: today },
      });
      if (existing?.checkInAt)
        return res.status(409).json({ error: "Already checked in today" });

      const record = existing
        ? await prisma.attendance.update({
            where: { id: existing.id },
            data: { checkInAt: new Date() },
          })
        : await prisma.attendance.create({
            data: {
              tenantId: req.tenantId!,
              staffId: req.staff!.id,
              date: today,
              checkInAt: new Date(),
            },
          });
      res.json({ attendance: record });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/attendance/check-out",
  requirePermission("attendance.self_check"),
  async (req, res, next) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.attendance.findFirst({
        where: { tenantId: req.tenantId!, staffId: req.staff!.id, date: today },
      });
      if (!existing?.checkInAt)
        return res
          .status(400)
          .json({ error: "You must check in before checking out" });
      if (existing.checkOutAt)
        return res.status(409).json({ error: "Already checked out today" });

      const checkOutAt = new Date();
      const hoursWorked =
        (checkOutAt.getTime() - existing.checkInAt.getTime()) /
        (1000 * 60 * 60);
      const record = await prisma.attendance.update({
        where: { id: existing.id },
        data: { checkOutAt, hoursWorked },
      });
      res.json({ attendance: record });
    } catch (err) {
      next(err);
    }
  },
);

// Manual correction path for lost-connectivity edge case (Section 17.3), with audit trail.
router.patch(
  "/attendance/:id/correct",
  requirePermission("attendance.correct"),
  async (req, res, next) => {
    try {
      const { checkInAt, checkOutAt, note } = req.body;
      const data: any = { correctedBy: req.staff!.id, correctionNote: note };
      if (checkInAt) data.checkInAt = new Date(checkInAt);
      if (checkOutAt) data.checkOutAt = new Date(checkOutAt);
      if (data.checkInAt && data.checkOutAt)
        data.hoursWorked =
          (data.checkOutAt.getTime() - data.checkInAt.getTime()) /
          (1000 * 60 * 60);
      const record = await prisma.attendance.update({
        where: { id: req.params.id },
        data,
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "attendance.correct",
        entityType: "Attendance",
        entityId: record.id,
        metadata: { note },
      });
      res.json({ attendance: record });
    } catch (err) {
      next(err);
    }
  },
);

// 9.4.3 Attendance Dashboard & Reports
router.get(
  "/attendance/dashboard",
  requirePermission("attendance.manage"),
  async (req, res, next) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [todayRecords, allStaff, weekRecords] = await Promise.all([
        prisma.attendance.findMany({
          where: { tenantId: req.tenantId!, date: today },
          include: { staff: true },
        }),
        prisma.staff.findMany({
          where: { tenantId: req.tenantId!, status: "active" },
        }),
        prisma.attendance.findMany({
          where: { tenantId: req.tenantId!, date: { gte: weekAgo } },
          include: { staff: true },
        }),
      ]);

      const onDuty = todayRecords.filter((r) => r.checkInAt && !r.checkOutAt);
      const checkedOut = todayRecords.filter((r) => r.checkOutAt);
      const checkedInIds = new Set(todayRecords.map((r) => r.staffId));
      const absent = allStaff.filter((s) => !checkedInIds.has(s.id));
      const totalHoursToday = todayRecords.reduce(
        (sum, r) => sum + (r.hoursWorked || 0),
        0,
      );

      res.json({
        onDuty: onDuty.map((r) => ({
          name: r.staff.name,
          checkInAt: r.checkInAt,
        })),
        checkedOut: checkedOut.map((r) => ({
          name: r.staff.name,
          hoursWorked: r.hoursWorked,
        })),
        absent: absent.map((s) => ({ name: s.name })),
        totalHoursToday,
        weeklyGrid: weekRecords.map((r) => ({
          staff: r.staff.name,
          date: r.date,
          hoursWorked: r.hoursWorked,
          isAbsentFlagged: r.isAbsentFlagged,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/attendance/export",
  requirePermission("attendance.manage"),
  async (req, res, next) => {
    try {
      const records = await prisma.attendance.findMany({
        where: { tenantId: req.tenantId! },
        include: { staff: true },
        orderBy: { date: "desc" },
      });
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(
        records.map((r) => ({
          Staff: r.staff.name,
          Date: r.date,
          CheckIn: r.checkInAt,
          CheckOut: r.checkOutAt,
          HoursWorked: r.hoursWorked,
          Absent: r.isAbsentFlagged,
        })),
      );
      XLSX.utils.book_append_sheet(wb, sheet, "Attendance");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=ihops-attendance-export.xlsx",
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

// Departments (used across Patients/Visits/Workforce screens for assignment).
// Active doctors, name only — used to populate "assign a doctor" dropdowns
// when starting or updating a visit. Deliberately separate from GET /staff
// (which requires staff.manage, administrator-only) since receptionist
// needs this at intake and shouldn't need full staff-management rights to
// see a doctor's name.
router.get(
  "/doctors",
  requirePermission("workforce.read_doctors"),
  async (req, res, next) => {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const doctors = await prisma.staff.findMany({
        where: {
          tenantId: req.tenantId!,
          role: "doctor",
          status: "active",
          ...(departmentId ? { departmentId } : {}),
        },
        select: { id: true, name: true, departmentId: true },
        orderBy: { name: "asc" },
      });
      res.json({ doctors });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/departments", async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { tenantId: req.tenantId! },
    });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});
