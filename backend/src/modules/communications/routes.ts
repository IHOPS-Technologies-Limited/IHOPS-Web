import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { sendOnChannel } from "../../services/notificationService";
import { writeAuditLog } from "../../middleware/audit";

const router = Router();
router.use(requireStaffAuth);

// 9.2.8 Communication Log
router.get(
  "/",
  requirePermission("communications.read"),
  async (req, res, next) => {
    try {
      const patientId = req.query.patientId as string | undefined;
      const logs = await prisma.communicationLog.findMany({
        where: { tenantId: req.tenantId!, ...(patientId ? { patientId } : {}) },
        include: { patient: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      res.json({ logs });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/send",
  requirePermission("communications.send_manual"),
  async (req, res, next) => {
    try {
      const { patientId, channel, messageBody } = req.body;
      const patient = await prisma.patient.findFirst({
        where: { id: patientId, tenantId: req.tenantId! },
      });
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      const to = channel === "email" ? patient.email : patient.phone;
      if (!to)
        return res
          .status(400)
          .json({
            error: `Patient has no contact detail on file for ${channel}`,
          });

      const result = await sendOnChannel(
        channel,
        to,
        messageBody,
        req.tenantId!,
      );
      const log = await prisma.communicationLog.create({
        data: {
          tenantId: req.tenantId!,
          patientId,
          trigger: "manual",
          channel,
          messageBody,
          status: result.ok ? "sent" : "failed",
          sentAt: result.ok ? new Date() : null,
        },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "communication.manual_send",
        entityType: "CommunicationLog",
        entityId: log.id,
      });
      res.status(201).json({ log });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
