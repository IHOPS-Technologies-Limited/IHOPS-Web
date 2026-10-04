import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { Badge, ErrorBanner } from "../../components/ui";
import { CreditCard, ExternalLink, Loader2, MessageSquare } from "lucide-react";

// Mirrors PLAN_PRICES_KOBO in backend/src/modules/subscription/routes.ts —
// naira here (not kobo), purely for display. If you change a price on the
// backend, update it here too so the button labels stay accurate.
const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 15000, annual: 150000 },
  standard: { monthly: 35000, annual: 350000 },
};

const PLANS = [
  { code: "starter", label: "Starter" },
  { code: "standard", label: "Standard" },
];

function naira(amount: number) {
  return `₦${amount.toLocaleString()}`;
}

export default function Subscription() {
  const [params] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // True right after returning from Paystack's checkout page. Activation is
  // still webhook-driven (the source of truth — see subscription/routes.ts)
  // so this just polls for a few seconds to reflect that once it lands,
  // rather than leaving the page looking unchanged after a successful payment.
  const [awaitingWebhook, setAwaitingWebhook] = useState(
    params.get("paystack") === "callback",
  );
  const pollCount = useRef(0);

  // --- SMS wallet (prepaid, pay-as-you-go units) ---
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [awaitingSmsWebhook, setAwaitingSmsWebhook] = useState(
    params.get("paystack") === "sms_topup_callback",
  );
  const smsPollCount = useRef(0);
  const walletBalanceRef = useRef<number | undefined>(undefined);

  async function loadWallet() {
    const res = await api.get("/sms-wallet");
    setWallet(res);
    return res;
  }

  async function load() {
    const res = await api.get("/subscription/current");
    setData(res);
    return res;
  }

  useEffect(() => {
    load();
    loadWallet();
  }, []);

  useEffect(() => {
    if (!awaitingWebhook) return;
    const interval = setInterval(async () => {
      pollCount.current += 1;
      const res = await load();
      if (res.tenantStatus === "active" || pollCount.current >= 10) {
        setAwaitingWebhook(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [awaitingWebhook]);

  useEffect(() => {
    if (!awaitingSmsWebhook) return;
    const interval = setInterval(async () => {
      smsPollCount.current += 1;
      const res = await loadWallet();
      const balanceRose =
        walletBalanceRef.current !== undefined &&
        res.balanceUnits > walletBalanceRef.current;
      if (balanceRose || smsPollCount.current >= 10) {
        setAwaitingSmsWebhook(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [awaitingSmsWebhook]);

  async function buySmsPackage(packageKey: string) {
    walletBalanceRef.current = wallet?.balanceUnits;
    setWalletLoading(true);
    setError(null);
    try {
      const res = await api.post("/sms-wallet/topup", { packageKey });
      window.open(res.authorizationUrl, "_blank");
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setWalletLoading(false);
    }
  }

  async function checkout(planCode: string, billingCycle: string) {
    // The backend doesn't do proration/plan-switching today — every
    // checkout is a brand-new charge, and a successful webhook just
    // overwrites planCode/billingCycle/currentPeriodEnd on the one
    // Subscription row. That means switching plans or cycles while
    // already on an active, paid subscription would both charge twice
    // AND silently discard whatever time was already paid for. Until
    // that's built properly, block it here with a clear warning rather
    // than let it happen silently.
    if (data.tenantStatus === "active") {
      const proceed = window.confirm(
        "You already have an active paid subscription. Paystack will charge you again right now for this new plan, and the time remaining on your current plan/cycle will NOT be refunded or carried over — this app doesn't yet support prorated plan changes.\n\nTo avoid being charged twice, contact IHOPS support instead of using this button.\n\nContinue anyway?",
      );
      if (!proceed) return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/subscription/checkout", {
        planCode,
        billingCycle,
      });
      window.open(res.authorizationUrl, "_blank");
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <div className="text-slate-400">Loading…</div>;

  return (
    /* 1. Increased width to fit two columns, added flex row for medium screens and above */
    <div className="max-w-4xl flex flex-col md:flex-row gap-8">
      {/* LEFT COLUMN: Plan Info & Upgrade Options */}
      <div className="flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Subscription & Billing
          </h1>
          <p className="text-sm text-slate-500">
            Plan, billing cycle, and payment history
          </p>
        </div>

        <ErrorBanner message={error} />

        {awaitingWebhook && (
          <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Confirming your payment with Paystack — this updates automatically,
            usually within a few seconds.
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <CreditCard size={14} /> Current plan
            </span>
            <Badge tone={data.tenantStatus === "active" ? "teal" : "amber"}>
              {data.tenantStatus}
            </Badge>
          </div>
          <div className="text-xl font-display font-bold text-slate-800 capitalize">
            {data.subscription?.planCode?.replace("_", " ")}
          </div>
          <div className="text-sm text-slate-500 capitalize">
            {data.subscription?.billingCycle} billing
          </div>
          {data.trialEndsAt && (
            <div className="text-xs text-amber-700 mt-2">
              Trial ends {new Date(data.trialEndsAt).toLocaleDateString()}
            </div>
          )}
          {data.gracePeriodEndsAt && (
            <div className="text-xs text-red-500 mt-2">
              Grace period ends{" "}
              {new Date(data.gracePeriodEndsAt).toLocaleDateString()} — renew to
              avoid suspension
            </div>
          )}
        </div>

        <h2 className="font-display font-bold text-slate-800 mb-3">
          Upgrade / renew
        </h2>
        <div className="space-y-2 mb-6">
          {PLANS.map((p) => {
            const isCurrentMonthly =
              data.tenantStatus === "active" &&
              data.subscription?.planCode === p.code &&
              data.subscription?.billingCycle === "monthly";
            const isCurrentAnnual =
              data.tenantStatus === "active" &&
              data.subscription?.planCode === p.code &&
              data.subscription?.billingCycle === "annual";
            const prices = PLAN_PRICES[p.code];
            const annualMonthlyEquivalent = Math.round(prices.annual / 12);
            const annualSavings = prices.monthly * 12 - prices.annual;
            return (
              <div
                key={p.code}
                className="bg-white rounded-xl border border-slate-100 p-4"
              >
                <span className="font-medium text-slate-700">{p.label}</span>
                <div className="flex gap-2 mt-3">
                  {isCurrentMonthly ? (
                    <Badge tone="teal">Current plan</Badge>
                  ) : (
                    <button
                      className="flex-1 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg px-3 py-2.5 hover:bg-slate-50 disabled:opacity-50 flex flex-col items-center gap-0.5"
                      disabled={loading}
                      onClick={() => checkout(p.code, "monthly")}
                    >
                      <span>Monthly</span>
                      <span className="text-slate-800 font-semibold">
                        {naira(prices.monthly)}/mo
                      </span>
                    </button>
                  )}
                  {isCurrentAnnual ? (
                    <Badge tone="teal">Current plan</Badge>
                  ) : (
                    <button
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg px-3 py-2.5 disabled:opacity-50 flex flex-col items-center gap-0.5 relative"
                      disabled={loading}
                      onClick={() => checkout(p.code, "annual")}
                    >
                      {annualSavings > 0 && (
                        <span className="absolute -top-2 right-2 bg-teal-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                          Save {naira(annualSavings)}/yr
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        Annual <ExternalLink size={11} />
                      </span>
                      <span>
                        {naira(annualMonthlyEquivalent)}/mo{" "}
                        <span className="opacity-80">
                          ({naira(prices.annual)}/yr)
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: SMS Wallet down to the bottom */}
      <div className="flex-1">
        <h2 className="font-display font-bold text-slate-800 mb-3 md:mt-16">
          SMS wallet
        </h2>
        {awaitingSmsWebhook && (
          <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Confirming your SMS top-up with Paystack — units are credited
            automatically, usually within a few seconds.
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <MessageSquare size={14} /> SMS balance
            </span>
            <span className="text-xl font-display font-bold text-slate-800">
              {wallet ? wallet.balanceUnits.toLocaleString() : "…"}{" "}
              <span className="text-sm font-normal text-slate-400">units</span>
            </span>
          </div>
          {wallet && wallet.balanceUnits === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              Out of SMS units — patient SMS reminders won't send until you top
              up. WhatsApp and email are not affected.
            </p>
          )}
        </div>
        <div className="space-y-2 mb-6">
          {(wallet?.packages || []).map((pkg: any) => (
            <div
              key={pkg.key}
              className="bg-white rounded-xl border border-slate-100 p-4 flex justify-between items-center"
            >
              <div>
                <span className="font-medium text-slate-700">
                  {pkg.units.toLocaleString()} SMS units
                </span>
                <div className="text-xs text-slate-400">
                  ₦{(pkg.amountKobo / 100).toLocaleString()} · ₦
                  {(pkg.amountKobo / 100 / pkg.units).toFixed(2)}/unit
                </div>
              </div>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg px-3 py-2 flex items-center gap-1 disabled:opacity-50"
                disabled={walletLoading}
                onClick={() => buySmsPackage(pkg.key)}
              >
                Buy <ExternalLink size={11} />
              </button>
            </div>
          ))}
        </div>
        {wallet?.transactions?.length ? (
          <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 mb-6">
            {wallet.transactions.slice(0, 10).map((t: any) => (
              <div
                key={t.id}
                className="px-4 py-3 flex justify-between text-sm"
              >
                <span className="text-slate-500">
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
                <span className="text-slate-600 capitalize">{t.type}</span>
                <span className="font-mono text-slate-700">
                  {t.units > 0 ? "+" : ""}
                  {t.units}
                </span>
                <Badge
                  tone={
                    t.status === "success"
                      ? "teal"
                      : t.status === "pending"
                        ? "amber"
                        : "alert"
                  }
                >
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
