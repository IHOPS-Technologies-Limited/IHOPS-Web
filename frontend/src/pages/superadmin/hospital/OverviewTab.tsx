import React, { useState } from "react";
import { superAdminApi } from "../../../api/client";
import { amberButton, ghostButton, darkInput } from "../../../components/superadmin/styles";
import { Card, KV, Field, DarkBadge, SecretModal, errText, fmtDate } from "../../../components/superadmin/ui";
import type { TabProps } from "../HospitalDetail";

const HOSPITAL_TYPES = [
  "General Hospital", "Private Clinic", "Teaching Hospital", "Dental Clinic",
  "Veterinary Clinic", "Eye Clinic", "Physiotherapy Clinic", "Diagnostic Centre", "Specialist Clinic",
];

const FIELDS: { key: string; label: string }[] = [
  { key: "hospitalName", label: "Hospital name" },
  { key: "contactPerson", label: "Contact person" },
  { key: "email", label: "Email (also moves the administrator login)" },
  { key: "phone", label: "Phone" },
  { key: "state", label: "State" },
  { key: "lga", label: "LGA" },
  { key: "address", label: "Address" },
  { key: "nearestLandmark", label: "Nearest landmark" },
  { key: "postalCode", label: "Postal code" },
];

export default function OverviewTab({ data, reload, notify }: TabProps) {
  const h = data.hospital;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function startEdit() {
    setForm({ ...h });
    setEditing(true);
  }

  async function save() {
    setBusy("save");
    try {
      const payload: any = {};
      for (const k of [...FIELDS.map((f) => f.key), "hospitalType"]) {
        const v = typeof form[k] === "string" ? form[k].trim() : form[k];
        if (v !== h[k] && !(v === "" && !h[k])) payload[k] = v === "" ? null : v;
      }
      if (Object.keys(payload).length === 0) {
        setEditing(false);
        return;
      }
      await superAdminApi.patch(`/internal/hospitals/${h.id}`, payload);
      notify({ kind: "ok", text: "Hospital details updated." });
      setEditing(false);
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key);
    try {
      const msg = await fn();
      if (msg) notify({ kind: "ok", text: msg });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card
        title="Hospital details"
        className="lg:col-span-2"
        action={
          editing ? null : (
            <button className="text-xs text-amber-400 hover:text-amber-300" onClick={startEdit}>
              Edit
            </button>
          )
        }
      >
        {editing ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Type">
              <select className={darkInput} value={form.hospitalType} onChange={(e) => setForm({ ...form, hospitalType: e.target.value })}>
                {HOSPITAL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <input className={darkInput} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </Field>
            ))}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <button className={ghostButton} onClick={() => setEditing(false)}>Cancel</button>
              <button className={amberButton} disabled={busy === "save"} onClick={save}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <KV label="Contact person">{h.contactPerson}</KV>
            <KV label="Email">{h.email}</KV>
            <KV label="Phone">{h.phone}</KV>
            <KV label="Location">{[h.lga, h.state].filter(Boolean).join(", ")}</KV>
            <KV label="Address">{h.address}</KV>
            <KV label="Landmark / postal code">{[h.nearestLandmark, h.postalCode].filter(Boolean).join(" · ")}</KV>
            <KV label="Joined">{fmtDate(h.createdAt)}</KV>
            <KV label="Currency">{h.currency}</KV>
            {h.supportingDocumentUrl && (
              <KV label="Supporting document">
                <a className="text-amber-400" href={h.supportingDocumentUrl} target="_blank" rel="noreferrer">Open</a>
              </KV>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card title="Account state">
          <div className="space-y-3">
            <KV label="Trial ends">{fmtDate(h.trialEndsAt)}</KV>
            <KV label="Grace period ends">{fmtDate(h.gracePeriodEndsAt)}</KV>
            <KV label="Open support tickets">{String(data.support.openTickets)}</KV>
            <div>
              <div className="text-xs text-slate-500 mb-1">Onboarding wizard</div>
              <div className="flex items-center gap-2">
                {h.setupWizardCompleted ? <DarkBadge tone="green">Completed</DarkBadge> : <DarkBadge tone="amber">Not finished</DarkBadge>}
                <button
                  className="text-xs text-amber-400 hover:text-amber-300"
                  disabled={busy === "wizard"}
                  onClick={() =>
                    run("wizard", async () => {
                      const r = await superAdminApi.post(`/internal/hospitals/${h.id}/setup-wizard`, { completed: !h.setupWizardCompleted });
                      return r.message;
                    })
                  }
                >
                  {h.setupWizardCompleted ? "Reopen wizard" : "Mark complete (skip it)"}
                </button>
              </div>
              {!h.setupWizardCompleted && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Stuck on a wizard step? Add the department from the Departments tab, then mark it complete here.
                </p>
              )}
            </div>
          </div>
        </Card>

        {h.verificationPending && (
          <Card title="Email not verified">
            <p className="text-sm text-slate-300 mb-3">
              This hospital hasn't confirmed its email address{h.verificationExpires ? ` (link expires ${fmtDate(h.verificationExpires)})` : ""}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className={amberButton}
                disabled={!!busy}
                onClick={() =>
                  run("verify", async () => (await superAdminApi.post(`/internal/hospitals/${h.id}/verify-email`, {})).message)
                }
              >
                Verify email now
              </button>
              <button
                className={ghostButton}
                disabled={!!busy}
                onClick={() =>
                  run("resend", async () => {
                    const r = await superAdminApi.post(`/internal/hospitals/${h.id}/resend-verification`, {});
                    setLink(r.verifyUrl);
                    return r.emailed ? "Verification email re-sent." : `Email could not be sent (${r.error || "unknown"}) — use the link instead.`;
                  })
                }
              >
                Resend link
              </button>
            </div>
          </Card>
        )}
      </div>

      <Card title="Stored records" className="lg:col-span-3">
        <p className="text-xs text-slate-500 mb-3">Counts only — patient and clinical content is never visible from this console.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.records.map((r: any) => (
            <KV key={r.key} label={r.label}>
              <span className="font-mono">{r.count}</span>
            </KV>
          ))}
        </div>
      </Card>

      {data.failedMessages7d.length > 0 && (
        <Card title="Failed messages, last 7 days" className="lg:col-span-3">
          <ul className="divide-y divide-white/5 text-sm">
            {data.failedMessages7d.map((f: any, i: number) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span><span className="capitalize">{f.channel}</span> <span className="text-slate-500">· {f.reason || "no reason recorded"}</span></span>
                <span className="font-mono text-slate-400">{f.count}×</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SecretModal
        open={!!link}
        onClose={() => setLink(null)}
        title="Verification link"
        intro="Send this link to the hospital (e.g. on WhatsApp) if the email isn't arriving."
        secrets={link ? [{ label: "Verification link (valid 24 hours)", value: link, mono: false }] : []}
      />
    </div>
  );
}
