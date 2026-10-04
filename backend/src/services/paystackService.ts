// Paystack Subscriptions adapter (PRD Section 11.2).
//
// PAYSTACK_ENABLED=false (default) runs a mock flow: initializeTransaction
// returns a fake checkout URL and verifyWebhookSignature always passes, so
// the whole trial -> checkout -> webhook -> access-restored loop can be
// exercised locally. Flip PAYSTACK_ENABLED=true and set PAYSTACK_SECRET_KEY
// to hit the real API — call sites do not change.
//
// Design point carried over from the PRD: the webhook handler, not the
// client-side redirect, is the only thing that ever activates/renews/
// restores a subscription. See modules/subscription/routes.ts.
//
// SETUP REQUIRED before PAYSTACK_ENABLED=true will work:
// 1. In the Paystack Dashboard (Products -> Plans), create four Plans —
//    name/description are up to you, but set each one's Amount and
//    Interval to match PLAN_PRICES_KOBO in modules/subscription/routes.ts
//    exactly (when `plan` is present on an Initialize Transaction call,
//    Paystack charges the *Plan's configured amount*, not the `amount`
//    field this service also sends — so the two must be kept in sync
//    manually):
//      starter_monthly  -> Interval: Monthly,  Amount: ₦15,000
//      starter_annual   -> Interval: Annually, Amount: ₦150,000
//      standard_monthly -> Interval: Monthly,  Amount: ₦35,000
//      standard_annual  -> Interval: Annually, Amount: ₦350,000
//    Paystack does NOT let you choose a plan_code — dashboard and API both
//    auto-generate one (e.g. PLN_y4y1wkydoptw6zv) no matter what you name
//    the plan. After creating each one, copy its auto-generated Plan Code
//    from the dashboard (click into the plan to see it) and paste it into
//    the matching PAYSTACK_PLAN_* env var below — that's what actually
//    tells Paystack which plan a checkout is for.
// 2. In Dashboard -> Settings -> API Keys & Webhooks, set the webhook URL to
//    <your backend's public URL>/api/subscription/webhook/paystack, and
//    subscribe it to: charge.success, subscription.create,
//    subscription.disable, invoice.payment_failed.
// 3. Set PAYSTACK_SECRET_KEY to your Paystack secret key (test key while
//    developing, live key in production — they are different values with
//    different prefixes, sk_test_... vs sk_live_...).

import crypto from "crypto";

const enabled = process.env.PAYSTACK_ENABLED === "true";
const secretKey = process.env.PAYSTACK_SECRET_KEY || "";

// Real, Paystack-generated plan codes (PLN_xxxxxxxxxxxxx) — copy these from
// the Paystack dashboard after creating each Plan (see setup notes above).
// Our internal planCode ("starter_monthly" etc, used throughout the rest of
// the app/DB) is just a lookup key here, never sent to Paystack directly.
export const PLAN_CODE_MAP: Record<string, string> = {
  starter_monthly: process.env.PAYSTACK_PLAN_STARTER_MONTHLY || "",
  starter_annual: process.env.PAYSTACK_PLAN_STARTER_ANNUAL || "",
  standard_monthly: process.env.PAYSTACK_PLAN_STANDARD_MONTHLY || "",
  standard_annual: process.env.PAYSTACK_PLAN_STANDARD_ANNUAL || "",
};

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  planCode: string;
  metadata: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  if (!enabled) {
    const reference = `mock_ref_${Date.now()}`;
    console.log(
      `[MOCK PAYSTACK] initialize transaction for ${params.email}, plan=${params.planCode}, ref=${reference}`,
    );
    return {
      authorizationUrl: `https://mock-paystack.local/pay/${reference}`,
      reference,
    };
  }
  // A planCode that resolves to "" means either an unrecognized internal
  // code, or a recognized one whose PAYSTACK_PLAN_* env var was never set —
  // fail fast with a message that says which env var to fix, rather than
  // sending plan: "" to Paystack and getting back the same generic
  // "Plan not found" this is meant to prevent. Intentionally NOT applied
  // when planCode isn't a PLAN_CODE_MAP key at all (e.g. smsWalletService's
  // one-off topup charges, which have no plan and shouldn't hit this).
  if (params.planCode in PLAN_CODE_MAP && !PLAN_CODE_MAP[params.planCode]) {
    throw new Error(
      `No Paystack plan code configured for "${params.planCode}" — set PAYSTACK_PLAN_${params.planCode.toUpperCase()} in .env to the Plan Code shown in the Paystack dashboard for this plan.`,
    );
  }
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      plan: PLAN_CODE_MAP[params.planCode] || undefined,
      metadata: params.metadata,
      callback_url: params.callbackUrl,
    }),
  });
  const data: any = await res.json();
  if (!data.status) {
    // Paystack returns {status:false, message:"..."} on failure (e.g. an
    // invalid/unrecognized plan code) rather than an HTTP error — surface
    // that message instead of crashing on `data.data.authorization_url`
    // being undefined.
    throw new Error(
      data.message || "Paystack transaction initialization failed",
    );
  }
  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  if (!enabled) return true; // mock mode: accept all (used for local testing of the webhook flow)
  if (!signatureHeader) return false;
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  return hash === signatureHeader;
}
