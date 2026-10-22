import React, { useState } from "react";
import { superAdminApi } from "../../../api/client";
import {
  amberButton,
  ghostButton,
  darkInput,
  smallButton,
  dangerGhostButton,
} from "../../../components/superadmin/styles";
import {
  Card,
  Empty,
  Field,
  DarkBadge,
  DarkModal,
  ConfirmDialog,
  SecretModal,
  errText,
  titleCase,
} from "../../../components/superadmin/ui";
import type { TabProps } from "../HospitalDetail";
import { UserPlus } from "lucide-react";

const ROLES = [
  "administrator",
  "doctor",
  "receptionist",
  "finance_officer",
  "nurse",
];

type Secret = {
  title: string;
  intro?: React.ReactNode;
  secrets: { label: string; value: string; mono?: boolean }[];
} | null;

export default function StaffTab({ data, reload, notify }: TabProps) {
  const hid = data.hospital.id;
  const base = `/internal/hospitals/${hid}/staff`;
  const [secret, setSecret] = useState<Secret>(null);
  const [form, setForm] = useState<any>(null); // create / edit
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwFor, setPwFor] = useState<any>(null);
  const [pwMode, setPwMode] = useState<"link" | "temporary">("link");
  const [pwBusy, setPwBusy] = useState(false);
  const [pinFor, setPinFor] = useState<any>(null);
  const [delFor, setDelFor] = useState<any>(null);
  const [force, setForce] = useState(false);

  async function saveForm() {
    setFormErr(null);
    setSaving(true);
    try {
      const body = {
        name: form.name,
        role: form.role,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        departmentId: form.departmentId || null,
      };
      if (form.id) {
        await superAdminApi.patch(`${base}/${form.id}`, body);
        notify({ kind: "ok", text: "Staff account updated." });
      } else {
        const r = await superAdminApi.post(base, body);
        const secrets = [
          {
            label: `Staff ID (${r.staff.name})`,
            value: r.staff.staffIdDisplay,
            mono: true,
          },
          { label: "Temporary PIN", value: r.temporaryPin },
        ];
        if (r.temporaryPassword)
          secrets.push({
            label: "Temporary password",
            value: r.temporaryPassword,
          });
        setSecret({
          title: "Account created",
          intro:
            "Give these sign-in details to the staff member. They must change the PIN on first login.",
          secrets,
        });
      }
      setForm(null);
      await reload();
    } catch (e: any) {
      setFormErr(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function quick(s: any, patch: any, ok: string) {
    try {
      await superAdminApi.patch(`${base}/${s.id}`, patch);
      notify({ kind: "ok", text: ok });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    }
  }

  async function unlock(s: any) {
    try {
      const r = await superAdminApi.post(`${base}/${s.id}/unlock`, {});
      notify({ kind: "ok", text: `${r.message}: ${s.name}.` });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    }
  }

  async function doResetPin() {
    const s = pinFor;
    const r = await superAdminApi.post(`${base}/${s.id}/reset-pin`, {
      sendSmsToStaff: !!s.phone,
    });
    setPinFor(null);
    setSecret({
      title: `New PIN for ${s.name}`,
      intro: r.smsSent
        ? "The PIN was also sent to their phone by SMS."
        : "Give this PIN to them directly. They must change it on first login.",
      secrets: [{ label: "Temporary PIN", value: r.temporaryPin }],
    });
    await reload();
  }

  async function doResetPassword() {
    const s = pwFor;
    setPwBusy(true);
    try {
      const r = await superAdminApi.post(`${base}/${s.id}/reset-password`, {
        mode: pwMode,
        sendEmailToStaff: true,
      });
      setPwFor(null);
      if (pwMode === "link") {
        setSecret({
          title: `Reset link for ${s.name}`,
          intro: r.emailed
            ? `A reset email was sent to ${s.email}. You can also send them this link directly (works once, expires in 1 hour).`
            : "The email could not be sent — send them this link directly (works once, expires in 1 hour).",
          secrets: [
            { label: "Password reset link", value: r.resetUrl, mono: false },
          ],
        });
      } else {
        setSecret({
          title: `Temporary password for ${s.name}`,
          intro:
            "They can sign in with this now, then change it under Settings → Change password.",
          secrets: [
            { label: "Temporary password", value: r.temporaryPassword },
          ],
        });
      }
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
      setPwFor(null);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <Card
      title="Staff accounts"
      action={
        <button
          className={`${amberButton} !py-1.5 !text-xs flex items-center gap-1`}
          onClick={() => {
            setFormErr(null);
            setForm({ role: "receptionist" });
          }}
        >
          <UserPlus size={13} /> Add staff
        </button>
      }
    >
      {data.staff.length === 0 ? (
        <Empty>No staff accounts.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Staff</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s: any) => (
                <tr
                  key={s.id}
                  className="border-b border-white/5 last:border-0 align-top"
                >
                  <td className="py-3 pr-3">
                    <div className="text-white font-medium">
                      {s.name}{" "}
                      <span className="text-xs text-slate-500 font-mono">
                        {s.staffIdDisplay}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.email || "no email"}
                      {s.phone ? ` · ${s.phone}` : ""}
                      {s.department ? ` · ${s.department}` : ""}
                    </div>
                  </td>
                  <td className="py-3 pr-3 capitalize">{titleCase(s.role)}</td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-1">
                      <DarkBadge
                        tone={s.status === "active" ? "green" : "slate"}
                      >
                        {s.status}
                      </DarkBadge>
                      {s.locked && <DarkBadge tone="red">locked</DarkBadge>}
                      {s.mustChangePin && (
                        <DarkBadge tone="amber">temp PIN</DarkBadge>
                      )}
                      {s.resetPending && (
                        <DarkBadge tone="blue">reset link sent</DarkBadge>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {s.locked && (
                        <button
                          className={smallButton}
                          onClick={() => unlock(s)}
                        >
                          Unlock
                        </button>
                      )}
                      <button
                        className={smallButton}
                        onClick={() => setPinFor(s)}
                      >
                        Reset PIN
                      </button>
                      {s.email && (
                        <button
                          className={smallButton}
                          onClick={() => {
                            setPwMode("link");
                            setPwFor(s);
                          }}
                        >
                          Reset password
                        </button>
                      )}
                      <button
                        className={smallButton}
                        onClick={() => {
                          setFormErr(null);
                          setForm({ ...s });
                        }}
                      >
                        Edit
                      </button>
                      {s.status === "active" ? (
                        <button
                          className={smallButton}
                          onClick={() =>
                            quick(
                              s,
                              { status: "inactive" },
                              `${s.name} deactivated — they can no longer sign in.`,
                            )
                          }
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className={smallButton}
                          onClick={() =>
                            quick(
                              s,
                              { status: "active" },
                              `${s.name} reactivated.`,
                            )
                          }
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        className={`${dangerGhostButton} !px-2.5 !py-1.5 !text-xs`}
                        onClick={() => {
                          setForce(false);
                          setDelFor(s);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* create / edit */}
      <DarkModal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Edit ${form.name}` : "Add staff"}
      >
        {form && (
          <div className="space-y-3">
            {formErr && (
              <div className="text-sm rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2">
                {formErr}
              </div>
            )}
            <Field label="Full name">
              <input
                className={darkInput}
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                className={darkInput}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Email"
              hint={
                form.role === "administrator"
                  ? "Required — administrators sign in with email + password"
                  : "Optional"
              }
            >
              <input
                type="email"
                className={darkInput}
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className={darkInput}
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Department">
              <select
                className={darkInput}
                value={form.departmentId || ""}
                onChange={(e) =>
                  setForm({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">None</option>
                {data.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button className={ghostButton} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                className={amberButton}
                disabled={saving || !form.name}
                onClick={saveForm}
              >
                {saving ? "Saving…" : form.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
        )}
      </DarkModal>

      {/* reset password */}
      <DarkModal
        open={!!pwFor}
        onClose={() => setPwFor(null)}
        title={`Reset password — ${pwFor?.name || ""}`}
      >
        <div className="space-y-3 text-sm text-slate-300">
          {(["link", "temporary"] as const).map((m) => (
            <label
              key={m}
              className={`flex gap-3 rounded-lg border p-3 cursor-pointer ${pwMode === m ? "border-amber-500/50 bg-amber-500/5" : "border-white/10"}`}
            >
              <input
                type="radio"
                checked={pwMode === m}
                onChange={() => setPwMode(m)}
                className="mt-1 accent-amber-500"
              />
              <span>
                <span className="block font-medium text-white">
                  {m === "link"
                    ? "Email a reset link (recommended)"
                    : "Set a temporary password now"}
                </span>
                <span className="text-xs text-slate-400">
                  {m === "link"
                    ? "They choose their own password. The link is also shown to you in case email is slow."
                    : "A password is generated and shown to you once to hand over."}
                </span>
              </span>
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <button className={ghostButton} onClick={() => setPwFor(null)}>
              Cancel
            </button>
            <button
              className={amberButton}
              disabled={pwBusy}
              onClick={doResetPassword}
            >
              {pwBusy ? "Working…" : "Continue"}
            </button>
          </div>
        </div>
      </DarkModal>

      <ConfirmDialog
        open={!!pinFor}
        onClose={() => setPinFor(null)}
        title={`Reset PIN for ${pinFor?.name || ""}?`}
        confirmLabel="Reset PIN"
        onConfirm={doResetPin}
      >
        <p>
          A new temporary PIN is generated, any lockout is cleared, and they
          must change the PIN at next sign-in.
          {pinFor?.phone
            ? " It will also be sent to their phone by SMS — this costs IHOPS real Termii credit and is not billed to the hospital."
            : ""}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!delFor}
        onClose={() => setDelFor(null)}
        title={`Permanently delete ${delFor?.name || ""}?`}
        confirmLabel="Delete permanently"
        danger
        typeToConfirm={delFor?.staffIdDisplay}
        onConfirm={async (typed) => {
          await superAdminApi.del(`${base}/${delFor.id}`, {
            confirm: typed,
            force,
          });
          setDelFor(null);
          notify({ kind: "ok", text: "Staff account permanently deleted." });
          await reload();
        }}
      >
        <p>
          If you only want to stop them signing in, use{" "}
          <strong>Deactivate</strong> instead — it keeps their history.
        </p>
        <label className="flex items-start gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="mt-0.5 accent-amber-500"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          <span>
            Also detach history if they have any (visits keep existing but lose
            the doctor, attendance records are removed, audit entries are
            anonymised).
          </span>
        </label>
      </ConfirmDialog>

      <SecretModal
        open={!!secret}
        onClose={() => setSecret(null)}
        title={secret?.title || ""}
        intro={secret?.intro}
        secrets={secret?.secrets || []}
      />
    </Card>
  );
}
