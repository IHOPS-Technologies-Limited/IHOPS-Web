import { z } from "zod";

export const createPatientSchema = z.object({
  hospitalCardNumber: z.string().optional(),
  familyId: z.string().optional(),
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.string().min(1),
  dob: z.string(), // ISO date
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  preferredChannel: z.enum(["whatsapp", "sms", "email"]),
  administrativeNotes: z.string().optional(),
  species: z.string().optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"])
    .optional(),
  overrideDuplicateWarning: z.boolean().optional(),
});

// All fields optional — a PATCH only needs to send what changed. `status` is
// intentionally its own enum here rather than a free string, since it drives
// the Patient Directory's summary counts and filters.
export const updatePatientSchema = z.object({
  hospitalCardNumber: z.string().optional(),
  familyId: z.string().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.string().min(1).optional(),
  dob: z.string().optional(),
  address: z.string().min(1).optional(),
  emergencyContact: z.string().min(1).optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  preferredChannel: z.enum(["whatsapp", "sms", "email"]).optional(),
  administrativeNotes: z.string().optional(),
  species: z.string().optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"])
    .optional(),
  status: z.enum(["active", "inactive", "deceased"]).optional(),
});
