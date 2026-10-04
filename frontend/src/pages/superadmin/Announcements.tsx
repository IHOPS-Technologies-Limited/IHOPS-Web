import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import { ErrorBanner, EmptyState } from "../../components/ui";
import { darkInput, amberButton } from "../../components/superadmin/styles";
import { Megaphone, Send } from "lucide-react";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetSegment, setTargetSegment] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await superAdminApi.get("/internal/announcements");
    setAnnouncements(res.announcements);
  }
  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await superAdminApi.post("/internal/announcements", {
        title,
        body,
        targetSegment,
        publishAt: new Date().toISOString(),
      });
      setTitle("");
      setBody("");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-white">
          System Announcements
        </h1>
        <p className="text-sm text-slate-400">
          Broadcast a message to hospitals on the platform
        </p>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-xl p-5 mb-8">
        <ErrorBanner message={error} />
        <div className="space-y-3">
          <input
            className={darkInput}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={darkInput}
            rows={3}
            placeholder="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <select
            className={darkInput}
            value={targetSegment}
            onChange={(e) => setTargetSegment(e.target.value)}
          >
            <option value="all">All hospitals</option>
            <option value="public_hospital">Public hospitals only</option>
            <option value="grace_period">In grace period</option>
            <option value="trialing">On trial</option>
          </select>
          <button
            className={`${amberButton} flex items-center gap-2`}
            disabled={loading || !title || !body}
            onClick={submit}
          >
            <Send size={14} />{" "}
            {loading ? "Publishing…" : "Publish announcement"}
          </button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No announcements yet
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="bg-[#111827] border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Megaphone size={15} />
                </span>
                <div>
                  <div className="font-medium text-white">{a.title}</div>
                  <div className="text-sm text-slate-400 mt-1">{a.body}</div>
                  <div className="text-xs text-slate-500 mt-2 capitalize">
                    {a.targetSegment.replace("_", " ")} ·{" "}
                    {new Date(a.publishAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
