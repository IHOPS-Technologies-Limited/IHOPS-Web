// Records what each SMS really cost. See SmsSendLog in schema.prisma.

import { prisma } from "../lib/prisma";
import { smsSegments } from "../lib/smsSegments";
import type { SendResult } from "./notificationService";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Termii returns the account's remaining balance in every send response.
// The cost of THIS message is the drop since the previous recorded balance.
// That is exact when sends are sequential and an estimate if two overlap
// (their drops get attributed to whichever response lands first), and it's
// skipped (null) after a top-up, when the balance goes UP.
async function estimateCost(balanceAfter: number | undefined): Promise<number | null> {
  if (balanceAfter === undefined || Number.isNaN(balanceAfter)) return null;
  const prev = await prisma.smsSendLog.findFirst({
    where: { providerBalanceAfter: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { providerBalanceAfter: true },
  });
  if (!prev || prev.providerBalanceAfter === null) return null;
  const drop = prev.providerBalanceAfter - balanceAfter;
  return drop >= 0 ? round2(drop) : null;
}

// Best-effort: bookkeeping must never make a real send fail.
export async function recordSmsSend(p: {
  tenantId?: string | null;
  purpose: "patient" | "internal";
  to: string;
  body: string;
  unitsBilled: number;
  result: SendResult;
}): Promise<void> {
  try {
    const seg = smsSegments(p.body);
    const cost =
      p.result.providerCost ??
      (p.result.ok ? await estimateCost(p.result.providerBalance) : null);
    await prisma.smsSendLog.create({
      data: {
        tenantId: p.tenantId ?? null,
        purpose: p.purpose,
        toMasked: `***${p.to.replace(/\D/g, "").slice(-4)}`,
        characters: seg.characters,
        encoding: seg.encoding,
        pages: seg.pages,
        unitsBilled: p.result.ok ? p.unitsBilled : 0,
        ok: p.result.ok,
        providerRef: p.result.providerRef ?? null,
        providerBalanceAfter: p.result.providerBalance ?? null,
        costNaira: cost,
        error: p.result.ok ? null : (p.result.error ?? "unknown").slice(0, 300),
      },
    });
  } catch (err) {
    console.error("[recordSmsSend] failed to log SMS", err);
  }
}
