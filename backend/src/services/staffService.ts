import { prisma } from "../lib/prisma";
import { generateStaffId } from "../lib/ids";

// Next free human-facing Staff ID for a hospital (IHOPS-0007 style).
//
// Previously callers used `count(staff) + 1`. That is only correct while no
// staff row has ever been removed: once an account is permanently deleted
// (Super Admin console) the count drops below the highest issued number, and
// count+1 lands on an ID that still exists → unique-constraint failure on
// (tenantId, staffIdDisplay). Taking max(existing number) + 1 is immune to gaps.
export async function nextStaffIdDisplay(tenantId: string): Promise<string> {
  const rows = await prisma.staff.findMany({
    where: { tenantId },
    select: { staffIdDisplay: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)\s*$/.exec(r.staffIdDisplay);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return generateStaffId(max + 1);
}

// Empty strings from forms must be stored as NULL. Staff has
// @@unique([tenantId, email]); two staff saved with email "" would collide,
// whereas multiple NULLs are allowed by Postgres.
export function blankToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
