import React from "react";
import { Link } from "react-router-dom";
import { Card, Empty, DarkBadge, fmtDate } from "../../../components/superadmin/ui";
import type { TabProps } from "../HospitalDetail";

export default function ActivityTab({ data }: TabProps) {
  return (
    <Card
      title="Recent activity"
      action={
        <Link to={`/internal/audit?tenantId=${data.hospital.id}`} className="text-xs text-amber-400 hover:text-amber-300">
          Full audit log →
        </Link>
      }
    >
      {data.activity.length === 0 ? (
        <Empty>No activity recorded yet.</Empty>
      ) : (
        <ul className="divide-y divide-white/5">
          {data.activity.map((a: any) => (
            <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-mono text-xs">{a.actionType}</span>{" "}
                {a.actor === "IHOPS Internal" && <DarkBadge tone="amber">internal</DarkBadge>}
                <div className="text-xs text-slate-500">{a.actor}</div>
              </div>
              <span className="text-xs text-slate-500">{fmtDate(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
