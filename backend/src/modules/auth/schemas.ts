import { z } from "zod";

export const signupSchema = z.object({
  hospitalName: z.string().min(2),
  hospitalType: z.enum([
    "General Hospital", "Private Clinic", "Teaching Hospital", "Dental Clinic",
    "Veterinary Clinic", "Eye Clinic", "Physiotherapy Clinic", "Diagnostic Centre", "Specialist Clinic",
  ]),
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
