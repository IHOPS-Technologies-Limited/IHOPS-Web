import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import { amberButton, ghostButton, darkInput } from "../../components/superadmin/styles";
import {
  PageHeader,
  Card,
  KV,
  DarkBadge,
  NoticeBar,
  Notice,
  errText,
  fmtDate,
} from "../../components/superadmin/ui";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

function uptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d ? d + "d " : ""}${h}h ${m}m`;
}

const STATE_TONE: Record<string, "green" | "amber" | "red"> = {
  live: "green",
  mock: "amber",
  misconfigured: "red",
};
const STATE_LABEL: Record<string, string> = {
  live: "Live",
  mock: "Off (messages only logged)",
  misconfigured: "On but missing settings",
};

export default function SystemStatus() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    superAdminApi
      .get("/internal/system")
      .then(setData)
      .catch((e) => setNotice({ kind: "error", text: errText(e) }))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function testEmail() {
    setBusy("email");
    setNotice(null);
    try {
      const r = await superAdminApi.post("/internal/system/test-email", { to: testTo });
      setNotice({ kind: r.ok && !r.mocked ? "ok" : "error", text: r.message });
    } catch (e: any) {
      setNotice({ kind: "error", text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runSweep() {
    setBusy("sweep");
    setNotice(null);
    try {
      const r = await superAdminApi.post("/internal/system/run-sweep", {});
      const detail = r.changes.length
        ? " " + r.changes.map((c: any) => `${c.status}: ${c.before}→${c.after}`).join(", ")
        : "";
      setNotice({ kind: "ok", text: r.message + detail });
      load();
    } catch (e: any) {
      setNotice({ kind: "error", text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="System"
        sub="Server health, integrations and configuration — secret values are never shown"
        actions={
          <button className={`${ghostButton} flex items-center gap-1.5`} onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      {!data ? (
        <div className="text-slate-500 text-sm py-12 text-center">{loading ? "Loading…" : ""}</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Server">
            <div className="grid grid-cols-2 gap-4">
              <KV label="Environment">{data.server.environment}</KV>
              <KV label="Uptime">{uptime(data.server.uptimeSeconds)}</KV>
              <KV label="Started">{fmtDate(data.server.startedAt)}</KV>
              <KV label="Node.js">{data.server.nodeVersion}</KV>
              <KV label="Memory">{data.server.memoryMb.rss} MB (heap {data.server.memoryMb.heapUsed} MB)</KV>
              <KV label="Frontend URL">{data.server.appBaseUrl}</KV>
              <KV label="Trial length">{data.business.trialLengthDays} days</KV>
              <KV label="Grace period">{data.business.gracePeriodDays} days</KV>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Render's free tier sleeps when idle — a short uptime can simply mean the service just woke up.
            </p>
          </Card>

          <Card title="Database">
            <div className="flex items-center gap-2 mb-4">
              {data.database.ok ? (
                <DarkBadge tone="green"><CheckCircle2 size={12} /> Connected · {data.database.latencyMs} ms</DarkBadge>
              ) : (
                <DarkBadge tone="red"><XCircle size={12} /> Unreachable</DarkBadge>
              )}
              <span className="text-xs text-slate-500">{data.database.provider}</span>
            </div>
            {data.database.error && <p className="text-xs text-red-300 mb-3">{data.database.error}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.entries(data.database.rows).map(([k, v]) => (
                <KV key={k} label={k.replace(/([A-Z])/g, " $1").toLowerCase()}>
                  <span className="font-mono">{String(v)}</span>
                </KV>
              ))}
            </div>
          </Card>

          <Card title="Integrations" className="lg:col-span-2">
            <ul className="divide-y divide-white/5">
              {data.integrations.map((i: any) => (
                <li key={i.key} className="py-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-white">{i.label}</div>
                    {Object.entries(i.details).map(([k, v]) => (
                      <div key={k} className="text-xs text-slate-500">
                        {k}: <span className="text-slate-300">{String(v ?? "—")}</span>
                      </div>
                    ))}
                    {i.missing.length > 0 && (
                      <div className="text-xs text-red-300 mt-1">
                        Missing in Render: <span className="font-mono">{i.missing.join(", ")}</span>
                      </div>
                    )}
                  </div>
                  <DarkBadge tone={STATE_TONE[i.state]}>{STATE_LABEL[i.state]}</DarkBadge>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-sm font-medium text-white mb-2">Send a test email</div>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${darkInput} max-w-xs`}
                  placeholder="you@example.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <button className={amberButton} disabled={!testTo || busy === "email"} onClick={testEmail}>
                  {busy === "email" ? "Sending…" : "Send test"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Confirms signup, verification and password-reset emails can actually be delivered.
              </p>
            </div>
          </Card>

          <Card title="Security & configuration checks">
            <ul className="space-y-3">
              {data.security.map((c: any) => (
                <li key={c.label} className="flex gap-2 text-sm">
                  {c.ok ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={c.ok ? "text-slate-200" : "text-red-300"}>{c.label}</div>
                    {!c.ok && <div className="text-xs text-slate-500">{c.hint}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Scheduled jobs">
            <ul className="divide-y divide-white/5 mb-4">
              {data.scheduledJobs.map((j: any) => (
                <li key={j.name} className="py-2 flex justify-between text-sm">
                  <span>{j.name}</span>
                  <span className="text-slate-500">every {j.every}</span>
                </li>
              ))}
            </ul>
            <button className={ghostButton} disabled={busy === "sweep"} onClick={runSweep}>
              {busy === "sweep" ? "Running…" : "Run trial / grace / suspension sweep now"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Safe to run any time — it only changes hospitals whose trial or grace period has already ended.
            </p>
          </Card>

          <Card title="Changing settings" className="lg:col-span-2">
            <p className="text-sm text-slate-400">{data.note}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
