import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, ErrorBanner, EmptyState } from "../../components/ui";
import { LifeBuoy, Send } from "lucide-react";

export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await api.get("/support-tickets");
    setTickets(res.tickets);
  }
  useEffect(() => {
    load();
    // Poll for new replies from the IHOPS team so this updates without a
    // manual refresh. Safe to do while typing a reply — each ticket's draft
    // lives in TicketCard's own local state, keyed by ticket id, so a poll
    // re-render doesn't touch it.
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await api.post("/support-tickets", { subject, body });
      setSubject("");
      setBody("");
      load();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-slate-800">
          Support
        </h1>
        <p className="text-sm text-slate-500">
          Raise a ticket with the IHOPS team, and reply on any open
          conversation.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-8">
        <ErrorBanner message={error} />
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="input"
            rows={4}
            placeholder="Describe your issue…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 disabled:opacity-50"
            disabled={loading || !subject || !body}
            onClick={submit}
          >
            <LifeBuoy size={15} /> {loading ? "Sending…" : "Raise ticket"}
          </button>
        </div>
      </div>

      <h2 className="font-display font-bold text-slate-800 mb-3">
        Your hospital's tickets
      </h2>
      {tickets.length === 0 ? (
        <EmptyState title="No support tickets yet" />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} onReplied={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  onReplied,
}: {
  ticket: any;
  onReplied: () => void;
}) {
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendReply() {
    if (!reply.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/support-tickets/${ticket.id}/reply`, { body: reply });
      setReply("");
      onReplied();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  const sortedReplies = [...(ticket.replies || [])].sort(
    (a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex justify-between items-start mb-1">
        <span className="font-medium text-slate-800">{ticket.subject}</span>
        <Badge
          tone={
            ticket.status === "resolved"
              ? "teal"
              : ticket.status === "in_progress"
                ? "amber"
                : "gray"
          }
        >
          {ticket.status.replace("_", " ")}
        </Badge>
      </div>
      <p className="text-sm text-slate-600 mb-2">{ticket.body}</p>

      {sortedReplies.length > 0 && (
        <div className="space-y-2 mb-2">
          {sortedReplies.map((r: any) => (
            <div
              key={r.id}
              className={`rounded-lg p-2.5 text-sm ${r.authorType === "super_admin" ? "bg-blue-50" : "bg-slate-50"}`}
            >
              <span className="font-medium text-slate-700">
                {r.authorType === "super_admin"
                  ? `${r.authorName} (IHOPS)`
                  : r.authorName}
                :
              </span>{" "}
              <span className="text-slate-600">{r.body}</span>
            </div>
          ))}
        </div>
      )}

      <ErrorBanner message={error} />
      <div className="flex gap-2 mt-2">
        <input
          className="input flex-1 !py-2 text-sm"
          placeholder="Write a reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendReply()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg px-3 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          disabled={loading || !reply.trim()}
          onClick={sendReply}
        >
          <Send size={13} /> Reply
        </button>
      </div>
    </div>
  );
}
