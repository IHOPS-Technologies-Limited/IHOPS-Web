import { Request, Response, NextFunction } from "express";
import { verifyStaffToken, verifySuperAdminToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { roleHasPermission, PermissionKey } from "../config/permissions";

// Augment Express types with the authenticated principal.
declare global {
  namespace Express {
    interface Request {
      staff?: { id: string; tenantId: string; role: string };
      superAdmin?: { id: string };
      tenantId?: string;
    }
  }
}

/**
 * Tenant-side staff authentication. Verifies the JWT (signed with the
 * tenant-side secret) and re-checks the staff's live status/tenant status
 * from the DB on every request, so a deactivated staff member or a
 * suspended tenant is locked out immediately rather than only when their
 * token happens to expire.
 */
export async function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }
    const payload = verifyStaffToken(header.slice(7));

    const staff = await prisma.staff.findUnique({ where: { id: payload.staffId } });
    if (!staff || staff.status !== "active" || staff.tenantId !== payload.tenantId) {
      return res.status(401).json({ error: "Session no longer valid" });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: staff.tenantId } });
    if (!tenant) return res.status(401).json({ error: "Tenant not found" });

    // Suspended/pending tenants: block everything except explicitly
    // whitelisted routes (subscription status, login/logout). Those routes
    // opt out via `allowWhenSuspended: true` in their route registration.
    const allowed = (req as any)._allowWhenSuspended === true;
    if (!allowed && ["suspended", "pending_approval", "pending_verification", "rejected"].includes(tenant.status)) {
      return res.status(403).json({ error: "TENANT_ACCESS_RESTRICTED", tenantStatus: tenant.status });
    }

    req.staff = { id: staff.id, tenantId: staff.tenantId, role: staff.role };
    req.tenantId = staff.tenantId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Marks a route as reachable even while a tenant is suspended/pending —
// used only for Subscription & Billing / Reactivate screens (PRD Section 11.2).
export function allowWhenSuspended(req: Request, _res: Response, next: NextFunction) {
  (req as any)._allowWhenSuspended = true;
  next();
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff) return res.status(401).json({ error: "Not authenticated" });
    if (!roleHasPermission(req.staff.role, permission)) {
      return res.status(403).json({ error: "FORBIDDEN", required: permission });
    }
    next();
  };
}

/**
 * Super Admin authentication — verified against a *different* JWT secret
 * than tenant staff tokens (see lib/jwt.ts). A tenant staff token, even an
 * Administrator's, will always fail verifySuperAdminToken. This is the
 * "unreachable through any tenant role" requirement from PRD Section 14
 * enforced at the cryptographic layer, not just route mounting.
 */
export async function requireSuperAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }
    const payload = verifySuperAdminToken(header.slice(7));
    const superAdmin = await prisma.superAdmin.findUnique({ where: { id: payload.superAdminId } });
    if (!superAdmin) return res.status(401).json({ error: "Invalid session" });
    req.superAdmin = { id: superAdmin.id };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
