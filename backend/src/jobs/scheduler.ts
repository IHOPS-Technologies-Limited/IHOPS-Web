import { prisma } from "../lib/prisma";
import { birthdayMessage } from "../services/reminderService";
import { sendOnChannel, sendEmail } from "../services/notificationService";

/**
 * Lightweight in-process scheduler (setInterval-based) so the whole product
 * — including birthday messages, trial-expiry notices, and grace-period
 * suspension — is demonstrable without standing up a separate worker/queue.
 * In production, replace with a real scheduler (cron, BullMQ, etc.) calling
 * these same functions; nothing about their logic depends on setInterval.
 */
export function startScheduledJobs() {
  runBirthdayMessages();
  runTrialAndGraceSweep();
  runTrialEndingSoonReminder();
  setInterval(runBirthdayMessages, 24 * 60 * 60 * 1000);
  setInterval(runTrialAndGraceSweep, 60 * 60 * 1000);
  setInterval(runTrialEndingSoonReminder, 24 * 60 * 60 * 1000);
}

// 16.2 Birthday Messages
export async function runBirthdayMessages() {
  const today = new Date();
  const tenants = await prisma.tenant.findMany({
    where: {
      birthdayMessagesEnabled: true,
      status: { in: ["active", "trialing"] },
    },
  });
  for (const tenant of tenants) {
    const patients = await prisma.patient.findMany({
      where: { tenantId: tenant.id },
    });
    for (const p of patients) {
      if (
        p.dob.getUTCMonth() === today.getUTCMonth() &&
        p.dob.getUTCDate() === today.getUTCDate()
      ) {
        const body = birthdayMessage(p.name, tenant.hospitalName);
        const to = p.preferredChannel === "email" ? p.email : p.phone;
        if (!to) continue;
        const result = await sendOnChannel(
          p.preferredChannel as any,
          to,
          body,
          "Happy Birthday!",
        );
        await prisma.communicationLog.create({
          data: {
            tenantId: tenant.id,
            patientId: p.id,
            trigger: "birthday",
            channel: p.preferredChannel as any,
            messageBody: body,
            status: result.ok ? "sent" : "failed",
            sentAt: result.ok ? new Date() : null,
          },
        });
      }
    }
  }
}

// Section 10.1 / 11.2 — trial expiry -> grace period -> suspension sweep.
export async function runTrialAndGraceSweep() {
  const now = new Date();
  const graceDays = Number(process.env.GRACE_PERIOD_DAYS || 5);

  const expiredTrials = await prisma.tenant.findMany({
    where: { status: "trialing", trialEndsAt: { lt: now } },
  });
  for (const t of expiredTrials) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        status: "grace_period",
        gracePeriodEndsAt: new Date(
          now.getTime() + graceDays * 24 * 60 * 60 * 1000,
        ),
      },
    });
    await prisma.subscription
      .update({ where: { tenantId: t.id }, data: { status: "grace_period" } })
      .catch(() => {});
    await sendEmail(
      t.email,
      "Your IHOPS trial has ended",
      `Hello,\n\nYour 7-day free trial for ${t.hospitalName} has come to an end. We've started a ${graceDays}-day grace period, so nothing changes right away — your team can keep using IHOPS exactly as before while you sort out billing.\n\nTo avoid any interruption once the grace period ends, add a subscription from your Subscription & Billing page:\n\n${process.env.APP_BASE_URL}/app/admin/subscription\n\nOne thing worth saying clearly: none of your data — patients, visits, clinical notes, anything — is affected by this, whether you renew today or on the last day of the grace period.\n\nIf you have any questions about plans or pricing, just reply to this email or raise a support ticket from inside IHOPS.\n\nThe IHOPS Team`,
    );
  }

  const expiredGrace = await prisma.tenant.findMany({
    where: { status: "grace_period", gracePeriodEndsAt: { lt: now } },
  });
  for (const t of expiredGrace) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: { status: "suspended" },
    });
    await prisma.subscription
      .update({ where: { tenantId: t.id }, data: { status: "suspended" } })
      .catch(() => {});
    await sendEmail(
      t.email,
      "Your IHOPS account has been suspended",
      `Hello,\n\nAccess to IHOPS for ${t.hospitalName} has been suspended — your grace period ended without an active subscription in place.\n\nHere's the important part: nothing has been deleted. Every patient record, visit, clinical note, and financial record is exactly as you left it, safely stored and waiting for you.\n\nTo restore access immediately, add a subscription here:\n\n${process.env.APP_BASE_URL}/app/admin/subscription\n\nAccess typically comes back within moments of a successful payment. If you run into any trouble or believe this happened in error, please raise a support ticket or reply to this email and we'll help sort it out.\n\nThe IHOPS Team`,
    );
  }
}

// A one-time-per-tenant heads-up before the trial actually ends, so renewal
// isn't a surprise. Runs daily; the ~24h window means each tenant falls into
// it on exactly one run under normal operation.
export async function runTrialEndingSoonReminder() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const endingSoon = await prisma.tenant.findMany({
    where: {
      status: "trialing",
      trialEndsAt: { gte: windowStart, lt: windowEnd },
    },
  });
  for (const t of endingSoon) {
    await sendEmail(
      t.email,
      "Your IHOPS trial ends tomorrow",
      `Hello,\n\nJust a heads-up: the free trial for ${t.hospitalName} ends tomorrow, ${t.trialEndsAt?.toLocaleDateString()}.\n\nTo keep your team's access uninterrupted, add a subscription before then from your Subscription & Billing page:\n\n${process.env.APP_BASE_URL}/app/admin/subscription\n\nIf your trial does lapse before you get to this, don't worry — you'll get a short grace period afterward before anything is restricted, and nothing about your data changes either way.\n\nQuestions about which plan fits your hospital? Just reply to this email or raise a support ticket from inside IHOPS.\n\nThe IHOPS Team`,
    );
  }
}
