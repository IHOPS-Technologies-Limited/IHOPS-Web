import { z } from "zod";

export const HOSPITAL_TYPES = [
  "General Hospital",
  "Private Clinic",
  "Teaching Hospital",
  "Dental Clinic",
  "Veterinary Clinic",
  "Eye Clinic",
  "Physiotherapy Clinic",
  "Diagnostic Centre",
  "Specialist Clinic",
] as const;

export const signupSchema = z.object({
  hospitalName: z.string().min(2),
  hospitalType: z.enum(HOSPITAL_TYPES),
  contactPerson: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  state: z.string().min(2),
  lga: z.string().min(2),
  address: z.string().min(3),
  nearestLandmark: z.string().optional(),
  postalCode: z.string().optional(),
  adminName: z.string().min(2),
  adminPassword: z.string().min(8),
  planCode: z.enum(["starter", "standard", "public_hospital"]),
  billingCycle: z.enum(["monthly", "annual", "none"]).default("monthly"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const pinLoginSchema = z.object({
  tenantEmail: z.string().email(),
  staffIdDisplay: z.string().min(1),
  pin: z.string().min(4).max(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// bcrypt only uses the first 72 bytes of a password, so cap there rather than
// silently ignoring the tail of a longer one.
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer");

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword,
});
