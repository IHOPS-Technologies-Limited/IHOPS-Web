import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth } from "../../middleware/auth";

const router = Router();
router.use(requireStaffAuth);

// 9.2.1 Dashboard — role-aware home screen.
router.get("/", async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (req.staff!.role === "doctor") {
      const queue = await prisma.visit.findMany({
        where: {
          tenantId,
          doctorId: req.staff!.id,
          status: { in: ["waiting", "in_consultation"] },
        },
        include: { patient: true },
        orderBy: { startedAt: "asc" },
      });
      return res.json({ role: "doctor", myQueue: queue });
    }

    const [
      walkInsToday,
      waiting,
      activeVisits,
      followUpsDue,
      revenueToday,
      staffOnDuty,
      recentVisits,
      // Added: split counts that power the "Today's Visit Mix" donut chart on
      // the new dashboard design. Purely additive — every field above this
      // comment is unchanged from the original endpoint.
      inConsultationCount,
      closedTodayCount,
    ] = await Promise.all([
      prisma.visit.count({
        where: { tenantId, startedAt: { gte: startOfToday } },
      }),
      prisma.visit.count({ where: { tenantId, status: "waiting" } }),
      prisma.visit.count({
        where: { tenantId, status: { in: ["waiting", "in_consultation"] } },
      }),
      prisma.visit.count({
        where: {
          tenantId,
          followUpType: { not: "none" },
          status: "closed",
          closedAt: { gte: startOfToday },
        },
      }),
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: { in: ["paid", "partially_paid"] },
          createdAt: { gte: startOfToday },
        },
        _sum: { amount: true },
      }),
      prisma.attendance.count({
        where: {
          tenantId,
          date: startOfToday,
          checkInAt: { not: null },
          checkOutAt: null,
        },
      }),
      prisma.visit.findMany({
        where: { tenantId },
        orderBy: { startedAt: "desc" },
        take: 8,
        include: { patient: true, doctor: true, department: true },
      }),
      prisma.visit.count({ where: { tenantId, status: "in_consultation" } }),
      prisma.visit.count({
        where: { tenantId, status: "closed", closedAt: { gte: startOfToday } },
      }),
    ]);

    // Operational alert: visit open >24h (Section 17.1)
    const stale = await prisma.visit.findMany({
      where: {
        tenantId,
        status: { not: "closed" },
        startedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { patient: true },
    });

    res.json({
      role: req.staff!.role,
      walkInsToday,
      patientsWaiting: waiting,
      activeVisits,
      followUpsDue,
      revenueToday: revenueToday._sum.amount || 0,
      staffOnDuty,
      recentActivity: recentVisits.map((v) => ({
        visitId: v.id,
        patient: v.patient.name,
        status: v.status,
        startedAt: v.startedAt,
        doctor: v.doctor?.name || null,
        department: v.department?.name || null,
      })),
      alerts: stale.map((v) => ({
        visitId: v.id,
        patient: v.patient.name,
        startedAt: v.startedAt,
        message: "Visit open for more than 24 hours",
      })),
      // Added fields — visit-status breakdown for today's visit mix.
      visitMix: {
        waiting,
        inConsultation: inConsultationCount,
        closedToday: closedTodayCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
