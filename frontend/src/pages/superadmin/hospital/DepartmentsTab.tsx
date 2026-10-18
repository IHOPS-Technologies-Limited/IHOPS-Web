import React, { useState } from "react";
import { superAdminApi } from "../../../api/client";
import { amberButton, ghostButton, darkInput, smallButton } from "../../../components/superadmin/styles";
import { Card, Empty, ConfirmDialog, Field, errText } from "../../../components/superadmin/ui";
import type { TabProps } from "../HospitalDetail";

export default function DepartmentsTab({ data, reload, notify }: TabProps) {
  const hid = data.hospital.id;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [del, setDel] = useState<any>(null);
  const [moveTo, setMoveTo] = useState("");

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await superAdminApi.post(`/internal/hospitals/${hid}/departments`, { name });
      setName("");
      notify({ kind: "ok", text: "Department added." });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string) {
    try {
      await superAdminApi.patch(`/internal/hospitals/${hid}/departments/${id}`, { name: editName });
      setEditId(null);
      notify({ kind: "ok", text: "Department renamed." });
      await reload();
    } catch (e: any) {
      notify({ kind: "error", text: errText(e) });
    }
  }

  const others = data.departments.filter((d: any) => d.id !== del?.id);
  const inUse = del && (del.staffCount > 0 || del.visitCount > 0);

  return (
    <Card title="Departments">
      {data.departments.length === 0 ? (
        <Empty>No departments yet — the hospital's setup wizard needs at least one.</Empty>
      ) : (
        <ul className="divide-y divide-white/5 mb-4">
          {data.departments.map((d: any) => (
            <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
              {editId === d.id ? (
                <div className="flex gap-2 flex-1 min-w-[220px]">
                  <input className={darkInput} value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename(d.id)} />
                  <button className={amberButton} onClick={() => rename(d.id)}>Save</button>
                  <button className={ghostButton} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-sm text-white font-medium">{d.name}</div>
                    <div className="text-xs text-slate-500">{d.staffCount} staff · {d.visitCount} visits</div>
                  </div>
                  <div className="flex gap-2">
                    <button className={smallButton} onClick={() => { setEditId(d.id); setEditName(d.name); }}>Rename</button>
                    <button className={smallButton} onClick={() => { setDel(d); setMoveTo(""); }}>Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 max-w-md">
        <input className={darkInput} placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className={amberButton} disabled={busy || !name.trim()} onClick={add}>Add</button>
      </div>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Delete “${del?.name || ""}”?`}
        confirmLabel="Delete department"
        danger
        onConfirm={async () => {
          if (inUse && !moveTo) throw new Error("Choose a department to move staff and visits into first.");
          await superAdminApi.del(`/internal/hospitals/${hid}/departments/${del.id}`, { moveToDepartmentId: moveTo || null });
          setDel(null);
          notify({ kind: "ok", text: "Department deleted." });
          await reload();
        }}
      >
        {inUse ? (
          <>
            <p>It's used by {del.staffCount} staff member(s) and {del.visitCount} visit(s). They'll be moved to:</p>
            <Field label="Move into">
              <select className={darkInput} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Choose a department…</option>
                {others.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </>
        ) : (
          <p>Nothing is using this department.</p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
