import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || "dev-super-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

export interface StaffTokenPayload {
  staffId: string;
  tenantId: string;
  role: string;
}

export interface SuperAdminTokenPayload {
  superAdminId: string;
}

// Tenant-side tokens (staff/administrators) are signed with a separate secret
// from Super Admin tokens on purpose — this is what makes the Super Admin
// console "unreachable through any tenant role" at the token-verification layer,
// not just via route guards (PRD Section 14).
export function signStaffToken(payload: StaffTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyStaffToken(token: string): StaffTokenPayload {
  return jwt.verify(token, JWT_SECRET) as StaffTokenPayload;
}

export function signSuperAdminToken(payload: SuperAdminTokenPayload): string {
  return jwt.sign(payload, SUPER_ADMIN_JWT_SECRET, { expiresIn: "12h" });
}

export function verifySuperAdminToken(token: string): SuperAdminTokenPayload {
  return jwt.verify(token, SUPER_ADMIN_JWT_SECRET) as SuperAdminTokenPayload;
}
