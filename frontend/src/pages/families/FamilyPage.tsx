import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, EmptyState, Modal, ErrorBanner } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { Home, Plus, Star, X, UserPlus, Trash2 } from "lucide-react";

export default function FamiliesPage() {
  const { staff } = useAuth();
  const canWrite =
    staff && ["administrator", "receptionist"].includes(staff.role);
  const [q, setQ] = useState("");
  const [families, setFamilies] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);

  async function load() {
    const res = await api.get(`/families?q=${encodeURIComponent(q)}`);
    setFamilies(res.families);
  }
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Families
          </h1>
          <p className="text-sm text-slate-500">
            Group related patients — households, dependents, and their primary
            contact
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
          >
            <Plus size={16} /> Create family
          </button>
        )}
      </div>

      <input
        className="input mb-4 max-w-md"
        placeholder="Search by family ID or member name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {families.length === 0 ? (
        <EmptyState
          title="No families yet"
          sub="Group patients who share a household — for example, a parent and their children."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {families.map((f) => (
            <button
              key={f.id}
              onClick={() => setOpenFamilyId(f.id)}
              className="text-left bg-white rounded-xl border border-slate-100 p-4 hover:border-blue-200 hover:shadow-sm transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Home size={16} />
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {f.familyIdDisplay}
                  </span>
                </div>
                <Badge tone="gray">
                  {f.memberCount} member{f.memberCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.members.slice(0, 4).map((m: any) => (
                  <span
                    key={m.id}
                    className="text-xs bg-slate-50 text-slate-600 rounded-full px-2.5 py-1"
                  >
                    {m.name}
                    {f.primaryContactPatientId === m.id ? " ★" : ""}
                  </span>
                ))}
                {f.members.length > 4 && (
                  <span className="text-xs text-slate-400 px-2 py-1">
                    +{f.members.length - 4} more
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateFamilyModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            load();
            setOpenFamilyId(id);
          }}
        />
      )}
      {openFamilyId && (
        <FamilyDetailModal
          familyId={openFamilyId}
          canWrite={!!canWrite}
          onClose={() => setOpenFamilyId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function PatientSearch({
  onPick,
  excludeIds = [],
}: {
  onPick: (p: any) => void;
  excludeIds?: string[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!q) return setResults([]);
    const t = setTimeout(
      () =>
        api
          .get(`/patients?q=${encodeURIComponent(q)}`)
          .then((r) => setResults(r.patients)),
      250,
    );
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        className="input mb-2"
        placeholder="Search patient by name or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {results.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-1">
          {results
            .filter((p) => !excludeIds.includes(p.id))
            .map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-sm flex justify-between"
                onClick={() => {
                  onPick(p);
                  setQ("");
                  setResults([]);
                }}
              >
                <span>{p.name}</span>
                <span className="text-slate-400 font-mono text-xs">
                  {p.platformPatientId}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function CreateFamilyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (members.length === 0) return setError("Add at least one patient first");
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/families", {
        patientIds: members.map((m) => m.id),
      });
      onCreated(res.family.id);
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Create a family">
      <ErrorBanner message={error} />
      <div className="space-y-3">
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.id}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-full pl-2.5 pr-1 py-1"
              >
                {m.name}
                <button
                  onClick={() =>
                    setMembers((ms) => ms.filter((x) => x.id !== m.id))
                  }
                  className="hover:text-blue-900"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <PatientSearch
          onPick={(p) => setMembers((ms) => [...ms, p])}
          excludeIds={members.map((m) => m.id)}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full disabled:opacity-50"
          disabled={loading || members.length === 0}
          onClick={create}
        >
          {loading
            ? "Creating…"
            : `Create family with ${members.length} member${members.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}

function FamilyDetailModal({
  familyId,
  canWrite,
  onClose,
  onChanged,
}: {
  familyId: string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [family, setFamily] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get(`/families/${familyId}`);
    setFamily(res.family);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  async function addMember(patient: any) {
    setError(null);
    try {
      await api.post(`/families/${familyId}/members`, {
        patientId: patient.id,
      });
      load();
      onChanged();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    }
  }

  async function removeMember(patientId: string) {
    if (!confirm("Remove this patient from the family?")) return;
    await api.del(`/families/${familyId}/members/${patientId}`);
    load();
    onChanged();
  }

  async function setPrimary(patientId: string) {
    await api.patch(`/families/${familyId}`, {
      primaryContactPatientId: patientId,
    });
    load();
    onChanged();
  }

  async function deleteFamily() {
    if (
      !confirm(
        "Delete this family? Members will stay as patients, just no longer grouped together.",
      )
    )
      return;
    await api.del(`/families/${familyId}`);
    onChanged();
    onClose();
  }

  if (!family)
    return (
      <Modal open onClose={onClose} title="Family">
        <div className="text-slate-400 text-sm">Loading…</div>
      </Modal>
    );

  return (
    <Modal open onClose={onClose} title={family.familyIdDisplay}>
      <ErrorBanner message={error} />
      <div className="space-y-2 mb-4">
        {family.members.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          family.members.map((m: any) => (
            <div
              key={m.id}
              className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium text-slate-700 flex items-center gap-1.5">
                  {m.name}
                  {family.primaryContactPatientId === m.id && (
                    <Star size={12} className="text-amber-500 fill-amber-500" />
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {m.platformPatientId} · {m.phone || "no phone on file"}
                </div>
              </div>
              {canWrite && (
                <div className="flex items-center gap-2">
                  {family.primaryContactPatientId !== m.id && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setPrimary(m.id)}
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                    onClick={() => removeMember(m.id)}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {canWrite && (
        <>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
            <UserPlus size={12} /> Add a member
          </label>
          <PatientSearch
            onPick={addMember}
            excludeIds={family.members.map((m: any) => m.id)}
          />
          <button
            onClick={deleteFamily}
            className="text-xs text-red-500 hover:underline mt-4"
          >
            Delete this family
          </button>
        </>
      )}
    </Modal>
  );
}
