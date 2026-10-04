import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import { clinicalNoteSchema } from "./schemas";

const router = Router();
router.use(requireStaffAuth);

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "clinical-documents");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/jpg", "image/png"].includes(file.mimetype);
    cb(ok ? null : new Error("Only PDF, JPG, JPEG, or PNG files are accepted"), ok);
  },
});

function toJson(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}
function fromJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serializeNote(note: any) {
  return {
    ...note,
    allergies: fromJson(note.allergiesJson),
    medicalHistory: fromJson(note.medicalHistoryJson),
    medicationHistory: fromJson(note.medicationHistoryJson),
    prescription: fromJson(note.prescriptionJson),
    investigations: fromJson(note.investigationsJson),
    imaging: fromJson(note.imagingJson),
    allergiesJson: undefined,
    medicalHistoryJson: undefined,
    medicationHistoryJson: undefined,
    prescriptionJson: undefined,
    investigationsJson: undefined,
    imagingJson: undefined,
  };
}

// GET current (isCurrent=true) Clinical Note for a visit, if any.
router.get("/visits/:visitId/notes", requirePermission("clinical_notes.view"), async (req, res, next) => {
  try {
    const note = await prisma.clinicalNote.findFirst({
      where: { tenantId: req.tenantId!, visitId: req.params.visitId, isCurrent: true },
      include: { documents: true },
    });
    res.json({ note: note ? serializeNote(note) : null });
  } catch (err) {
    next(err);
  }
});

// Full version history for a note lineage (audit trail — Section 9.7.2: "never silently overwritten").
router.get("/notes/:noteId/history", requirePermission("clinical_notes.view"), async (req, res, next) => {
  try {
    let current = await prisma.clinicalNote.findFirst({ where: { id: req.params.noteId, tenantId: req.tenantId! } });
    if (!current) return res.status(404).json({ error: "Not found" });
    const chain = [current];
    while (current?.previousVersionId) {
      current = await prisma.clinicalNote.findUnique({ where: { id: current.previousVersionId } });
      if (current) chain.push(current);
    }
    res.json({ versions: chain.map(serializeNote) });
  } catch (err) {
    next(err);
  }
});

// Create a brand-new Clinical Note for a visit (first version).
router.post("/visits/:visitId/notes", requirePermission("clinical_notes.create"), async (req, res, next) => {
  try {
    const visit = await prisma.visit.findFirst({ where: { id: req.params.visitId, tenantId: req.tenantId! } });
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    const existing = await prisma.clinicalNote.findFirst({ where: { visitId: visit.id, isCurrent: true } });
    if (existing) return res.status(409).json({ error: "A Clinical Note already exists for this visit — use the correction endpoint to update it." });

    const body = clinicalNoteSchema.parse(req.body);
    if (body.status === "finalized" && body.followUpRequired && !body.approvedCommunicationInstruction) {
      return res.status(400).json({ error: "An Approved Communication Instruction is required when Follow-up is required and the note is being finalized." });
    }

    const note = await prisma.clinicalNote.create({
      data: {
        tenantId: req.tenantId!,
        visitId: visit.id,
        patientId: visit.patientId,
        clinicianId: req.staff!.id,
        clinicianRole: req.staff!.role,
        status: body.status,
        chiefComplaint: body.chiefComplaint, symptomsReported: body.symptomsReported, complaintDuration: body.complaintDuration, complaintNotes: body.complaintNotes,
        temperature: body.temperature, bloodPressure: body.bloodPressure, pulse: body.pulse, respiratoryRate: body.respiratoryRate, oxygenSaturation: body.oxygenSaturation, weightKg: body.weightKg, heightCm: body.heightCm, observationNotes: body.observationNotes,
        diagnosisPrimary: body.diagnosisPrimary, diagnosisSecondary: body.diagnosisSecondary, diagnosisDifferential: body.diagnosisDifferential, diagnosisNotes: body.diagnosisNotes,
        noKnownAllergies: body.noKnownAllergies || false, allergiesJson: toJson(body.allergies),
        medicalHistoryJson: toJson(body.medicalHistory),
        medicationHistoryJson: toJson(body.medicationHistory),
        prescriptionJson: toJson(body.prescription),
        investigationsJson: toJson(body.investigations),
        imagingJson: toJson(body.imaging),
        treatmentPlan: body.treatmentPlan, treatmentDuration: body.treatmentDuration, treatmentFrequency: body.treatmentFrequency, treatmentRoute: body.treatmentRoute,
        nextTreatmentDate: body.nextTreatmentDate ? new Date(body.nextTreatmentDate) : undefined,
        treatmentTimeOfDay: body.treatmentTimeOfDay, treatmentInstructions: body.treatmentInstructions, treatmentNotes: body.treatmentNotes,
        followUpRequired: body.followUpRequired || false, followUpType: body.followUpType,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
        followUpExpectedTime: body.followUpExpectedTime, followUpDurationOption: body.followUpDurationOption, followUpFrequencyOption: body.followUpFrequencyOption,
        communicationChannelOverride: body.communicationChannelOverride, approvedCommunicationInstruction: body.approvedCommunicationInstruction,
        finalizedAt: body.status === "finalized" ? new Date() : null,
      },
    });

    await writeAuditLog({ tenantId: req.tenantId, staffId: req.staff!.id, actionType: "clinical_note.create", entityType: "ClinicalNote", entityId: note.id, metadata: { status: body.status } });
    res.status(201).json({ note: serializeNote(note) });
  } catch (err) {
    next(err);
  }
});

