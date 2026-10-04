import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Badge, EmptyState, Modal, ErrorBanner } from "../../components/ui";
import {
  MessageSquarePlus,
  MessageCircle,
  Mail as MailIcon,
  Smartphone,
} from "lucide-react";

const CHANNEL_ICON: Record<string, any> = {
  sms: Smartphone,
  whatsapp: MessageCircle,
  email: MailIcon,
};

export default function CommunicationPage() {
  const { staff } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // communications.send_manual is administrator + receptionist only on the
  // backend (doctor can read the log, not send) — gate the compose button to
  // match, so it never renders for a role that would just get a 403 back.
  const canSend =
    staff && ["administrator", "receptionist"].includes(staff.role);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/communications");
      setLogs(res.logs);
    } catch (e: any) {
      // Defensive: previously an unhandled rejection here (e.g. a role
      // without communications.read hitting a 403) would fail silently.
      // Surface it instead of leaving the page blank.
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Communication
          </h1>
          <p className="text-sm text-slate-500">
            Every WhatsApp, SMS, and Email sent to patients — automated and
            manual.
          </p>
        </div>
        {canSend && (
          <button
            onClick={() => setShowCompose(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
          >
            <MessageSquarePlus size={16} /> Send Message
          </button>
        )}
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">
          Loading messages…
        </div>
      ) : logs.length === 0 ? (
        <EmptyState title="No messages sent yet" />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => {
            const Icon = CHANNEL_ICON[l.channel] || MessageCircle;
            return (
              <div
                key={l.id}
                className="bg-white rounded-xl border border-slate-100 p-4"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Icon size={14} />
                    </span>
                    <div className="font-medium text-slate-700">
                      {l.patient?.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="gray">{l.channel}</Badge>
                    <Badge
                      tone={
                        l.status === "failed"
                          ? "alert"
                          : l.status === "sent" || l.status === "delivered"
                            ? "teal"
                            : "amber"
                      }
                    >
                      {l.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-slate-600 pl-9">{l.messageBody}</p>
                <div className="text-xs text-slate-400 mt-1 pl-9 capitalize">
                  {l.trigger.replace("_", " ")} ·{" "}
                  {new Date(l.createdAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [channel, setChannel] = useState("sms");
  const [messageBody, setMessageBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q || patient) return setResults([]);
    const t = setTimeout(
      () =>
        api
          .get(`/patients?q=${encodeURIComponent(q)}`)
          .then((r) => setResults(r.patients)),
      250,
    );
    return () => clearTimeout(t);
  }, [q, patient]);

  async function send() {
    if (!patient) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/communications/send", {
        patientId: patient.id,
        channel,
        messageBody,
      });
      onSent();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Send a message">
      <ErrorBanner message={error} />
      {!patient ? (
        <div>
          <input
            className="input mb-2"
            placeholder="Search patient by name or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm flex justify-between"
                onClick={() => setPatient(p)}
              >
                <span>{p.name}</span>
                <span className="text-slate-400 font-mono text-xs">
                  {p.platformPatientId}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium">{patient.name}</span>
            <button
              className="text-xs text-blue-600"
              onClick={() => setPatient(null)}
            >
              Change
            </button>
          </div>
          <div>
            <label className="label">Channel</label>
            <select
              className="input"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              className="input"
              rows={4}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
            />
          </div>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full disabled:opacity-50"
            disabled={loading || !messageBody}
            onClick={send}
          >
            {loading ? "Sending…" : "Send message"}
          </button>
        </div>
      )}
    </Modal>
  );
}
