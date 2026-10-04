import { prisma } from "../lib/prisma";

/**
 * Every mutating endpoint writes an audit log entry (PRD Section 13: "All
 * mutating endpoints write an audit log entry via middleware"). Call this
 * from within route handlers after a successful mutation — it's deliberately
 * explicit rather than fully automatic so each entry carries a meaningful
 * actionType/entityType instead of a generic "POST /x" line.
 */
export async function writeAuditLog(params: {
  tenantId?: string | null;
  staffId?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId ?? null,
      staffId: params.staffId ?? null,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
