import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { superAdminApi } from "../../api/client";
import { darkInput, ghostButton } from "../../components/superadmin/styles";
import {
  PageHeader,
  DarkBadge,
  NoticeBar,
  Notice,
  errText,
  fmtDate,
} from "../../components/superadmin/ui";

export default function AuditLog() {
  const [params, setParams] = useSearchParams();
  const tenantId = params.get("tenantId") || "";
  const [scope, setScope] = useState("all");
  const [action, setAction] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(
    async (append: boolean, from: string | null) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ scope, actionType: action });
        if (tenantId) qs.set("tenantId", tenantId);
        if (append && from) qs.set("cursor", from);
        const r = await superAdminApi.get(`/internal/audit-logs?${qs}`);
        setLogs((prev) => (append ? [...prev, ...r.logs] : r.logs));
        setCursor(r.nextCursor);
        setNotice(null);
      } catch (e: any) {
        setNotice({ kind: "error", text: errText(e) });
      } finally {
        setLoading(false);
      }
    },
    [scope, action, tenantId],
  );

  useEffect(() => {
    const t = setTimeout(() => load(false, null), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Audit log"
        sub="Who did what, platform-wide. Actions taken from this console are marked “IHOPS Internal”."
      />
      <NoticeBar notice={notice} />
      <div className="flex flex-wrap gap-3 mb-4">
        <select className={`${darkInput} w-auto`} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Scope">
          <option value="all">All activity</option>
          <option value="internal">IHOPS Internal actions only</option>
          <option value="hospital">Hospital staff activity only</option>
        </select>
        <input
          className={`${darkInput} max-w-xs`}
          placeholder="Filter by action, e.g. staff.reset_pin"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        {tenantId && (
          <button className={ghostButton} onClick={() => setParams({})}>
            Clear hospital filter ×
          </button>
        )}
      </div>

      {logs.length === 0 && !loading ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No matching entries
        </div>
      ) : (
        <div className="bg-[#111827] border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Hospital</th>
                <th className="px-4 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <React.Fragment key={l.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-400">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {l.actionType} {l.internal && <DarkBadge tone="amber">internal</DarkBadge>}
                    </td>
                    <td className="px-4 py-2.5">
                      {l.tenantId ? (
                        <Link
                          to={`/internal/hospitals/${l.tenantId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          {l.hospital || "—"}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{l.actor}</td>
                  </tr>
                  {expanded === l.id && (
                    <tr className="border-b border-white/5 bg-black/20">
                      <td colSpan={4} className="px-4 py-3 text-xs text-slate-400">
                        <div>Entity: {l.entityType} {l.entityId ? `· ${l.entityId}` : ""}</div>
                        {l.metadata ? (
                          <pre className="mt-2 whitespace-pre-wrap break-all text-slate-300">
                            {JSON.stringify(l.metadata, null, 2)}
                          </pre>
                        ) : (
                          <div className="mt-1">No extra details recorded.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && <div className="text-slate-500 text-sm py-4 text-center">Loading…</div>}
      {cursor && !loading && (
        <div className="text-center mt-4">
          <button className={ghostButton} onClick={() => load(true, cursor)}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
