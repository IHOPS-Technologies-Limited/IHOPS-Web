import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import { generateRestrictedMessage } from "../../services/restrictedAiEngine";
import { sendOnChannel } from "../../services/notificationService";

// This router is mounted at /api/ai-communication — a deliberately separate
// endpoint namespace from /api/clinical/*, per PRD Section 15: "The
// Restricted AI Communication Engine is a separate service with its own
// endpoint namespace and no access to the /clinical/* namespace below."
// Every read from clinical data happens once, server-side, in
// buildPayloadFromNote() below, at payload-creation time — after that point
// nothing downstream (generateRestrictedMessage, the send pipeline, this
// router's other endpoints) ever touches a ClinicalNote row again.
const router = Router();
router.use(requireStaffAuth);

async function buildPayloadFromNote(tenantId: string, noteId: string) {
  const note = await prisma.clinicalNote.findFirst({
    where: { id: noteId, tenantId },
  });
  if (!note)
    throw Object.assign(new Error("Clinical Note not found"), { status: 404 });
  if (note.status !== "finalized")
    throw Object.assign(
      new Error(
        "Clinical Note must be finalized before a Communication Payload can be built",
      ),
      { status: 400 },
    );
  if (!note.followUpRequired)
    throw Object.assign(
      new Error("This note does not have Follow-up Required set"),
      { status: 400 },
    );
  if (!note.approvedCommunicationInstruction)
    throw Object.assign(
      new Error("Approved Communication Instruction is missing"),
      { status: 400 },
    );

  const [patient, tenant] = await Promise.all([
    prisma.patient.findUnique({ where: { id: note.patientId } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);
  if (!patient || !tenant)
    throw Object.assign(new Error("Patient or tenant not found"), {
      status: 404,
    });

  const channel = note.communicationChannelOverride || patient.preferredChannel;
  const hasContact =
    (channel === "email" && patient.email) ||
    (channel !== "email" && patient.phone);
  if (!hasContact)
    throw Object.assign(
      new Error(`Patient has no contact detail on file for ${channel}`),
      { status: 400 },
    );

  return prisma.communicationPayload.create({
    data: {
      tenantId,
      clinicalNoteId: note.id,
      visitId: note.visitId,
      patientId: note.patientId,
      patientName: patient.name,
      guardianName: patient.guardianName,
      preferredChannel: channel,
      hospitalName: tenant.hospitalName,
      hospitalType: tenant.hospitalType,
      species: patient.species,
      approvedInstruction: note.approvedCommunicationInstruction,
      followUpType: note.followUpType,
      followUpDate: note.followUpDate,
      mode: tenant.restrictedAiMode,
      status: "pending_review",
    },
  });
}

// Build a payload from a finalized note. In "automatic" mode this also
// generates + sends immediately; in "review" mode it stops after drafting,
// awaiting staff Approve & Send / Edit / Reject (Section 9.7.5).
router.post(
  "/payloads",
  requirePermission("communication_payload.approve"),
  async (req, res, next) => {
    try {
      const { clinicalNoteId } = req.body;
      let payload = await buildPayloadFromNote(req.tenantId!, clinicalNoteId);

      const { body } = await generateRestrictedMessage({
        patientName: payload.patientName,
        guardianName: payload.guardianName,
        hospitalName: payload.hospitalName,
        hospitalType: payload.hospitalType,
        species: payload.species,
        approvedInstruction: payload.approvedInstruction,
        followUpType: payload.followUpType,
      });
      payload = await prisma.communicationPayload.update({
        where: { id: payload.id },
        data: { generatedMessage: body },
      });

      if (payload.mode === "automatic") {
        const sent = await sendPayload(
          payload.id,
          req.staff!.id,
          req.tenantId!,
        );
        return res.status(201).json({ payload: sent });
      }

      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "communication_payload.drafted",
        entityType: "CommunicationPayload",
        entityId: payload.id,
      });
      res.status(201).json({ payload });
    } catch (err: any) {
      if (err.status)
        return res.status(err.status).json({ error: err.message });
      next(err);
    }
  },
);

router.get(
  "/payloads/:id",
  requirePermission("communication_payload.approve"),
  async (req, res, next) => {
    try {
      const payload = await prisma.communicationPayload.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!payload) return res.status(404).json({ error: "Not found" });
      res.json({ payload });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/payloads",
  requirePermission("communication_payload.approve"),
  async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const payloads = await prisma.communicationPayload.findMany({
        where: {
          tenantId: req.tenantId!,
          ...(status ? { status: status as any } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      res.json({ payloads });
    } catch (err) {
      next(err);
    }
  },
);

async function sendPayload(
  payloadId: string,
  staffId: string,
  tenantId: string,
) {
  const payload = await prisma.communicationPayload.findUniqueOrThrow({
    where: { id: payloadId },
  });
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: payload.patientId },
  });
  const destination =
    payload.preferredChannel === "email" ? patient.email! : patient.phone!;

  const result = await sendOnChannel(
    payload.preferredChannel as any,
    destination,
    payload.generatedMessage || payload.approvedInstruction,
    tenantId,
  );

  const updated = await prisma.communicationPayload.update({
    where: { id: payload.id },
    data: {
      status: result.ok ? "sent" : "failed",
      approvedByStaffId: staffId,
      approvedAt: new Date(),
      sentAt: result.ok ? new Date() : null,
    },
  });

  // Written to the same CommunicationLog table the rest of the product uses
  // for its Communication Log UI, tagged with the new "ai_restricted"
  // trigger and a payloadId back-reference — the existing "ai_followup" rows
  // written by the original visit-close flow are untouched.
  await prisma.communicationLog.create({
    data: {
      tenantId,
      patientId: payload.patientId,
      visitId: payload.visitId,
      trigger: "ai_restricted",
      channel: payload.preferredChannel as any,
      messageBody: payload.generatedMessage || payload.approvedInstruction,
      status: result.ok ? "sent" : "failed",
      failureReason: result.error,
      sentAt: result.ok ? new Date() : null,
      payloadId: payload.id,
    },
  });
  await writeAuditLog({
    tenantId,
    staffId,
    actionType: "communication_payload.sent",
    entityType: "CommunicationPayload",
    entityId: payload.id,
  });
  return updated;
}

// Review Mode actions (Section 9.7.5)
router.post(
  "/payloads/:id/approve",
  requirePermission("communication_payload.approve"),
  async (req, res, next) => {
    try {
      const { editedMessage } = req.body;
      if (editedMessage) {
        await prisma.communicationPayload.update({
          where: { id: req.params.id },
          data: { generatedMessage: editedMessage },
        });
      }
      const sent = await sendPayload(
        req.params.id,
        req.staff!.id,
        req.tenantId!,
      );
      res.json({ payload: sent });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/payloads/:id/reject",
  requirePermission("communication_payload.approve"),
  async (req, res, next) => {
    try {
      const { reason } = req.body;
      const payload = await prisma.communicationPayload.update({
        where: { id: req.params.id },
        data: {
          status: "rejected",
          rejectionReason: reason,
          approvedByStaffId: req.staff!.id,
          approvedAt: new Date(),
        },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "communication_payload.rejected",
        entityType: "CommunicationPayload",
        entityId: payload.id,
        metadata: { reason },
      });
      res.json({ payload });
    } catch (err) {
      next(err);
    }
  },
);

// 9.7.6 AI Communication Log — per-patient or hospital-wide.
router.get(
  "/log",
  requirePermission("communication_payload.approve"),
  async (req, res, next) => {
    try {
      const patientId = req.query.patientId as string | undefined;
      const logs = await prisma.communicationLog.findMany({
        where: {
          tenantId: req.tenantId!,
          trigger: "ai_restricted",
          ...(patientId ? { patientId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      res.json({ logs });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
