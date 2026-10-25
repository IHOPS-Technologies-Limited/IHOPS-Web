// IHOPS Internal console — platform-wide information: overview, system/
// integration health, audit trail and subscription revenue.
//
// Read-mostly. Secrets are NEVER returned: integration checks report only
// whether a value is configured (true/false) plus a few explicitly
// non-secret settings (sender id, from-address, public base URL).

import os from "os";
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../middleware/audit";
import { sendEmail, sendWhatsApp } from "../../services/notificationService";
import { runTrialAndGraceSweep } from "../../jobs/scheduler";

const router = Router();
const DAY = 24 * 60 * 60 * 1000;
const startedAt = new Date();

const h =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// ---------------------------------------------------------------------------
// OVERVIEW — the "what needs attention today" screen
// ---------------------------------------------------------------------------

router.get(
  "/overview",
  h(async (_req, res) => {
    const now = new Date();
    const d1 = new Date(now.getTime() - DAY);
    const d7 = new Date(now.getTime() - 7 * DAY);
    const d30 = new Date(now.getTime() - 30 * DAY);
    const in3d = new Date(now.getTime() + 3 * DAY);

    const [
      statusGroups,
      signups7,
      signups30,
      stuckVerification,
      stuckOnboarding,
      trialsEnding,
      graceList,
      suspendedCount,
      openTickets,
      pendingApprovals,
      revenueAll,
      revenue30,
      failedPayments30,
      walletTotals,
      lowWallets,
      failedComms,
    ] = await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.tenant.count({ where: { createdAt: { gte: d7 } } }),
      prisma.tenant.count({ where: { createdAt: { gte: d30 } } }),
      // Signed up >24h ago and still hasn't verified the email.
      prisma.tenant.findMany({
        where: { status: "pending_verification", createdAt: { lt: d1 } },
        select: { id: true, hospitalName: true, email: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
      // Verified, live, but never finished the setup wizard.
      prisma.tenant.findMany({
        where: {
          setupWizardCompleted: false,
          status: { in: ["trialing", "active", "grace_period"] },
          createdAt: { lt: d1 },
        },
        select: {
          id: true,
          hospitalName: true,
          email: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
      prisma.tenant.findMany({
        where: { status: "trialing", trialEndsAt: { gte: now, lte: in3d } },
        select: { id: true, hospitalName: true, trialEndsAt: true },
        orderBy: { trialEndsAt: "asc" },
        take: 20,
      }),
      prisma.tenant.findMany({
        where: { status: "grace_period" },
        select: { id: true, hospitalName: true, gracePeriodEndsAt: true },
        orderBy: { gracePeriodEndsAt: "asc" },
        take: 20,
      }),
      prisma.tenant.count({ where: { status: "suspended" } }),
      prisma.supportTicket.count({ where: { status: { not: "resolved" } } }),
      prisma.tenant.count({ where: { status: "pending_approval" } }),
      prisma.paymentHistory.aggregate({
        where: { status: "success" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.paymentHistory.aggregate({
        where: { status: "success", paidAt: { gte: d30 } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.paymentHistory.count({
        where: { status: "failed", paidAt: { gte: d30 } },
      }),
      prisma.smsWallet.aggregate({
        _sum: { balanceUnits: true },
        _count: { _all: true },
      }),
      prisma.smsWallet.findMany({
        where: {
          balanceUnits: { lt: 20 },
          tenant: { status: { in: ["active", "trialing", "grace_period"] } },
        },
        select: {
          balanceUnits: true,
          tenant: { select: { id: true, hospitalName: true } },
        },
        orderBy: { balanceUnits: "asc" },
        take: 15,
      }),
      prisma.communicationLog.groupBy({
        by: ["channel", "failureReason"],
        where: { status: "failed", createdAt: { gte: d7 } },
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const g of statusGroups) statusCounts[g.status] = g._count._all;

    res.json({
      tenants: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        byStatus: statusCounts,
        signupsLast7Days: signups7,
        signupsLast30Days: signups30,
        suspended: suspendedCount,
      },
      queues: { pendingApprovals, openTickets },
      attention: {
        stuckVerification,
        stuckOnboarding,
        trialsEnding,
        gracePeriod: graceList,
        lowSmsWallets: lowWallets.map((w) => ({
          id: w.tenant.id,
          hospitalName: w.tenant.hospitalName,
          balanceUnits: w.balanceUnits,
        })),
      },
      revenue: {
        currency: "NGN",
        totalCollected: revenueAll._sum.amount ?? 0,
        totalPayments: revenueAll._count._all,
        last30Days: revenue30._sum.amount ?? 0,
        payments30Days: revenue30._count._all,
        failedLast30Days: failedPayments30,
      },
      sms: {
        wallets: walletTotals._count._all,
        unitsOutstanding: walletTotals._sum.balanceUnits ?? 0,
      },
      failedMessages7d: failedComms.map((f) => ({
        channel: f.channel,
        reason: f.failureReason,
        count: f._count._all,
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// SYSTEM — configuration & health, the things you'd otherwise check in Render
// ---------------------------------------------------------------------------

const isSet = (name: string) =>
  !!(process.env[name] && process.env[name]!.trim() !== "");
const flag = (name: string) => process.env[name] === "true";

router.get(
  "/system",
  h(async (_req, res) => {
    // Database round-trip.
    let db: { ok: boolean; latencyMs: number | null; error?: string } = {
      ok: false,
      latencyMs: null,
    };
    const t0 = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = { ok: true, latencyMs: Date.now() - t0 };
    } catch (e: any) {
      db = {
        ok: false,
        latencyMs: null,
        error: String(e?.message || e).slice(0, 200),
      };
    }

    const [tenants, staff, patients, visits, comms, audit, superAdmins] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.staff.count(),
        prisma.patient.count(),
        prisma.visit.count(),
        prisma.communicationLog.count(),
        prisma.auditLog.count(),
        prisma.superAdmin.count(),
      ]).catch(() => [0, 0, 0, 0, 0, 0, 0]);

    const paystackKey = process.env.PAYSTACK_SECRET_KEY || "";
    const planVars = [
      "PAYSTACK_PLAN_STARTER_MONTHLY",
      "PAYSTACK_PLAN_STARTER_ANNUAL",
      "PAYSTACK_PLAN_STANDARD_MONTHLY",
      "PAYSTACK_PLAN_STANDARD_ANNUAL",
    ];
    const smsProvider = process.env.SMS_PROVIDER || "termii";

    const integration = (
      key: string,
      label: string,
      enabled: boolean,
      required: string[],
      details: Record<string, string | number | boolean | null> = {},
    ) => {
      const missing = required.filter((n) => !isSet(n));
      return {
        key,
        label,
        enabled,
        // "live" = switched on AND fully configured; "misconfigured" = switched
        // on but missing credentials (sends will fail); "mock" = switched off,
        // messages are only logged.
        state: enabled
          ? missing.length === 0
            ? "live"
            : "misconfigured"
          : "mock",
        missing: enabled ? missing : [],
        details,
      };
    };

    const integrations = [
      integration(
        "email",
        "Email (Resend)",
        flag("EMAIL_PROVIDER_ENABLED"),
        ["RESEND_API_KEY", "RESEND_FROM"],
        {
          from: process.env.RESEND_FROM || null,
        },
      ),
      integration(
        "sms",
        `SMS (${smsProvider})`,
        flag("SMS_PROVIDER_ENABLED"),
        [
          "SMS_API_KEY",
          ...(smsProvider === "africastalking"
            ? ["AFRICASTALKING_USERNAME"]
            : []),
        ],
        { provider: smsProvider, senderId: process.env.SMS_SENDER_ID || null },
      ),
      // Templates are REQUIRED to reach patients outside WhatsApp's 24-hour
      // window, so a missing general template counts as misconfigured.
      integration(
        "whatsapp",
        "WhatsApp Business (shared IHOPS number)",
        flag("WHATSAPP_PROVIDER_ENABLED"),
        [
          "WHATSAPP_ACCESS_TOKEN",
          "WHATSAPP_PHONE_NUMBER_ID",
          "WHATSAPP_TEMPLATE_GENERAL",
        ],
        {
          generalTemplate: process.env.WHATSAPP_TEMPLATE_GENERAL || null,
          birthdayTemplate:
            process.env.WHATSAPP_TEMPLATE_BIRTHDAY || "(uses general)",
          language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
          unitsPerMessage: process.env.WHATSAPP_UNITS_PER_MESSAGE ?? "1",
        },
      ),
      integration(
        "paystack",
        "Paystack payments",
        flag("PAYSTACK_ENABLED"),
        ["PAYSTACK_SECRET_KEY", ...planVars],
        {
          keyMode: paystackKey.startsWith("sk_live")
            ? "live"
            : paystackKey.startsWith("sk_test")
              ? "test"
              : paystackKey
                ? "unrecognised"
                : "not set",
          planCodesConfigured: planVars.filter(isSet).length + " of 4",
        },
      ),
      integration(
        "ai",
        "AI reminders (Claude)",
        flag("AI_REMINDERS_PROVIDER_ENABLED"),
        ["ANTHROPIC_API_KEY"],
      ),
    ];

    const baseUrl = process.env.APP_BASE_URL || "";
    const security = [
      {
        label: "Tenant JWT secret is set",
        ok: isSet("JWT_SECRET"),
        hint: "Without JWT_SECRET the server falls back to a publicly known development secret.",
      },
      {
        label: "Super Admin JWT secret is set and different",
        ok:
          isSet("SUPER_ADMIN_JWT_SECRET") &&
          process.env.SUPER_ADMIN_JWT_SECRET !== process.env.JWT_SECRET,
        hint: "The two secrets must differ — that's what keeps tenant tokens out of this console.",
      },
      {
        label: "APP_BASE_URL uses https and has no trailing slash",
        ok: baseUrl.startsWith("https://") && !baseUrl.endsWith("/"),
        hint: `Currently “${baseUrl || "not set"}”. A trailing slash breaks emailed links.`,
      },
      {
        label: "NODE_ENV is production",
        ok: process.env.NODE_ENV === "production",
        hint: `Currently “${process.env.NODE_ENV || "not set"}”.`,
      },
      {
        label: "Team alert email (IHOPS_TEAM_EMAIL) is set",
        ok: isSet("IHOPS_TEAM_EMAIL"),
        hint: "Without it nobody is emailed when a new hospital signs up.",
      },
    ];

    // SMS cost tracking (SmsSendLog): what messaging really cost in the
    // last 30 days vs the units billed to hospitals.
    const since = new Date(Date.now() - 30 * DAY);
    const window = { createdAt: { gte: since } };
    const [byPurpose, costed, multiPage, unicodeMsgs, latestBal, recentSms] =
      await Promise.all([
        prisma.smsSendLog.groupBy({
          by: ["purpose"],
          where: window,
          _count: { _all: true },
          _sum: { pages: true, unitsBilled: true, costNaira: true },
        }),
        prisma.smsSendLog.aggregate({
          where: { ...window, costNaira: { not: null } },
          _sum: { pages: true, costNaira: true },
        }),
        prisma.smsSendLog.count({ where: { ...window, pages: { gt: 1 } } }),
        prisma.smsSendLog.count({ where: { ...window, encoding: "unicode" } }),
        prisma.smsSendLog.findFirst({
          where: { providerBalanceAfter: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { providerBalanceAfter: true, createdAt: true },
        }),
        prisma.smsSendLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
      ]).catch(
        () => [[], { _sum: { pages: 0, costNaira: 0 } }, 0, 0, null, []] as any,
      );
    const tenantNames = new Map<string, string>();
    const smsTenantIds = [
      ...new Set((recentSms as any[]).map((r) => r.tenantId).filter(Boolean)),
    ] as string[];
    if (smsTenantIds.length) {
      const ts = await prisma.tenant.findMany({
        where: { id: { in: smsTenantIds } },
        select: { id: true, hospitalName: true },
      });
      ts.forEach((t) => tenantNames.set(t.id, t.hospitalName));
    }
    const purposeStats = (purpose: string) => {
      const g = (byPurpose as any[]).find((x) => x.purpose === purpose);
      return {
        messages: g?._count._all ?? 0,
        pages: g?._sum.pages ?? 0,
        unitsBilled: g?._sum.unitsBilled ?? 0,
        costNaira: Math.round((g?._sum.costNaira ?? 0) * 100) / 100,
      };
    };
    const costedPages = (costed as any)._sum.pages ?? 0;
    const smsCosts = {
      windowDays: 30,
      patient: purposeStats("patient"),
      internal: purposeStats("internal"),
      multiPageMessages: multiPage as number,
      unicodeMessages: unicodeMsgs as number,
      avgCostPerPage:
        costedPages > 0
          ? Math.round(
              (((costed as any)._sum.costNaira ?? 0) / costedPages) * 100,
            ) / 100
          : null,
      latestProviderBalance: (latestBal as any)?.providerBalanceAfter ?? null,
      latestBalanceAt: (latestBal as any)?.createdAt ?? null,
      recent: (recentSms as any[]).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        purpose: r.purpose,
        hospital: r.tenantId
          ? (tenantNames.get(r.tenantId) ?? "Deleted hospital")
          : null,
        to: r.toMasked,
        characters: r.characters,
        encoding: r.encoding,
        pages: r.pages,
        unitsBilled: r.unitsBilled,
        ok: r.ok,
        costNaira: r.costNaira,
        error: r.error,
      })),
    };

    const mem = process.memoryUsage();
    res.json({
      server: {
        startedAt,
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()}`,
        environment: process.env.NODE_ENV || "development",
        memoryMb: {
          rss: Math.round(mem.rss / 1048576),
          heapUsed: Math.round(mem.heapUsed / 1048576),
        },
        appBaseUrl: baseUrl || null,
        serverTime: new Date(),
      },
      database: {
        ...db,
        provider: "PostgreSQL (Neon)",
        rows: {
          tenants,
          staff,
          patients,
          visits,
          communicationLogs: comms,
          auditLogs: audit,
          superAdmins,
        },
      },
      integrations,
      smsCosts,
      business: {
        trialLengthDays: Number(process.env.TRIAL_LENGTH_DAYS || 7),
        gracePeriodDays: Number(process.env.GRACE_PERIOD_DAYS || 5),
      },
      scheduledJobs: [
        { name: "Birthday messages", every: "24 hours" },
        { name: "Trial expiry → grace → suspension sweep", every: "1 hour" },
        { name: "Trial-ending-soon reminder", every: "24 hours" },
      ],
      security,
      note: "Environment variables are changed in the Render dashboard (Environment tab). This page only reports their state — it never shows secret values.",
    });
  }),
);

// Sends a real email through the configured provider so a misconfigured
// RESEND_FROM / domain is caught from the console instead of silently
// dropping signup and reset emails.
router.post(
  "/system/test-email",
  h(async (req, res) => {
    const { to } = z.object({ to: z.string().trim().email() }).parse(req.body);
    const result = await sendEmail(
      to,
      "IHOPS test email",
      `This is a test email sent from the IHOPS Internal console at ${new Date().toISOString()}.\n\nIf you can read this, outbound email is working.`,
    );
    await writeAuditLog({
      superAdminId: req.superAdmin!.id,
      actionType: "superadmin.test_email",
      entityType: "System",
      metadata: { to, ok: result.ok },
    });
    const live = flag("EMAIL_PROVIDER_ENABLED");
    res.json({
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      mocked: !live,
      message: !live
        ? "EMAIL_PROVIDER_ENABLED is not “true”, so nothing was actually sent — the message was only logged on the server."
        : result.ok
          ? `Test email accepted by the provider for ${to}. Check the inbox (and spam).`
          : `The provider rejected the email: ${result.error}`,
    });
  }),
);

// Sends the real WhatsApp template to a number you choose, so the whole chain
// (token, phone number ID, template name/language, payment method) is proven
// before any patient is messaged. Uses one template message from your Meta
// balance; no hospital wallet is charged.
router.post(
  "/system/test-whatsapp",
  h(async (req, res) => {
    const { to } = z
      .object({ to: z.string().trim().min(7).max(30) })
      .parse(req.body);
    const result = await sendWhatsApp(
      to,
      "This is a test message from the IHOPS Internal console. If you can read this, WhatsApp delivery is working.",
      { kind: "general", recipientName: "Test", hospitalName: "IHOPS" },
    );
    await writeAuditLog({
      superAdminId: req.superAdmin!.id,
      actionType: "superadmin.test_whatsapp",
      entityType: "System",
      metadata: { ok: result.ok },
    });
    const live = flag("WHATSAPP_PROVIDER_ENABLED");
    res.json({
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      mocked: !live,
      message: !live
        ? "WHATSAPP_PROVIDER_ENABLED is not “true”, so nothing was actually sent."
        : result.ok
          ? "WhatsApp accepted the message. Check the phone — delivery can take a few seconds."
          : result.error,
    });
  }),
);

// Runs the hourly trial → grace → suspension sweep on demand (it's idempotent:
// it only touches hospitals whose dates have already passed).
router.post(
  "/system/run-sweep",
  h(async (req, res) => {
    const before = await prisma.tenant.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    await runTrialAndGraceSweep();
    const after = await prisma.tenant.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const toMap = (g: typeof before) =>
      Object.fromEntries(g.map((x) => [x.status, x._count._all]));
    const b = toMap(before);
    const a = toMap(after);
    const changes = Object.keys({ ...b, ...a })
      .map((s) => ({ status: s, before: b[s] ?? 0, after: a[s] ?? 0 }))
      .filter((c) => c.before !== c.after);
    await writeAuditLog({
      superAdminId: req.superAdmin!.id,
      actionType: "superadmin.run_sweep",
      entityType: "System",
      metadata: { changes },
    });
    res.json({
      message: changes.length
        ? "Sweep complete — some hospitals moved to a new status."
        : "Sweep complete — nothing needed changing.",
      changes,
    });
  }),
);

// ---------------------------------------------------------------------------
// AUDIT LOG
// ---------------------------------------------------------------------------

router.get(
  "/audit-logs",
  h(async (req, res) => {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1),
      100,
    );
    const cursor = String(req.query.cursor || "");
    const scope = String(req.query.scope || "all"); // all | internal | hospital
    const tenantId = String(req.query.tenantId || "");
    const actionType = String(req.query.actionType || "").trim();

    const where: any = {};
    if (scope === "internal") where.superAdminId = { not: null };
    if (scope === "hospital") where.superAdminId = null;
    if (tenantId) where.tenantId = tenantId;
    if (actionType)
      where.actionType = { contains: actionType, mode: "insensitive" };

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        tenant: { select: { hospitalName: true } },
        staff: { select: { name: true, staffIdDisplay: true } },
      },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const adminIds = [
      ...new Set(page.map((r) => r.superAdminId).filter(Boolean)),
    ] as string[];
    const admins = adminIds.length
      ? await prisma.superAdmin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true },
        })
      : [];
    const adminName = new Map(admins.map((a) => [a.id, a.name]));

    res.json({
      logs: page.map((r) => {
        let metadata: unknown = null;
        if (r.metadata) {
          try {
            metadata = JSON.parse(r.metadata);
          } catch {
            metadata = r.metadata;
          }
        }
        return {
          id: r.id,
          createdAt: r.createdAt,
          actionType: r.actionType,
          entityType: r.entityType,
          entityId: r.entityId,
          hospital: r.tenant?.hospitalName ?? null,
          tenantId: r.tenantId,
          actor: r.superAdminId
            ? `${adminName.get(r.superAdminId) ?? "Super Admin"} (IHOPS Internal)`
            : r.staff
              ? `${r.staff.name} (${r.staff.staffIdDisplay})`
              : "System",
          internal: !!r.superAdminId,
          metadata,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }),
);

// ---------------------------------------------------------------------------
// PAYMENTS — subscription revenue across hospitals
// ---------------------------------------------------------------------------

router.get(
  "/payments",
  h(async (req, res) => {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1),
      300,
    );
    const status = String(req.query.status || "");
    const rows = await prisma.paymentHistory.findMany({
      where: status ? { status } : {},
      orderBy: { paidAt: "desc" },
      take: limit,
      include: {
        subscription: {
          select: {
            planCode: true,
            tenant: { select: { id: true, hospitalName: true } },
          },
        },
      },
    });
    res.json({
      payments: rows.map((p) => ({
        id: p.id,
        paidAt: p.paidAt,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        reference: p.paystackReference,
        manual: !!p.paystackReference?.startsWith("manual:"),
        plan: p.subscription.planCode,
        hospital: p.subscription.tenant.hospitalName,
        tenantId: p.subscription.tenant.id,
      })),
    });
  }),
);

export default router;