// Correct/update a note: creates a NEW version rather than mutating the
// existing row once it has ever been finalized (draft-to-draft edits reuse
// the same row for a smoother authoring experience; the moment a note has
// been finalized once, any further change is a versioned correction).
router.patch("/notes/:noteId", requirePermission("clinical_notes.create"), async (req, res, next) => {
  try {
    const existing = await prisma.clinicalNote.findFirst({ where: { id: req.params.noteId, tenantId: req.tenantId! } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const body = clinicalNoteSchema.parse(req.body);
    if (body.status === "finalized" && body.followUpRequired && !body.approvedCommunicationInstruction) {
      return res.status(400).json({ error: "An Approved Communication Instruction is required when Follow-up is required and the note is being finalized." });
    }

    const data = {
      chiefComplaint: body.chiefComplaint, symptomsReported: body.symptomsReported, complaintDuration: body.complaintDuration, complaintNotes: body.complaintNotes,
      temperature: body.temperature, bloodPressure: body.bloodPressure, pulse: body.pulse, respiratoryRate: body.respiratoryRate, oxygenSaturation: body.oxygenSaturation, weightKg: body.weightKg, heightCm: body.heightCm, observationNotes: body.observationNotes,
      diagnosisPrimary: body.diagnosisPrimary, diagnosisSecondary: body.diagnosisSecondary, diagnosisDifferential: body.diagnosisDifferential, diagnosisNotes: body.diagnosisNotes,
      noKnownAllergies: body.noKnownAllergies || false, allergiesJson: toJson(body.allergies),
      medicalHistoryJson: toJson(body.medicalHistory),
      medicationHistoryJson: toJson(body.medicationHistory),
      prescriptionJson: toJson(body.prescription),
      investigationsJson: toJson(body.investigations),
      imagingJson: toJson(body.imaging),
      treatmentPlan: body.treatmentPlan, treatmentDuration: body.treatmentDuration, treatmentFrequency: body.treatmentFrequency, treatmentRoute: body.treatmentRoute,
      nextTreatmentDate: body.nextTreatmentDate ? new Date(body.nextTreatmentDate) : undefined,
      treatmentTimeOfDay: body.treatmentTimeOfDay, treatmentInstructions: body.treatmentInstructions, treatmentNotes: body.treatmentNotes,
      followUpRequired: body.followUpRequired || false, followUpType: body.followUpType,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
      followUpExpectedTime: body.followUpExpectedTime, followUpDurationOption: body.followUpDurationOption, followUpFrequencyOption: body.followUpFrequencyOption,
      communicationChannelOverride: body.communicationChannelOverride, approvedCommunicationInstruction: body.approvedCommunicationInstruction,
    };

    if (existing.status === "draft") {
      const note = await prisma.clinicalNote.update({
        where: { id: existing.id },
        data: { ...data, status: body.status, finalizedAt: body.status === "finalized" ? new Date() : null },
      });
      await writeAuditLog({ tenantId: req.tenantId, staffId: req.staff!.id, actionType: "clinical_note.update_draft", entityType: "ClinicalNote", entityId: note.id });
      return res.json({ note: serializeNote(note) });
    }

    // Versioned correction of a previously-finalized note.
    const [, newVersion] = await prisma.$transaction([
      prisma.clinicalNote.update({ where: { id: existing.id }, data: { isCurrent: false } }),
      prisma.clinicalNote.create({
        data: {
          ...data,
          tenantId: req.tenantId!, visitId: existing.visitId, patientId: existing.patientId,
          clinicianId: req.staff!.id, clinicianRole: req.staff!.role,
          status: body.status, version: existing.version + 1, previousVersionId: existing.id, isCurrent: true,
          finalizedAt: body.status === "finalized" ? new Date() : null,
        },
      }),
    ]);
    await writeAuditLog({ tenantId: req.tenantId, staffId: req.staff!.id, actionType: "clinical_note.correct", entityType: "ClinicalNote", entityId: newVersion.id, metadata: { previousVersionId: existing.id } });
    res.json({ note: serializeNote(newVersion) });
  } catch (err) {
    next(err);
  }
});

// Document upload — linked to a Clinical Note, patient, and visit.
router.post("/notes/:noteId/documents", requirePermission("clinical_documents.upload"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File is required" });
    const note = await prisma.clinicalNote.findFirst({ where: { id: req.params.noteId, tenantId: req.tenantId! } });
    if (!note) return res.status(404).json({ error: "Clinical Note not found" });

    const doc = await prisma.clinicalDocument.create({
      data: {
        tenantId: req.tenantId!, clinicalNoteId: note.id, patientId: note.patientId, visitId: note.visitId,
        category: req.body.category || "lab_result",
        fileName: req.file.originalname,
        fileUrl: `/api/clinical/documents/${req.file.filename}`,
        uploadedByStaffId: req.staff!.id,
      },
    });
    await writeAuditLog({ tenantId: req.tenantId, staffId: req.staff!.id, actionType: "clinical_document.upload", entityType: "ClinicalDocument", entityId: doc.id });
    res.status(201).json({ document: doc });
  } catch (err) {
    next(err);
  }
});

// Served only through this authenticated, permission-checked route — never a
// static/public directory (Section 9.7.3: "never publicly accessible").
router.get("/documents/:filename", requirePermission("clinical_notes.view"), async (req, res, next) => {
  try {
    const doc = await prisma.clinicalDocument.findFirst({ where: { tenantId: req.tenantId!, fileUrl: { endsWith: req.params.filename } } });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(UPLOAD_DIR, req.params.filename));
  } catch (err) {
    next(err);
  }
});

