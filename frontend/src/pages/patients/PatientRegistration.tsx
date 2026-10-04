import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";

export default function PatientRegistration() {
  const nav = useNavigate();
  const { tenant } = useAuth();
  const isVet = /veterinary/i.test(tenant?.hospitalType || "");
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "Female",
    dob: "",
    address: "",
    emergencyContact: "",
    guardianName: "",
    guardianPhone: "",
    preferredChannel: "sms",
    hospitalCardNumber: "",
    administrativeNotes: "",
    species: "",
    bloodGroup: "",
  });

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(override = false) {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        bloodGroup: form.bloodGroup || undefined,
        overrideDuplicateWarning: override,
      };
      const res = await api.post("/patients", payload);
      nav(`/app/patients/${res.patient.id}`);
    } catch (e: any) {
      if (e.status === 409 && e.data?.error === "POSSIBLE_DUPLICATE") {
        setDuplicates(e.data.candidates);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold text-teal-900 mb-6">
        Register {isVet ? "an animal patient" : "a patient"}
      </h1>
      <ErrorBanner message={error} />

      {duplicates && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm">
          <p className="font-medium text-amber-800 mb-2">
            A similar patient may already exist:
          </p>
          <ul className="list-disc ml-5 text-amber-900/80">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.name} — {d.phone} ({d.platformPatientId})
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <button
              className="btn-secondary text-sm"
              onClick={() => setDuplicates(null)}
            >
              Go back and check
            </button>
            <button
              className="btn-primary text-sm"
              onClick={() => submit(true)}
            >
              Register as new patient anyway
            </button>
          </div>
        </div>
      )}

      <div className="card p-6 space-y-3">
        <div>
          <label className="label">{isVet ? "Pet name" : "Full name"}</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>
        {isVet && (
          <div>
            <label className="label">Species</label>
            <input
              className="input"
              value={form.species}
              onChange={(e) => update("species", e.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Gender</label>
            <select
              className="input"
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input
              type="date"
              className="input"
              value={form.dob}
              onChange={(e) => update("dob", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Emergency contact</label>
          <input
            className="input"
            value={form.emergencyContact}
            onChange={(e) => update("emergencyContact", e.target.value)}
          />
        </div>
        {isVet && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Guardian name</label>
              <input
                className="input"
                value={form.guardianName}
                onChange={(e) => update("guardianName", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Guardian phone</label>
              <input
                className="input"
                value={form.guardianPhone}
                onChange={(e) => update("guardianPhone", e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <label className="label">Hospital card number (optional)</label>
          <input
            className="input"
            value={form.hospitalCardNumber}
            onChange={(e) => update("hospitalCardNumber", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Blood group (optional)</label>
          <select
            className="input"
            value={form.bloodGroup}
            onChange={(e) => update("bloodGroup", e.target.value)}
          >
            <option value="">— Not recorded —</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map(
              (bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="label">Preferred reminder channel</label>
          <select
            className="input"
            value={form.preferredChannel}
            onChange={(e) => update("preferredChannel", e.target.value)}
          >
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div>
          <label className="label">Administrative notes (optional)</label>
          <textarea
            className="input"
            rows={2}
            value={form.administrativeNotes}
            onChange={(e) => update("administrativeNotes", e.target.value)}
          />
        </div>

        <button
          className="btn-primary w-full mt-2"
          disabled={loading}
          onClick={() => submit(false)}
        >
          {loading ? "Saving…" : "Register patient"}
        </button>
      </div>
    </div>
  );
}
