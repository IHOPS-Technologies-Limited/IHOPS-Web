import { customAlphabet } from "nanoid";

const numeric = customAlphabet("0123456789", 6);
const alphanumeric = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function generatePlatformPatientId(sequence: number): string {
  return `PT-${String(sequence).padStart(6, "0")}`;
}

export function generateStaffId(sequence: number): string {
  return `IHOPS-${String(sequence).padStart(4, "0")}`;
}

export function generateFamilyId(sequence: number): string {
  return `FAM-${String(sequence).padStart(4, "0")}`;
}

export function generateTempPin(): string {
  return numeric().slice(0, 4);
}

export function generateVerificationToken(): string {
  return alphanumeric() + alphanumeric();
}
