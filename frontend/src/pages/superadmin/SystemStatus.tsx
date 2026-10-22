import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import {
  amberButton,
  ghostButton,
  darkInput,
} from "../../components/superadmin/styles";
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
import { fmtNaira } from "../../components/superadmin/ui";

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
      const r = await superAdminApi.post("/internal/system/test-email", {
        to: testTo,
      });
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
        ? " " +
          r.changes
            .map((c: any) => `${c.status}: ${c.before}→${c.after}`)
            .join(", ")
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
          <button
            className={`${ghostButton} flex items-center gap-1.5`}
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      {!data ? (
        <div className="text-slate-500 text-sm py-12 text-center">
          {loading ? "Loading…" : ""}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Server">
            <div className="grid grid-cols-2 gap-4">
              <KV label="Environment">{data.server.environment}</KV>
              <KV label="Uptime">{uptime(data.server.uptimeSeconds)}</KV>
              <KV label="Started">{fmtDate(data.server.startedAt)}</KV>
              <KV label="Node.js">{data.server.nodeVersion}</KV>
              <KV label="Memory">
                {data.server.memoryMb.rss} MB (heap{" "}
                {data.server.memoryMb.heapUsed} MB)
              </KV>
              <KV label="Frontend URL">{data.server.appBaseUrl}</KV>
              <KV label="Trial length">{data.business.trialLengthDays} days</KV>
              <KV label="Grace period">{data.business.gracePeriodDays} days</KV>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Render's free tier sleeps when idle — a short uptime can simply
              mean the service just woke up.
            </p>
          </Card>

          <Card title="Database">
            <div className="flex items-center gap-2 mb-4">
              {data.database.ok ? (
                <DarkBadge tone="green">
                  <CheckCircle2 size={12} /> Connected ·{" "}
                  {data.database.latencyMs} ms
                </DarkBadge>
              ) : (
                <DarkBadge tone="red">
                  <XCircle size={12} /> Unreachable
                </DarkBadge>
              )}
              <span className="text-xs text-slate-500">
                {data.database.provider}
              </span>
            </div>
            {data.database.error && (
              <p className="text-xs text-red-300 mb-3">{data.database.error}</p>
            )}
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
                <li
                  key={i.key}
                  className="py-3 flex flex-wrap items-start justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {i.label}
                    </div>
                    {Object.entries(i.details).map(([k, v]) => (
                      <div key={k} className="text-xs text-slate-500">
                        {k}:{" "}
                        <span className="text-slate-300">
                          {String(v ?? "—")}
                        </span>
                      </div>
                    ))}
                    {i.missing.length > 0 && (
                      <div className="text-xs text-red-300 mt-1">
                        Missing in Render:{" "}
                        <span className="font-mono">
                          {i.missing.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                  <DarkBadge tone={STATE_TONE[i.state]}>
                    {STATE_LABEL[i.state]}
                  </DarkBadge>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-sm font-medium text-white mb-2">
                Send a test email
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${darkInput} max-w-xs`}
                  placeholder="you@example.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <button
                  className={amberButton}
                  disabled={!testTo || busy === "email"}
                  onClick={testEmail}
                >
                  {busy === "email" ? "Sending…" : "Send test"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Confirms signup, verification and password-reset emails can
                actually be delivered.
              </p>
            </div>
          </Card>

          <Card
            title="SMS cost tracking (last 30 days)"
            className="lg:col-span-2"
          >
            {(() => {
              const c = data.smsCosts;
              const total = c.patient.messages + c.internal.messages;
              if (total === 0)
                return (
                  <p className="text-sm text-slate-500">
                    No real SMS sent yet (or the SMS provider is switched off).
                    Costs appear here once messages go out.
                  </p>
                );
              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KV label="Provider balance (last seen)">
                      <span className="font-mono">
                        {c.latestProviderBalance === null
                          ? "—"
                          : fmtNaira(c.latestProviderBalance)}
                      </span>
                    </KV>
                    <KV label="Avg real cost per page">
                      <span className="font-mono">
                        {c.avgCostPerPage === null
                          ? "not enough data"
                          : fmtNaira(c.avgCostPerPage)}
                      </span>
                    </KV>
                    <KV label="Multi-page messages">
                      <span className="font-mono">{c.multiPageMessages}</span>{" "}
                      of {total}
                    </KV>
                    <KV label="Unicode messages (₦, curly quotes…)">
                      <span className="font-mono">{c.unicodeMessages}</span> of{" "}
                      {total}
                    </KV>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-200">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-white/10">
                          <th className="py-2 pr-3 font-medium">Type</th>
                          <th className="py-2 pr-3 font-medium text-right">
                            Messages
                          </th>
                          <th className="py-2 pr-3 font-medium text-right">
                            Pages
                          </th>
                          <th className="py-2 pr-3 font-medium text-right">
                            Units billed to hospitals
                          </th>
                          <th className="py-2 font-medium text-right">
                            Est. cost to IHOPS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ["Patient messages", c.patient],
                            ["Internal (staff PINs, system)", c.internal],
                          ] as const
                        ).map(([label, r]) => (
                          <tr
                            key={label}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="py-2 pr-3">{label}</td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {r.messages}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {r.pages}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {r.unitsBilled}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {fmtNaira(r.costNaira)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white mb-2">
                      Latest sends
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-slate-200">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-white/10">
                            <th className="py-2 pr-3 font-medium">When</th>
                            <th className="py-2 pr-3 font-medium">For</th>
                            <th className="py-2 pr-3 font-medium">To</th>
                            <th className="py-2 pr-3 font-medium text-right">
                              Length
                            </th>
                            <th className="py-2 pr-3 font-medium text-right">
                              Pages
                            </th>
                            <th className="py-2 pr-3 font-medium text-right">
                              Units
                            </th>
                            <th className="py-2 pr-3 font-medium text-right">
                              Cost
                            </th>
                            <th className="py-2 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.recent.map((r: any) => (
                            <tr
                              key={r.id}
                              className="border-b border-white/5 last:border-0"
                            >
                              <td className="py-2 pr-3 whitespace-nowrap text-slate-400">
                                {fmtDate(r.createdAt)}
                              </td>
                              <td className="py-2 pr-3">
                                {r.hospital || (
                                  <span className="text-slate-500">
                                    internal
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs text-slate-400">
                                {r.to}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {r.characters}
                                {r.encoding === "unicode" ? " (U)" : ""}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {r.pages}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {r.unitsBilled}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {r.costNaira === null
                                  ? "—"
                                  : fmtNaira(r.costNaira)}
                              </td>
                              <td className="py-2">
                                {r.ok ? (
                                  <DarkBadge tone="green">sent</DarkBadge>
                                ) : (
                                  <DarkBadge tone="red">failed</DarkBadge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cost per send is worked out from the drop in your Termii
                    balance between consecutive sends, so it's exact for sends
                    that don't overlap and an estimate otherwise (and blank
                    right after a top-up). “(U)” means the message contained
                    characters like ₦ or curly quotes, so it's counted at 70
                    characters per page instead of 160. If a message's cost
                    doesn't match its page count, Termii is counting differently
                    from this estimate — that's what this table is for.
                  </p>
                </div>
              );
            })()}
          </Card>

          <Card title="Security & configuration checks">
            <ul className="space-y-3">
              {data.security.map((c: any) => (
                <li key={c.label} className="flex gap-2 text-sm">
                  {c.ok ? (
                    <CheckCircle2
                      size={16}
                      className="text-emerald-400 shrink-0 mt-0.5"
                    />
                  ) : (
                    <XCircle
                      size={16}
                      className="text-red-400 shrink-0 mt-0.5"
                    />
                  )}
                  <div>
                    <div className={c.ok ? "text-slate-200" : "text-red-300"}>
                      {c.label}
                    </div>
                    {!c.ok && (
                      <div className="text-xs text-slate-500">{c.hint}</div>
                    )}
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
            <button
              className={ghostButton}
              disabled={busy === "sweep"}
              onClick={runSweep}
            >
              {busy === "sweep"
                ? "Running…"
                : "Run trial / grace / suspension sweep now"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Safe to run any time — it only changes hospitals whose trial or
              grace period has already ended.
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
