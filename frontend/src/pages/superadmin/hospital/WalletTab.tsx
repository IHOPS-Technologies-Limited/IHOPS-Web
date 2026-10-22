import React, { useState } from "react";
import { superAdminApi } from "../../../api/client";
import { amberButton, darkInput } from "../../../components/superadmin/styles";
import {
  Card,
  Field,
  Empty,
  DarkBadge,
  errText,
  fmtDate,
} from "../../../components/superadmin/ui";
import type { TabProps } from "../HospitalDetail";

export default function WalletTab({ data, reload, notify }: TabProps) {
  const hid = data.hospital.id;
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [units, setUnits] = useState("");
  const [note, setNote] = useState("");
  const w = data.smsWallet;
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = parseInt(units, 10);
    if (!Number.isInteger(n) || n <= 0)
      return notify({
        kind: "error",
        text: "Enter a whole number of units greater than zero.",
      });
    setBusy(true);
    try {
      const r = await superAdminApi.post(
        `/internal/hospitals/${hid}/sms-wallet/adjust`,
        {
          units: mode === "credit" ? n : -n,
          note,
        },
      );
      setUnits("");
      setNote("");
      notify({
        kind: "ok",
        text: `${r.message}. New balance: ${r.balanceUnits} units.`,
      });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Balance">
        <div className="text-4xl font-mono font-semibold text-white">
          {w.balanceUnits}
        </div>
        <div className="text-xs text-slate-500 mb-5">
          SMS units (1 unit per SMS page — 160 characters, or 70 if the text has
          ₦ or curly quotes)
        </div>

        <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-3 text-sm">
          {(["credit", "debit"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-md capitalize ${mode === m ? "bg-amber-500 text-slate-950 font-semibold" : "text-slate-300"}`}
            >
              {m === "credit" ? "Add units" : "Remove units"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <Field label="Units">
            <input
              className={darkInput}
              inputMode="numeric"
              value={units}
              onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field
            label="Reason (recorded in history)"
            hint="e.g. Goodwill credit, bank transfer of ₦5,000, correcting duplicate"
          >
            <input
              className={darkInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button
            className={amberButton}
            disabled={busy || !units || note.trim().length < 3}
            onClick={submit}
          >
            {busy
              ? "Saving…"
              : mode === "credit"
                ? "Credit wallet"
                : "Deduct units"}
          </button>
          <p className="text-[11px] text-slate-500">
            Credited units still use real Termii balance when the hospital sends
            SMS.
          </p>
        </div>
      </Card>

      <Card title="Recent transactions" className="lg:col-span-2">
        {w.transactions.length === 0 ? (
          <Empty>No wallet activity yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium text-right">Units</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {w.transactions.map((t: any) => (
                  <tr
                    key={t.id}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">
                      {fmtDate(t.createdAt)}
                    </td>
                    <td className="py-2 pr-3 capitalize">{t.type}</td>
                    <td
                      className={`py-2 pr-3 text-right font-mono ${t.units > 0 ? "text-emerald-400" : "text-slate-300"}`}
                    >
                      {t.units > 0 ? "+" : ""}
                      {t.units}
                    </td>
                    <td className="py-2 pr-3">
                      <DarkBadge
                        tone={
                          t.status === "success"
                            ? "green"
                            : t.status === "failed"
                              ? "red"
                              : "amber"
                        }
                      >
                        {t.status}
                      </DarkBadge>
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {t.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
