import React, { useState } from "react";
import { superAdminApi } from "../../../api/client";
import { amberButton, ghostButton, darkInput, smallButton } from "../../../components/superadmin/styles";
import { Card, KV, Field, Empty, DarkBadge, StatusBadge, ConfirmDialog, errText, fmtDate, fmtNaira, titleCase } from "../../../components/superadmin/ui";
import type { TabProps } from "../HospitalDetail";

const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: "active", label: "Set active" },
  { status: "trialing", label: "Set on trial" },
  { status: "grace_period", label: "Set grace period" },
  { status: "suspended", label: "Suspend" },
];

export default function SubscriptionTab({ data, reload, notify }: TabProps) {
  const h = data.hospital;
  const sub = data.subscription;
  const hid = h.id;
  const locked = h.status === "pending_verification" || h.status === "pending_approval";

  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [tell, setTell] = useState(true);
  const [days, setDays] = useState("7");
  const [plan, setPlan] = useState({
    planCode: sub?.planCode || "starter",
    billingCycle: sub?.billingCycle || "monthly",
    activate: false,
    recordPayment: false,
    amount: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);

  async function extend() {
    setBusy(true);
    try {
      const r = await superAdminApi.post(`/internal/hospitals/${hid}/extend-trial`, { days: parseInt(days, 10) });
      notify({ kind: "ok", text: `${r.message}. Now ends ${fmtDate(r.trialEndsAt, false)}.` });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function applyPlan() {
    setBusy(true);
    try {
      const isPublic = plan.planCode === "public_hospital";
      await superAdminApi.post(`/internal/hospitals/${hid}/subscription`, {
        planCode: plan.planCode,
        billingCycle: isPublic ? "none" : plan.billingCycle === "none" ? "monthly" : plan.billingCycle,
        activate: plan.activate,
        ...(plan.recordPayment ? { payment: { amountNaira: Number(plan.amount), note: plan.note } } : {}),
      });
      notify({ kind: "ok", text: "Subscription updated." });
      setPlan({ ...plan, recordPayment: false, amount: "", note: "" });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Access status">
        <div className="flex items-center gap-2 mb-4">
          <StatusBadge status={h.status} />
          <span className="text-xs text-slate-500">Controls whether the hospital's staff can sign in.</span>
        </div>
        {locked ? (
          <p className="text-sm text-amber-300/90">
            {h.status === "pending_verification"
              ? "Email not verified yet — verify it from the Overview tab first."
              : "Pending Public Hospital application — decide it in the Approval Queue."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.filter((a) => a.status !== h.status).map((a) => (
              <button key={a.status} className={a.status === "suspended" ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium rounded-lg px-3 py-2" : ghostButton} onClick={() => { setReason(""); setTell(true); setTarget(a.status); }}>
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-5">
          <KV label="Trial ends">{fmtDate(h.trialEndsAt)}</KV>
          <KV label="Grace ends">{fmtDate(h.gracePeriodEndsAt)}</KV>
          <KV label="Current period ends">{fmtDate(sub?.currentPeriodEnd)}</KV>
          <KV label="Paystack subscription">{sub?.paystackSubscriptionCode ? "Linked" : "None"}</KV>
        </div>
      </Card>

      <Card title="Extend trial">
        {["trialing", "grace_period", "suspended"].includes(h.status) ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Adds days to the trial and restores access immediately if it had lapsed.</p>
            <div className="flex gap-2 items-end">
              <Field label="Days"><input className={`${darkInput} w-24`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} /></Field>
              <button className={amberButton} disabled={busy || !days || +days < 1 || +days > 90} onClick={extend}>Extend</button>
            </div>
            <div className="flex gap-1.5">
              {[3, 7, 14, 30].map((d) => <button key={d} className={smallButton} onClick={() => setDays(String(d))}>{d}d</button>)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Only available for hospitals on trial, in grace, or suspended.</p>
        )}
      </Card>

      <Card title="Change plan manually" className="lg:col-span-2">
        <p className="text-sm text-slate-400 mb-4">
          For bank-transfer payments, goodwill upgrades or corrections. This doesn't touch Paystack — if they're paying by card, their Paystack subscription continues separately.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Plan">
            <select className={darkInput} value={plan.planCode} onChange={(e) => setPlan({ ...plan, planCode: e.target.value })}>
              <option value="starter">Starter</option>
              <option value="standard">Standard</option>
              <option value="public_hospital">Public Hospital</option>
            </select>
          </Field>
          <Field label="Billing">
            <select className={darkInput} disabled={plan.planCode === "public_hospital"} value={plan.planCode === "public_hospital" ? "none" : plan.billingCycle === "none" ? "monthly" : plan.billingCycle} onChange={(e) => setPlan({ ...plan, billingCycle: e.target.value })}>
              {plan.planCode === "public_hospital" ? <option value="none">None</option> : (<><option value="monthly">Monthly</option><option value="annual">Annual</option></>)}
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2.5 text-sm text-slate-300">
            <input type="checkbox" className="accent-amber-500" checked={plan.activate} onChange={(e) => setPlan({ ...plan, activate: e.target.checked })} />
            Also set status to Active
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 mt-4">
          <input type="checkbox" className="accent-amber-500" checked={plan.recordPayment} onChange={(e) => setPlan({ ...plan, recordPayment: e.target.checked })} />
          Record a manual payment (shows in payment history and revenue)
        </label>
        {plan.recordPayment && (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <Field label="Amount (₦)"><input className={darkInput} inputMode="decimal" value={plan.amount} onChange={(e) => setPlan({ ...plan, amount: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
            <Field label="Note / reference"><input className={darkInput} placeholder="e.g. GTBank transfer 12 Oct" value={plan.note} onChange={(e) => setPlan({ ...plan, note: e.target.value })} /></Field>
          </div>
        )}
        <div className="mt-4">
          <button className={amberButton} disabled={busy || (plan.recordPayment && (!(+plan.amount > 0) || plan.note.trim().length < 2))} onClick={applyPlan}>
            {busy ? "Saving…" : "Apply"}
          </button>
        </div>
      </Card>

      <Card title="Subscription payments" className="lg:col-span-2">
        {data.payments.length === 0 ? (
          <Empty>No subscription payments yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium text-right">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{fmtDate(p.paidAt)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmtNaira(p.amount)}</td>
                    <td className="py-2 pr-3"><DarkBadge tone={p.status === "success" ? "green" : p.status === "failed" ? "red" : "amber"}>{p.status}</DarkBadge></td>
                    <td className="py-2 text-xs text-slate-500 font-mono break-all">{p.paystackReference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Set ${titleCase(target)}?`}
        confirmLabel="Confirm"
        danger={target === "suspended"}
        onConfirm={async () => {
          const r = await superAdminApi.post(`/internal/hospitals/${hid}/status`, { status: target, notify: tell, reason: reason.trim() || undefined });
          setTarget(null);
          notify({ kind: "ok", text: r.message });
          await reload();
        }}
      >
        <p>
          {target === "suspended"
            ? "Staff will be blocked from signing in. Nothing is deleted."
            : target === "active"
              ? "Staff regain full access and any grace period is cleared."
              : target === "trialing"
                ? "Staff keep access during the trial. If the trial date has passed, a fresh trial starts."
                : "Staff keep access until the grace period ends, then the account suspends."}
        </p>
        {target === "suspended" && (
          <Field label="Reason (optional, included in the email)">
            <input className={darkInput} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        {(target === "suspended" || h.status === "suspended") && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-amber-500" checked={tell} onChange={(e) => setTell(e.target.checked)} />
            Email the hospital about this change
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
}
