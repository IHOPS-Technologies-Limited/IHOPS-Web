import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import { Badge, EmptyState } from "../../components/ui";
import { darkInput } from "../../components/superadmin/styles";
import { LifeBuoy, Send, CheckCircle2 } from "lucide-react";

export default function SupportRequests() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  async function load() {
    const res = await superAdminApi.get("/internal/support-tickets");
    setTickets(res.tickets);
  }
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function reply(id: string) {
    const replyBody = replyDrafts[id];
    if (!replyBody) return;
    await superAdminApi.patch(`/internal/support-tickets/${id}`, {
      replyBody,
      status: "in_progress",
    });
    setReplyDrafts((d) => ({ ...d, [id]: "" }));
    load();
  }
  async function resolve(id: string) {
    await superAdminApi.patch(`/internal/support-tickets/${id}`, {
      status: "resolved",
    });
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-white">
          Support Requests
        </h1>
        <p className="text-sm text-slate-400">
          Every ticket raised by every hospital, in one place
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No support tickets
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const sortedReplies = [...(t.replies || [])].sort(
              (a: any, b: any) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
            return (
              <div
                key={t.id}
                className="bg-[#111827] border border-white/10 rounded-xl p-4"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <LifeBuoy size={15} />
                    </span>
                    <div>
                      <div className="font-medium text-white">{t.subject}</div>
                      <div className="text-xs text-slate-500">
                        {t.tenant.hospitalName} · {t.raisedBy.name}
                      </div>
                    </div>
                  </div>
                  <Badge
                    tone={
                      t.status === "resolved"
                        ? "teal"
                        : t.status === "in_progress"
                          ? "amber"
                          : "gray"
                    }
                  >
                    {t.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300 mb-2 pl-11">{t.body}</p>

                {sortedReplies.length > 0 && (
                  <div className="space-y-1.5 mb-2 pl-11">
                    {sortedReplies.map((r: any) => (
                      <div
                        key={r.id}
                        className={`rounded-lg p-2.5 text-sm ${r.authorType === "super_admin" ? "bg-amber-500/10 text-amber-100" : "bg-white/5 text-slate-300"}`}
                      >
                        <span className="font-medium">
                          {r.authorType === "super_admin"
                            ? `${r.authorName} (You)`
                            : r.authorName}
                          :
                        </span>{" "}
                        {r.body}
                      </div>
                    ))}
                  </div>
                )}

                {t.status !== "resolved" && (
                  <div className="flex gap-2 mt-2 pl-11">
                    <input
                      className={darkInput}
                      placeholder="Write a reply…"
                      value={replyDrafts[t.id] || ""}
                      onChange={(e) =>
                        setReplyDrafts((d) => ({
                          ...d,
                          [t.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && reply(t.id)}
                    />
                    <button
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-lg px-3 flex items-center gap-1.5 shrink-0 transition"
                      onClick={() => reply(t.id)}
                    >
                      <Send size={12} /> Reply
                    </button>
                    <button
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium rounded-lg px-3 flex items-center gap-1.5 shrink-0 transition"
                      onClick={() => resolve(t.id)}
                    >
                      <CheckCircle2 size={12} /> Resolve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