// 9.7.2 Medical Record — aggregation layer over ClinicalNote rows for a
// patient. Not a stored table: computed on read, so it can never drift from
// the notes it's built from.
router.get("/patients/:patientId/medical-record", requirePermission("medical_record.view"), async (req, res, next) => {
  try {
    const notes = await prisma.clinicalNote.findMany({
      where: { tenantId: req.tenantId!, patientId: req.params.patientId, isCurrent: true, status: "finalized" },
      orderBy: { finalizedAt: "asc" },
      include: { documents: true },
    });

    const diagnoses: any[] = [];
    const allergies: any[] = [];
    const medications: any[] = [];
    const investigations: any[] = [];
    const imaging: any[] = [];
    const treatments: any[] = [];
    const timeline: any[] = [];

    for (const n of notes) {
      const provenance = { clinicalNoteId: n.id, visitId: n.visitId, clinicianId: n.clinicianId, date: n.finalizedAt };
      if (n.diagnosisPrimary) diagnoses.push({ diagnosis: n.diagnosisPrimary, secondary: n.diagnosisSecondary, ...provenance });
      const noteAllergies = fromJson(n.allergiesJson);
      if (Array.isArray(noteAllergies)) allergies.push(...noteAllergies.map((a) => ({ ...a, ...provenance })));
      const meds = fromJson(n.medicationHistoryJson);
      if (meds) medications.push({ ...meds, ...provenance });
      const presc = fromJson(n.prescriptionJson);
      if (Array.isArray(presc)) medications.push(...presc.map((p) => ({ ...p, ...provenance, kind: "prescription" })));
      const inv = fromJson(n.investigationsJson);
      if (Array.isArray(inv)) investigations.push(...inv.map((i) => ({ ...i, ...provenance })));
      const img = fromJson(n.imagingJson);
      if (Array.isArray(img)) imaging.push(...img.map((i) => ({ ...i, ...provenance })));
      if (n.treatmentPlan) treatments.push({ plan: n.treatmentPlan, duration: n.treatmentDuration, ...provenance });
      timeline.push({
        visitId: n.visitId, clinicalNoteId: n.id, date: n.finalizedAt,
        complaint: n.chiefComplaint, diagnosis: n.diagnosisPrimary, treatment: n.treatmentPlan,
        prescription: fromJson(n.prescriptionJson), followUp: n.followUpRequired ? n.followUpType : null,
      });
    }

    const patient = await prisma.patient.findFirst({ where: { id: req.params.patientId, tenantId: req.tenantId! } });
    const latest = notes[notes.length - 1];

    res.json({
      patientSummary: patient
        ? { platformPatientId: patient.platformPatientId, hospitalCardNumber: patient.hospitalCardNumber, familyId: patient.familyId, dob: patient.dob, gender: patient.gender }
        : null,
      clinicalSummary: {
        allergies: latest && !latest.noKnownAllergies ? allergies.slice(-5) : latest?.noKnownAllergies ? "NKA — No Known Allergies" : null,
        currentMedication: medications.slice(-3),
        activeTreatment: latest?.treatmentPlan || null,
        mostRecentDiagnosis: latest?.diagnosisPrimary || null,
        upcomingFollowUp: latest?.followUpRequired ? { type: latest.followUpType, date: latest.followUpDate } : null,
      },
      allergies, diagnoses, medications, investigations, imaging, treatments, timeline,
      documents: notes.flatMap((n) => n.documents),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
