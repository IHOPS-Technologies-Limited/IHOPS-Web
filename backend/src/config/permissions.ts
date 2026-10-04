// Role × action permission matrix (PRD Section 6 / Table 1 / Table 2).
// Enforced server-side on every request via requirePermission() middleware —
// never relying on the UI hiding a nav item.
//
// Safe-boundary rule from the PRD: a Receptionist can never be granted
// expense-recording rights without also holding the Finance Officer role,
// and only an Administrator-level role can ever be granted staff-deletion
// rights. Hospital Administrators can customize additional grants (see
// modules/admin/rolePermissions.ts) but these two floors are hardcoded here
// and cannot be loosened from the database.

export type Role =
  | "administrator"
  | "doctor"
  | "receptionist"
  | "finance_officer"
  | "nurse";

export const PERMISSIONS = {
  "patients.read": [
    "administrator",
    "doctor",
    "receptionist",
    "finance_officer",
  ],
  "patients.write": ["administrator", "receptionist"],
  "patients.import": ["administrator", "receptionist"],
  // Bulk export of patient contact/PII data is scoped narrower than
  // ordinary read access — same roles as patients.write, not every role
  // that can view a patient in the app.
  "patients.export": ["administrator", "receptionist"],
  "visits.read": ["administrator", "doctor", "receptionist"],
  "visits.start": ["administrator", "receptionist"],
  // "Call Next" moves a waiting patient into consultation without entering
  // clinical data — a front-desk/queue action, not a clinical one, so it's
  // scoped separately from visits.update_clinical (which stays doctor+admin only).
  "visits.call_next": ["administrator", "doctor", "receptionist"],
  "visits.update_clinical": ["administrator", "doctor"],
  "visits.close": ["administrator", "doctor", "receptionist"],
  "finance.read": ["administrator", "finance_officer"],
  "finance.record_expense": ["administrator", "finance_officer"],
  "finance.export": ["administrator", "finance_officer"],
  "staff.manage": ["administrator"],
  "staff.delete": ["administrator"],
  "staff.reset_pin": ["administrator"],
  // A lighter read than staff.manage — just id+name of active doctors, for
  // the "assign a doctor" dropdowns when starting or updating a visit.
  // Receptionist needs this at intake; staff.manage (full account
  // management) stays administrator-only.
  "workforce.read_doctors": ["administrator", "receptionist", "doctor"],
  "attendance.self_check": [
    "administrator",
    "doctor",
    "receptionist",
    "finance_officer",
    "nurse",
  ],
  "attendance.manage": ["administrator"],
  "attendance.correct": ["administrator"],
  "subscription.manage": ["administrator"],
  "settings.manage": ["administrator"],
  "roles.manage": ["administrator"],
  "communications.read": ["administrator", "doctor", "receptionist"],
  "communications.send_manual": ["administrator", "receptionist"],
  "support_tickets.raise": [
    "administrator",
    "doctor",
    "receptionist",
    "finance_officer",
    "nurse",
  ],

  // --- Added for Module 5 (Clinical Documentation & Medical Record) ---
  // Deliberately NOT granted to "administrator" by default. The PRD addendum
  // is explicit that administrative authority does not automatically grant
  // clinical access: "Hospital Administrator, Receptionist, and Finance
  // Officer are administrative roles; clinical permissions ... are granted
  // separately and explicitly, only to Doctor/Authorised Clinician and
  // configured Nurse permissions." Nurse is included as the PRD's example of
  // a "configured" clinical role; a hospital that runs entirely on
  // Doctor-only documentation can leave nurse.view unused.
  "clinical_notes.create": ["doctor"],
  "clinical_notes.view": ["doctor", "nurse"],
  "clinical_documents.upload": ["doctor", "nurse"],
  "medical_record.view": ["doctor", "nurse"],
  // Approving/editing/rejecting an AI-drafted message in Review Mode is a
  // communication action, not a clinical-data-read action — Administrator
  // keeps this one, alongside Doctor, consistent with Communications above.
  "communication_payload.approve": ["administrator", "doctor"],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function roleHasPermission(
  role: string,
  permission: PermissionKey,
): boolean {
  const allowed: readonly string[] = PERMISSIONS[permission] || [];
  return allowed.includes(role);
}

// Hardcoded floor — cannot be granted away even by tenant-level role editing.
export const HARD_FLOOR: Record<string, PermissionKey[]> = {
  receptionist_cannot: [
    "finance.record_expense",
    "staff.delete",
    "staff.manage",
  ],
};
