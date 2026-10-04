import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { sendEmail } from "../../services/notificationService";

const router = Router();
router.use(requireStaffAuth);

router.post(
  "/",
  requirePermission("support_tickets.raise"),
  async (req, res, next) => {
    try {
      const { subject, body } = req.body;
      const ticket = await prisma.supportTicket.create({
        data: {
          tenantId: req.tenantId!,
          raisedByStaffId: req.staff!.id,
          subject,
          body,
        },
      });

      const teamEmail = process.env.IHOPS_TEAM_EMAIL;
      if (teamEmail) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: req.tenantId! },
        });
        await sendEmail(
          teamEmail,
          `New support ticket: ${subject}`,
          `A new support ticket just came in from ${tenant?.hospitalName}.\n\nSubject: ${subject}\n\nMessage:\n${body}\n\nYou can reply from the Super Admin Support Requests page.`,
        );
      }

      res.status(201).json({ ticket });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/",
  requirePermission("support_tickets.raise"),
  async (req, res, next) => {
    try {
      const tickets = await prisma.supportTicket.findMany({
        where: { tenantId: req.tenantId! },
        include: { replies: true },
        orderBy: { createdAt: "desc" },
      });
      res.json({ tickets });
    } catch (err) {
      next(err);
    }
  },
);

// Lets hospital staff reply back on an existing ticket — previously only the
// IHOPS Super Admin side could add a reply, making this a one-way channel.
// Replying to a ticket the Super Admin already marked "resolved" reopens it,
// so a follow-up question doesn't silently sit in a closed ticket.
router.post(
  "/:id/reply",
  requirePermission("support_tickets.raise"),
  async (req, res, next) => {
    try {
      const { body } = req.body;
      if (!body || !String(body).trim())
        return res.status(400).json({ error: "Reply cannot be empty" });

      const ticket = await prisma.supportTicket.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const staff = await prisma.staff.findUnique({
        where: { id: req.staff!.id },
      });
      await prisma.supportTicketReply.create({
        data: {
          ticketId: ticket.id,
          authorType: "tenant",
          authorName: staff?.name || "Hospital staff",
          body,
        },
      });
      const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: ticket.status === "resolved" ? { status: "open" } : {},
        include: { replies: true },
      });

      const teamEmail = process.env.IHOPS_TEAM_EMAIL;
      if (teamEmail) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: req.tenantId! },
        });
        await sendEmail(
          teamEmail,
          `New reply on ticket: ${ticket.subject}`,
          `${tenant?.hospitalName} just replied on an existing support ticket.\n\nTicket: ${ticket.subject}\n\nTheir reply:\n${body}\n\nThis ticket has been reopened if it was previously marked resolved. You can reply from the Super Admin Support Requests page.`,
        );
      }

      res.status(201).json({ ticket: updated });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
