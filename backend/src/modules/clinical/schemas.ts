import { z } from "zod";

// Every field is optional at the schema level per the PRD: "leaving optional
// sections blank where not applicable" — the only hard requirement enforced
// in the route handler is that a note can't be finalized with follow-up
// marked required but no Approved Communication Instruction (Section 9.7.4),
// since that instruction is the sole input to the Restricted AI engine.

// Every field is optional here on purpose, `type` and `substance` included —
// a Clinical Note is saved as a draft mid-edit, and an allergy row a
// clinician started filling in (or added, then reconsidered) is a normal
// draft state, not an invalid one. The UI still offers `type` as a fixed
// set of choices (a <select>, not free text) so a *filled-in* row is always
// one of these four values; this schema just doesn't force every row to be
// complete before a draft can be saved.
export const allergyItemSchema = z.object({
  type: z.enum(["drug", "food", "environmental", "other"]).optional(),
  substance: z.string().optional(),
  reaction: z.string().optional(),
  severity: z.string().optional(),
  notes: z.string().optional(),
});

export const clinicalNoteSchema = z.object({
  // Complaint
  chiefComplaint: z.string().optional(),
  symptomsReported: z.string().optional(),
  complaintDuration: z.string().optional(),
  complaintNotes: z.string().optional(),

  // Observation & Vitals
  temperature: z.number().optional(),
  bloodPressure: z.string().optional(),
  pulse: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  weightKg: z.number().optional(),
  heightCm: z.number().optional(),
  observationNotes: z.string().optional(),

  // Diagnosis
  diagnosisPrimary: z.string().optional(),
  diagnosisSecondary: z.string().optional(),
  diagnosisDifferential: z.string().optional(),
  diagnosisNotes: z.string().optional(),

  // Allergies
  noKnownAllergies: z.boolean().optional(),
  allergies: z.array(allergyItemSchema).optional(),

  // Medical History
  medicalHistory: z
    .object({
      illnesses: z.string().optional(),
      chronicConditions: z.string().optional(),
      surgeries: z.string().optional(),
      hospitalisations: z.string().optional(),
      familyHistory: z.string().optional(),
      socialHistory: z.string().optional(),
    })
    .optional(),

  // Medication History
  medicationHistory: z
    .object({
      current: z.array(z.record(z.any())).optional(),
      previous: z.array(z.record(z.any())).optional(),
    })
    .optional(),

  // Prescription
  prescription: z.array(z.record(z.any())).optional(),

  // Investigations
  investigations: z.array(z.record(z.any())).optional(),

  // Imaging
  imaging: z.array(z.record(z.any())).optional(),

  // Treatment / Care Plan
  treatmentPlan: z.string().optional(),
  treatmentDuration: z.string().optional(),
  treatmentFrequency: z.string().optional(),
  treatmentRoute: z.string().optional(),
  nextTreatmentDate: z.string().optional(),
  treatmentTimeOfDay: z.string().optional(),
  treatmentInstructions: z.string().optional(),
  treatmentNotes: z.string().optional(),

  // Follow-up & Communication
  followUpRequired: z.boolean().optional(),
  followUpType: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpExpectedTime: z.string().optional(),
  followUpDurationOption: z.string().optional(),
  followUpFrequencyOption: z.string().optional(),
  communicationChannelOverride: z.enum(["whatsapp", "sms", "email"]).optional(),
  approvedCommunicationInstruction: z.string().optional(),

  status: z.enum(["draft", "finalized"]).default("draft"),
});
