import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../../api/client";
import { Card, ConfirmDialog, errText } from "../../../components/superadmin/ui";
import { dangerButton } from "../../../components/superadmin/styles";
import type { TabProps } from "../HospitalDetail";
import { AlertTriangle } from "lucide-react";

export default function DangerTab({ data, notify, onDeleted }: TabProps & { onDeleted: () => void }) {
  const h = data.hospital;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForce(false);
    setPreview(null);
    superAdminApi
      .get(`/internal/hospitals/${h.id}/delete-preview`)
      .then(setPreview)
      .catch((e) => notify({ kind: "error", text: errText(e) }));
  }, [open]);

  const needsForce = !!preview && preview.warnings.length > 0;

  return (
    <Card title="Delete this hospital">
      <div className="flex gap-3 text-sm text-slate-300">
        <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
        <div className="space-y-3">
          <p>
            Permanently removes <strong className="text-white">{h.hospitalName}</strong> and <em>everything</em> under it — staff,
            patients, visits, clinical notes, finance records, messages, tickets and subscription history. The email{" "}
            <span className="font-mono">{h.email}</span> becomes free to sign up again.
          </p>
          <p className="text-slate-400">
            Just want to stop access? Use <strong>Suspend</strong> on the Subscription tab — it's reversible. Deleting is for test signups and genuine removal requests.
          </p>
          <button className={dangerButton} onClick={() => setOpen(true)}>Delete hospital…</button>
        </div>
      </div>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${h.hospitalName}?`}
        confirmLabel="Delete everything"
        danger
        typeToConfirm={h.hospitalName}
        onConfirm={async (typed) => {
          if (needsForce && !force) throw new Error("Tick the box to confirm you understand the warnings above.");
          const r = await superAdminApi.del(`/internal/hospitals/${h.id}`, { confirmName: typed, force });
          setOpen(false);
          notify({ kind: "ok", text: r.message });
          onDeleted();
        }}
      >
        {!preview ? (
          <p className="text-slate-500">Counting records…</p>
        ) : (
          <>
            <div>
              <div className="text-xs text-slate-500 mb-1">Will be deleted:</div>
              <ul className="text-xs grid grid-cols-2 gap-x-4 gap-y-0.5">
                {preview.records.filter((r: any) => r.count > 0).map((r: any) => (
                  <li key={r.key} className="flex justify-between"><span>{r.label}</span><span className="font-mono">{r.count}</span></li>
                ))}
                {preview.subscriptionPayments > 0 && (
                  <li className="flex justify-between"><span>Subscription payments</span><span className="font-mono">{preview.subscriptionPayments}</span></li>
                )}
              </ul>
            </div>
            {preview.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 px-3 py-2 space-y-2">
                {preview.warnings.map((w: string, i: number) => <p key={i}>• {w}</p>)}
                <label className="flex items-start gap-2 text-xs pt-1">
                  <input type="checkbox" className="mt-0.5 accent-amber-500" checked={force} onChange={(e) => setForce(e.target.checked)} />
                  <span>I understand and want to delete anyway.</span>
                </label>
              </div>
            )}
          </>
        )}
      </ConfirmDialog>
    </Card>
  );
}
