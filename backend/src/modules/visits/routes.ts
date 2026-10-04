import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import {
  generateReminder,
  birthdayMessage,
} from "../../services/reminderService";
import { sendOnChannel } from "../../services/notificationService";

const router = Router();
router.use(requireStaffAuth);

function followUpDescription(v: {
  followUpType: string;
  followUpInDays: number | null;
  recurringEveryDays: number | null;
  recurringCount: number | null;
}) {
  if (v.followUpType === "return_in_days")
    return `return in ${v.followUpInDays} day(s)`;
  if (v.followUpType === "recurring")
    return `come in every ${v.recurringEveryDays} day(s), ${v.recurringCount} time(s) in total`;
  return "";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function waitMinutesFor(visit: { startedAt: Date; calledAt: Date | null }) {
  const end = visit.calledAt || new Date();
  return Math.round((end.getTime() - visit.startedAt.getTime()) / 60000);
}

// 9.2.5 Visit Queue / Active Visits — live shared queue
//
// `scope` selects which of the four Visits & Queue tabs this powers:
//   queue (default)  -> waiting, today only
//   active            -> in_consultation, today only
//   all               -> every visit today, any status
//   completed         -> closed, today only
// Omit `scope` and pass an explicit `status` for the original
// waiting+in_consultation "everything currently open" behaviour used
// elsewhere (e.g. polling for the live queue count).
router.get("/", requirePermission("visits.read"), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const scope = req.query.scope as string | undefined;
    const status = req.query.status as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;

    const where: any = { tenantId };
    if (scope === "queue") {
      where.status = "waiting";
      where.startedAt = { gte: startOfToday() };
    } else if (scope === "active") {
      where.status = "in_consultation";
      where.startedAt = { gte: startOfToday() };
    } else if (scope === "completed") {
      where.status = "closed";
      where.closedAt = { gte: startOfToday() };
    } else if (scope === "all") {
      where.startedAt = { gte: startOfToday() };
    } else if (status) {
      where.status = status;
    } else {
      where.status = { in: ["waiting", "in_consultation"] };
    }
    if (departmentId) where.departmentId = departmentId;

    const visits = await prisma.visit.findMany({
      where,
      include: { patient: true, doctor: true, department: true },
      orderBy: { startedAt: "asc" },
    });

    // Token numbers and New/Returning tags are derived, not stored — a
    // token is just this visit's position among today's visits in start
    // order; "New Patient" means this is that patient's first visit ever.
    const todaysVisitIds = (
      scope
        ? visits
        : await prisma.visit.findMany({
            where: { tenantId, startedAt: { gte: startOfToday() } },
            select: { id: true },
            orderBy: { startedAt: "asc" },
          })
    ).map((v: any) => v.id);
    const patientIds = [...new Set(visits.map((v) => v.patientId))];
    const firstVisitByPatient = await prisma.visit.findMany({
      where: { tenantId, patientId: { in: patientIds } },
      orderBy: { startedAt: "asc" },
      distinct: ["patientId"],
      select: { id: true, patientId: true },
    });
    const firstVisitIdByPatient = new Map(
      firstVisitByPatient.map((v) => [v.patientId, v.id]),
    );

    res.json({
      visits: visits.map((v) => ({
        ...v,
        tokenNo: `T-${String(todaysVisitIds.indexOf(v.id) + 1).padStart(4, "0")}`,
        waitMinutes:
          v.status === "waiting"
            ? waitMinutesFor(v)
            : v.status === "closed" && v.calledAt
              ? Math.round(
                  (v.calledAt.getTime() - v.startedAt.getTime()) / 60000,
                )
              : null,
        isNewPatient: firstVisitIdByPatient.get(v.patientId) === v.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// "Call Next" — moves a waiting patient into consultation. Deliberately NOT
// the same endpoint as the clinical update below: this is a front-desk
// queue action (any of admin/doctor/receptionist can do it), while entering
// treatment notes stays doctor+admin only.
router.post(
  "/:id/call",
  requirePermission("visits.call_next"),
  async (req, res, next) => {
    try {
      const visit = await prisma.visit.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!visit) return res.status(404).json({ error: "Visit not found" });
      if (visit.status !== "waiting")
        return res
          .status(400)
          .json({ error: "Only a waiting visit can be called" });

      const { doctorId } = req.body;
      const updated = await prisma.visit.update({
        where: { id: visit.id },
        data: {
          status: "in_consultation",
          calledAt: new Date(),
          ...(doctorId ? { doctorId } : {}),
        },
        include: { patient: true, doctor: true, department: true },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "visit.call_next",
        entityType: "Visit",
        entityId: visit.id,
      });
      res.json({ visit: updated });
    } catch (err) {
      next(err);
    }
  },
);

// Queue Insights — every figure here is computed from real Visit/Attendance/
// Staff data. Two things shown in some dashboard templates are deliberately
// NOT here:
//   - Named "Consultation Rooms" — there is no room model in this schema, so
//     this shows real "Doctors on Duty" (from Staff + today's Attendance)
//     instead of fabricated room numbers.
//   - "No Show Rate" — meaningless in a walk-in-only product with no
//     appointment/booking concept. Replaced with Avg. Consultation Time,
//     which calledAt now makes possible to compute honestly.
router.get(
  "/queue-insights",
  requirePermission("visits.read"),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId!;
      const today = startOfToday();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalToday,
        waiting,
        inConsultation,
        completedToday,
        todaysVisits,
        recentVisitsForPeakHour,
        doctors,
        todaysAttendance,
      ] = await Promise.all([
        prisma.visit.count({ where: { tenantId, startedAt: { gte: today } } }),
        prisma.visit.count({ where: { tenantId, status: "waiting" } }),
        prisma.visit.count({ where: { tenantId, status: "in_consultation" } }),
        prisma.visit.count({
          where: { tenantId, status: "closed", closedAt: { gte: today } },
        }),
        prisma.visit.findMany({
          where: { tenantId, startedAt: { gte: today } },
          select: {
            id: true,
            startedAt: true,
            calledAt: true,
            closedAt: true,
            status: true,
            patientId: true,
          },
        }),
        prisma.visit.findMany({
          where: { tenantId, startedAt: { gte: thirtyDaysAgo } },
          select: { startedAt: true },
        }),
        prisma.staff.findMany({
          where: { tenantId, role: "doctor", status: "active" },
        }),
        prisma.attendance.findMany({
          where: { tenantId, date: today },
          select: { staffId: true, checkInAt: true, checkOutAt: true },
        }),
      ]);

      // Wait time: calledAt - startedAt for visits already called; still-waiting
      // visits use "now" so the average reflects live queue pressure too.
      const waitSamples = todaysVisits
        .map((v) => {
          const end =
            v.calledAt || (v.status === "waiting" ? new Date() : null);
          return end
            ? Math.round((end.getTime() - v.startedAt.getTime()) / 60000)
            : null;
        })
        .filter((n): n is number => n !== null);
      const avgWaitMinutes = waitSamples.length
        ? Math.round(
            waitSamples.reduce((a, b) => a + b, 0) / waitSamples.length,
          )
        : 0;
      const longestWaitMinutes = waitSamples.length
        ? Math.max(...waitSamples)
        : 0;

      const consultSamples = todaysVisits
        .filter((v) => v.calledAt && v.closedAt)
        .map((v) =>
          Math.round((v.closedAt!.getTime() - v.calledAt!.getTime()) / 60000),
        );
      const avgConsultationMinutes = consultSamples.length
        ? Math.round(
            consultSamples.reduce((a, b) => a + b, 0) / consultSamples.length,
          )
        : 0;

      // Peak hour over the last 30 days, not just today — a single day is too
      // sparse to call a "pattern."
      const hourCounts = new Array(24).fill(0);
      for (const v of recentVisitsForPeakHour)
        hourCounts[v.startedAt.getHours()]++;
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
      const formatHour = (h: number) => {
        const period = h < 12 ? "AM" : "PM";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12} ${period}`;
      };

      // New vs Returning, today — replaces the reference's 4-way "visit type"
      // breakdown (Follow-up/New/Walk-in/Appointment), which this schema can't
      // honestly distinguish beyond "has this patient been seen before."
      const patientIds = [...new Set(todaysVisits.map((v) => v.patientId))];
      const firstVisitByPatient = await prisma.visit.findMany({
        where: { tenantId, patientId: { in: patientIds } },
        orderBy: { startedAt: "asc" },
        distinct: ["patientId"],
        select: { id: true, patientId: true },
      });
      const firstVisitIdByPatientId = new Map(
        firstVisitByPatient.map((f) => [f.patientId, f.id]),
      );
      // A visit counts as "New Patient" if its id matches that patient's
      // earliest-ever visit id.
      const newCount = todaysVisits.filter(
        (v) => (v as any).id === firstVisitIdByPatientId.get(v.patientId),
      ).length;

      const attendanceByStaff = new Map(
        todaysAttendance.map((a) => [a.staffId, a]),
      );
      const activeVisitsByDoctor = await prisma.visit.groupBy({
        by: ["doctorId"],
        where: { tenantId, status: "in_consultation" },
        _count: { doctorId: true },
      });
      const seenTodayByDoctor = await prisma.visit.groupBy({
        by: ["doctorId"],
        where: { tenantId, status: "closed", closedAt: { gte: today } },
        _count: { doctorId: true },
      });
      const inConsultCountMap = new Map(
        activeVisitsByDoctor.map((r) => [r.doctorId, r._count.doctorId]),
      );
      const seenCountMap = new Map(
        seenTodayByDoctor.map((r) => [r.doctorId, r._count.doctorId]),
      );

      const doctorsOnDuty = doctors.map((d) => {
        const attendance = attendanceByStaff.get(d.id);
        const checkedIn = !!attendance?.checkInAt && !attendance.checkOutAt;
        const inConsult = (inConsultCountMap.get(d.id) || 0) > 0;
        return {
          id: d.id,
          name: d.name,
          departmentId: d.departmentId,
          status: !checkedIn
            ? "off_duty"
            : inConsult
              ? "in_consultation"
              : "available",
          seenToday: seenCountMap.get(d.id) || 0,
        };
      });

      res.json({
        totalWalkInsToday: totalToday,
        currentlyWaiting: waiting,
        inConsultation,
        completedToday,
        completedPct: totalToday
          ? Math.round((completedToday / totalToday) * 100 * 10) / 10
          : 0,
        avgWaitMinutes,
        longestWaitMinutes,
        avgConsultationMinutes,
        peakHour: recentVisitsForPeakHour.length
          ? `${formatHour(peakHour)} – ${formatHour((peakHour + 1) % 24)}`
          : null,
        visitMixToday: {
          newPatients: newCount,
          returning: todaysVisits.length - newCount,
        },
        doctorsOnDuty,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Start Visit — patient joins the queue at status Waiting.
router.post("/", requirePermission("visits.start"), async (req, res, next) => {
  try {
    const { patientId, departmentId, doctorId } = req.body;

    // Business rule 11.3: only one active (non-closed) visit per patient per
    // day by default; override requires an explicit flag from an authorised role.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existingOpenToday = await prisma.visit.findFirst({
      where: {
        tenantId: req.tenantId!,
        patientId,
        status: { not: "closed" },
        startedAt: { gte: startOfDay },
      },
    });
    if (existingOpenToday && !req.body.overrideSameDayVisit) {
      return res.status(409).json({
        error: "SAME_DAY_VISIT_EXISTS",
        message: "This patient already has an open visit today.",
        visitId: existingOpenToday.id,
      });
    }

    const visit = await prisma.visit.create({
      data: {
        tenantId: req.tenantId!,
        patientId,
        departmentId,
        doctorId,
        status: "waiting",
      },
      include: { patient: true },
    });
    await writeAuditLog({
      tenantId: req.tenantId,
      staffId: req.staff!.id,
      actionType: "visit.start",
      entityType: "Visit",
      entityId: visit.id,
    });
    res.status(201).json({ visit });
  } catch (err) {
    next(err);
  }
});

// 9.2.6 Active Visit — Doctor view updates: assign doctor, treatment note, follow-up
router.patch(
  "/:id/clinical",
  requirePermission("visits.update_clinical"),
  async (req, res, next) => {
    try {
      const {
        doctorId,
        treatmentNote,
        followUpType,
        followUpInDays,
        recurringEveryDays,
        recurringCount,
      } = req.body;
      const visit = await prisma.visit.update({
        where: { id: req.params.id },
        data: {
          doctorId,
          treatmentNote,
          followUpType,
          followUpInDays,
          recurringEveryDays,
          recurringCount,
          status: "in_consultation",
        },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "visit.update_clinical",
        entityType: "Visit",
        entityId: visit.id,
      });
      res.json({ visit });
    } catch (err) {
      next(err);
    }
  },
);

// 9.2.7 Close Visit — captures Payment Status, posts to Finance, triggers reminders.
router.post(
  "/:id/close",
  requirePermission("visits.close"),
  async (req, res, next) => {
    try {
      const visit = await prisma.visit.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
        include: { patient: true },
      });
      if (!visit) return res.status(404).json({ error: "Visit not found" });
      if (visit.status === "closed")
        return res.status(400).json({ error: "Visit already closed" });

      const {
        paymentStatus,
        amount,
        method,
        insuranceProvider,
        expectedInsuranceAmount,
      } = req.body;
      if (!paymentStatus)
        return res.status(400).json({
          error: "Payment Status is required before a visit can be closed",
        });

      let balance: number | null = null;
      if (paymentStatus === "partially_paid") {
        if (typeof amount !== "number")
          return res
            .status(400)
            .json({ error: "Amount Paid is required for Partially Paid" });
        // Balance requires a total/expected — in Version 1 that is the amount the
        // staff also enters; we compute balance as expectedTotal - amountPaid when provided.
        balance =
          typeof req.body.expectedTotal === "number"
            ? req.body.expectedTotal - amount
            : null;
      }
      if (
        paymentStatus === "covered_by_insurance" &&
        (!insuranceProvider || !(expectedInsuranceAmount > 0))
      ) {
        return res.status(400).json({
          error:
            "Insurance Provider and a positive Expected Amount are required",
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
      });

      let payment;
      try {
        // Interactive transaction (not the array form) on purpose: we need
        // the payment.create to only run if the conditional status update
        // actually matched a row, and array-form $transaction can't branch —
        // every statement in the array runs regardless of the others' results.
        payment = await prisma.$transaction(async (tx) => {
          // The where clause includes `status: { not: "closed" }` alongside
          // the unique id — this is what actually prevents the double-close,
          // not just the pre-check above. That check-then-act pattern has a
          // real race: two near-simultaneous close requests (a double-click,
          // or a slow network prompting a retry) can both read "not yet
          // closed" before either commits, and the second one used to crash
          // on Payment's unique visitId constraint instead of failing cleanly.
          const updated = await tx.visit.updateMany({
            where: { id: visit.id, status: { not: "closed" } },
            data: { status: "closed", closedAt: new Date() },
          });
          if (updated.count === 0) {
            // Someone else closed this visit between our pre-check and now.
            // Throwing here rolls back the whole transaction — nothing
            // commits, and we never reach payment.create.
            throw Object.assign(new Error("Visit already closed"), {
              status: 400,
            });
          }
          return tx.payment.create({
            data: {
              tenantId: req.tenantId!,
              visitId: visit.id,
              status: paymentStatus,
              amount:
                paymentStatus === "paid" || paymentStatus === "partially_paid"
                  ? amount
                  : null,
              balance,
              method: paymentStatus === "paid" ? method : undefined,
              insuranceProvider:
                paymentStatus === "covered_by_insurance"
                  ? insuranceProvider
                  : undefined,
              expectedInsuranceAmount:
                paymentStatus === "covered_by_insurance"
                  ? expectedInsuranceAmount
                  : undefined,
            },
          });
        });
      } catch (err: any) {
        if (err.status === 400)
          return res.status(400).json({ error: err.message });
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          // Belt-and-suspenders: even if the count check above were somehow
          // bypassed, a unique-constraint hit on Payment.visitId means the
          // same thing — already closed — not a server error.
          return res.status(400).json({ error: "Visit already closed" });
        }
        throw err;
      }

      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "visit.close",
        entityType: "Visit",
        entityId: visit.id,
        metadata: { paymentStatus },
      });

      // Trigger AI reminder pipeline if a follow-up requirement was captured.
      let reminderQueued = false;
      let missingContact = false;
      if (visit.followUpType !== "none" && tenant?.aiRemindersEnabled) {
        const patient = visit.patient;
        const hasContact =
          (patient.preferredChannel === "email" && patient.email) ||
          (patient.preferredChannel !== "email" && patient.phone);

        if (!hasContact) {
          missingContact = true;
        } else {
          const description = followUpDescription(visit as any);
          const { body } = await generateReminder({
            patientName: patient.name,
            guardianName: patient.guardianName,
            hospitalName: tenant.hospitalName,
            hospitalType: tenant.hospitalType,
            treatmentNote: visit.treatmentNote || "",
            followUpDescription: description,
            species: patient.species,
          });
          const to =
            patient.preferredChannel === "email"
              ? patient.email!
              : patient.phone!;
          const sendResult = await sendOnChannel(
            patient.preferredChannel as any,
            to,
            body,
            req.tenantId!,
          );
          await prisma.communicationLog.create({
            data: {
              tenantId: req.tenantId!,
              patientId: patient.id,
              visitId: visit.id,
              trigger: "ai_followup",
              channel: patient.preferredChannel as any,
              messageBody: body,
              status: sendResult.ok ? "sent" : "failed",
              failureReason: sendResult.error,
              sentAt: sendResult.ok ? new Date() : null,
            },
          });
          reminderQueued = true;
        }
      }

      res.json({ payment, reminderQueued, missingContact });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
