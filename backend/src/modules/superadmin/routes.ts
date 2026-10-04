import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireSuperAdminAuth } from "../../middleware/auth";
import { sendEmail } from "../../services/notificationService";

const router = Router();
router.use(requireSuperAdminAuth);

// 9.6.1 Public Hospital Approval Queue
router.get("/approvals", async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { status: "pending_approval" },
      include: { subscription: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      applications: tenants.map((t) => ({
        id: t.id,
        hospitalName: t.hospitalName,
        hospitalType: t.hospitalType,
        state: t.state,
        lga: t.lga,
        contactPerson: t.contactPerson,
        phone: t.phone,
        supportingDocumentUrl: t.supportingDocumentUrl,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Approval requires confirmation that the reviewer opened the document/details —
// the queue does not allow a blind bulk-approve (Section 11.4).
router.post("/approvals/:id/approve", async (req, res, next) => {
  try {
    const { reviewedDetails } = req.body;
    if (!reviewedDetails)
      return res
        .status(400)
        .json({
          error:
            "Reviewer must confirm the application details were opened before approving",
        });

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: "active" },
    });
    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: {
        status: "active",
        publicHospitalApprovalStatus: "approved",
        approvedBySuperAdminId: req.superAdmin!.id,
        approvedAt: new Date(),
      },
    });
    await sendEmail(
      tenant.email,
      "Your IHOPS Public Hospital application was approved",
      `Congratulations!\n\n${tenant.hospitalName}'s Public Hospital application has been reviewed and approved. You now have full access to IHOPS at no cost, for as long as you remain eligible under the Public Hospital plan.\n\nYou can sign in right away to pick up where you left off — if your team hasn't finished the First-Time Setup Wizard yet (departments, staff accounts), that's the best place to continue:\n\n${process.env.APP_BASE_URL}/login\n\nWelcome to IHOPS — we're glad to have ${tenant.hospitalName} on board.\n\nThe IHOPS Team`,
    );
    res.json({ message: "Approved" });
  } catch (err) {
    next(err);
  }
});

router.post("/approvals/:id/reject", async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason)
      return res.status(400).json({ error: "A rejection reason is required" });
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: "rejected" },
    });
    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: {
        publicHospitalApprovalStatus: "rejected",
        rejectionReason: reason,
        approvedBySuperAdminId: req.superAdmin!.id,
        approvedAt: new Date(),
      },
    });
    await sendEmail(
      tenant.email,
      "Your IHOPS Public Hospital application was not approved",
      `Hello,\n\nAfter reviewing ${tenant.hospitalName}'s Public Hospital application, we're not able to approve it at this time.\n\nReason given: ${reason}\n\nThis doesn't mean IHOPS is off the table — you're welcome to register again under our Starter or Standard plan instead, both of which include a free 7-day trial and give you the same clinical and operational tooling.\n\nIf you have questions about this decision or believe some information was missed, feel free to reply to this email.\n\nThe IHOPS Team`,
    );
    res.json({ message: "Rejected" });
  } catch (err) {
    next(err);
  }
});

// 9.6.2 Subscription Monitoring
router.get("/tenants", async (req, res, next) => {
  try {
    const filter = req.query.filter as string | undefined;
    const tenants = await prisma.tenant.findMany({
      include: { subscription: true },
      orderBy: { createdAt: "desc" },
    });
    let filtered = tenants;
    if (filter === "grace_period")
      filtered = tenants.filter((t) => t.status === "grace_period");
    if (filter === "failing_renewal")
      filtered = tenants.filter(
        (t) => t.subscription?.status === "grace_period",
      );
    res.json({
      tenants: filtered.map((t) => ({
        id: t.id,
        hospitalName: t.hospitalName,
        plan: t.subscription?.planCode,
        billingCycle: t.subscription?.billingCycle,
        trialEndsAt: t.trialEndsAt,
        status: t.status,
        suspended: t.status === "suspended",
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 9.6.3 Customer Management — account-level only, never patient/visit/finance data.
router.get("/tenants/:id", async (req, res, next) => {
  try {
    const t = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: { include: { payments: true } },
        supportTickets: true,
      },
    });
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json({
      tenant: {
        id: t.id,
        hospitalName: t.hospitalName,
        email: t.email,
        phone: t.phone,
        contactPerson: t.contactPerson,
        status: t.status,
        createdAt: t.createdAt,
        subscription: t.subscription,
        supportHistory: t.supportTickets,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { hospitalName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      take: 20,
    });
    res.json({ tenants });
  } catch (err) {
    next(err);
  }
});

// 9.6.4 Platform Analytics
router.get("/analytics", async (_req, res, next) => {
  try {
    const [
      totalTenants,
      activeTenants,
      trialing,
      churned,
      publicHospitalApplications,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "active" } }),
      prisma.tenant.count({ where: { status: "trialing" } }),
      prisma.tenant.count({ where: { status: "suspended" } }),
      prisma.tenant.count({ where: { publicHospitalRequested: true } }),
    ]);
    const revenueByPlan = await prisma.subscription.groupBy({
      by: ["planCode"],
      _count: { planCode: true },
    });
    res.json({
      totalTenants,
      activeTenants,
      trialing,
      churned,
      publicHospitalApplications,
      revenueByPlan,
    });
  } catch (err) {
    next(err);
  }
});

// 9.6.5 System Announcements
router.post("/announcements", async (req, res, next) => {
  try {
    const { title, body, targetSegment, publishAt, expiresAt } = req.body;
    const announcement = await prisma.announcement.create({
      data: {
        title,
        body,
        targetSegment,
        publishAt: new Date(publishAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBySuperAdminId: req.superAdmin!.id,
      },
    });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
});

router.get("/announcements", async (_req, res, next) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { publishAt: "desc" },
    });
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

// 9.6.6 Support Requests
router.get("/support-tickets", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status: status as any } : {},
      include: {
        tenant: { select: { hospitalName: true } },
        raisedBy: { select: { name: true } },
        replies: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
});

router.patch("/support-tickets/:id", async (req, res, next) => {
  try {
    const { status, assignedSuperAdminId, replyBody } = req.body;
    if (replyBody) {
      await prisma.supportTicketReply.create({
        data: {
          ticketId: req.params.id,
          authorType: "super_admin",
          authorName: "IHOPS Support",
          body: replyBody,
        },
      });
    }
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        ...(status ? { status } : {}),
        ...(assignedSuperAdminId ? { assignedSuperAdminId } : {}),
      },
    });

    if (replyBody) {
      const tenant = await prisma.tenant.findFirst({
        where: { supportTickets: { some: { id: ticket.id } } },
      });
      if (tenant) {
        await sendEmail(
          tenant.email,
          `IHOPS Support replied: ${ticket.subject}`,
          `Hello,\n\nOur support team just replied to your ticket "${ticket.subject}":\n\n"${replyBody}"\n\nYou can view the full conversation and reply from inside IHOPS:\n\n${process.env.APP_BASE_URL}/app/admin/support\n\nThe IHOPS Team`,
        );
      }
    }

    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});

export default router;
