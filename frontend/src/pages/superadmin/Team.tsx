import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import { amberButton, ghostButton, darkInput, dangerGhostButton, smallButton } from "../../components/superadmin/styles";
import {
  PageHeader,
  Card,
  Field,
  DarkBadge,
  DarkModal,
  ConfirmDialog,
  NoticeBar,
  Notice,
  errText,
  fmtDate,
} from "../../components/superadmin/ui";
import { UserPlus } from "lucide-react";

export default function Team() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [resetFor, setResetFor] = useState<any>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<any>(null);

  const [mine, setMine] = useState({ current: "", next: "", confirm: "" });
  const [mineBusy, setMineBusy] = useState(false);

  function load() {
    superAdminApi
      .get("/internal/admins")
      .then((r) => setAdmins(r.admins))
      .catch((e) => setNotice({ kind: "error", text: errText(e) }));
  }
  useEffect(load, []);

  async function create() {
    setFormErr(null);
    setSaving(true);
    try {
      await superAdminApi.post("/internal/admins", form);
      setAdding(false);
      setForm({ name: "", email: "", password: "" });
      setNotice({ kind: "ok", text: "Super Admin added. Share the password with them securely." });
      load();
    } catch (e: any) {
      setFormErr(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function resetOther() {
    setResetErr(null);
    try {
      const r = await superAdminApi.post(`/internal/admins/${resetFor.id}/password`, { newPassword: resetPw });
      setResetFor(null);
      setResetPw("");
      setNotice({ kind: "ok", text: r.message });
    } catch (e: any) {
      setResetErr(errText(e));
    }
  }

  async function changeMine() {
    setNotice(null);
    if (mine.next !== mine.confirm) return setNotice({ kind: "error", text: "The two new passwords don't match" });
    setMineBusy(true);
    try {
      await superAdminApi.post("/internal/me/password", { currentPassword: mine.current, newPassword: mine.next });
      setMine({ current: "", next: "", confirm: "" });
      setNotice({ kind: "ok", text: "Your password was updated." });
    } catch (e: any) {
      setNotice({ kind: "error", text: errText(e) });
    } finally {
      setMineBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Team"
        sub="People who can sign in to this console"
        actions={
          <button className={`${amberButton} flex items-center gap-1.5`} onClick={() => setAdding(true)}>
            <UserPlus size={15} /> Add Super Admin
          </button>
        }
      />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Super Admins">
          <ul className="divide-y divide-white/5">
            {admins.map((a) => (
              <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-white font-medium">
                    {a.name} {a.isYou && <DarkBadge tone="amber">you</DarkBadge>}
                  </div>
                  <div className="text-xs text-slate-500">{a.email} · added {fmtDate(a.createdAt, false)}</div>
                </div>
                {!a.isYou && (
                  <div className="flex gap-2">
                    <button className={smallButton} onClick={() => setResetFor(a)}>Set password</button>
                    <button className={`${dangerGhostButton} !px-2.5 !py-1.5 !text-xs`} onClick={() => setDeleteFor(a)}>Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Change my password">
          <div className="space-y-3">
            <Field label="Current password">
              <input type="password" className={darkInput} value={mine.current} autoComplete="current-password" onChange={(e) => setMine({ ...mine, current: e.target.value })} />
            </Field>
            <Field label="New password" hint="At least 10 characters">
              <input type="password" className={darkInput} value={mine.next} autoComplete="new-password" onChange={(e) => setMine({ ...mine, next: e.target.value })} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" className={darkInput} value={mine.confirm} autoComplete="new-password" onChange={(e) => setMine({ ...mine, confirm: e.target.value })} />
            </Field>
            <button className={amberButton} disabled={mineBusy || !mine.current || !mine.next} onClick={changeMine}>
              {mineBusy ? "Updating…" : "Update password"}
            </button>
          </div>
        </Card>
      </div>

      <DarkModal open={adding} onClose={() => setAdding(false)} title="Add a Super Admin">
        <div className="space-y-3">
          {formErr && <div className="text-sm rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2">{formErr}</div>}
          <Field label="Full name"><input className={darkInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={darkInput} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Temporary password" hint="At least 10 characters. They can change it after signing in.">
            <input type="password" className={darkInput} value={form.password} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button className={ghostButton} onClick={() => setAdding(false)}>Cancel</button>
            <button className={amberButton} disabled={saving} onClick={create}>{saving ? "Adding…" : "Add"}</button>
          </div>
        </div>
      </DarkModal>

      <DarkModal open={!!resetFor} onClose={() => setResetFor(null)} title={`Set password for ${resetFor?.name || ""}`}>
        <div className="space-y-3">
          {resetErr && <div className="text-sm rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2">{resetErr}</div>}
          <Field label="New password" hint="At least 10 characters. Tell them to change it after signing in.">
            <input type="password" className={darkInput} value={resetPw} autoComplete="new-password" onChange={(e) => setResetPw(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className={ghostButton} onClick={() => setResetFor(null)}>Cancel</button>
            <button className={amberButton} disabled={resetPw.length < 10} onClick={resetOther}>Set password</button>
          </div>
        </div>
      </DarkModal>

      <ConfirmDialog
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title={`Remove ${deleteFor?.name || ""}?`}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          await superAdminApi.del(`/internal/admins/${deleteFor.id}`);
          setDeleteFor(null);
          setNotice({ kind: "ok", text: "Super Admin removed." });
          load();
        }}
      >
        <p>They will no longer be able to sign in to the IHOPS Internal console.</p>
      </ConfirmDialog>
    </div>
  );
}
