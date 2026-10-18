import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { superAdminApi } from "../../api/client";
import { ghostButton } from "../../components/superadmin/styles";
import {
  PageHeader,
  Card,
  Stat,
  Empty,
  NoticeBar,
  Notice,
  errText,
  fmtDate,
  fmtNaira,
  timeAgo,
  titleCase,
} from "../../components/superadmin/ui";
import { RefreshCw } from "lucide-react";

function HospitalLink({ id, name }: { id: string; name: string }) {
  return (
    <Link to={`/internal/hospitals/${id}`} className="text-amber-400 hover:text-amber-300 font-medium">
      {name}
    </Link>
  );
}

function List({ empty, children }: { empty: string; children: React.ReactNode[] }) {
  if (children.length === 0) return <Empty>{empty}</Empty>;
  return <ul className="divide-y divide-white/5">{children}</ul>;
}

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate">{left}</span>
      <span className="text-xs text-slate-500 whitespace-nowrap">{right}</span>
    </li>
  );
}

export default function Overview() {
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    superAdminApi
      .get("/internal/overview")
      .then((r) => {
        setData(r);
        setNotice(null);
      })
      .catch((e) => setNotice({ kind: "error", text: errText(e) }))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const s = data?.tenants?.byStatus || {};
  const att = data?.attention;

  return (
    <div>
      <PageHeader
        title="Overview"
        sub="What needs attention across the platform"
        actions={
          <button className={`${ghostButton} flex items-center gap-1.5`} onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />
      <NoticeBar notice={notice} />
      {!data ? (
        <div className="text-slate-500 text-sm py-12 text-center">{loading ? "Loading…" : ""}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Hospitals" value={data.tenants.total} sub={`${data.tenants.signupsLast7Days} new this week`} />
            <Stat label="Active (paying / approved)" value={s.active || 0} tone="green" />
            <Stat label="On trial" value={s.trialing || 0} sub={`${s.grace_period || 0} in grace period`} />
            <Stat label="Suspended" value={s.suspended || 0} tone={s.suspended ? "red" : "default"} />
            <Stat
              label="Revenue, last 30 days"
              value={fmtNaira(data.revenue.last30Days)}
              sub={`${data.revenue.payments30Days} payment${data.revenue.payments30Days === 1 ? "" : "s"}`}
              tone="amber"
            />
            <Stat label="Revenue, all time" value={fmtNaira(data.revenue.totalCollected)} sub={`${data.revenue.totalPayments} payments`} />
            <Stat
              label="Pending approvals"
              value={data.queues.pendingApprovals}
              tone={data.queues.pendingApprovals ? "amber" : "default"}
            />
            <Stat
              label="Open support tickets"
              value={data.queues.openTickets}
              tone={data.queues.openTickets ? "amber" : "default"}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Signed up but never verified their email (over 24h)">
              <List empty="None — nobody is stuck at verification.">
                {att.stuckVerification.map((t: any) => (
                  <Row
                    key={t.id}
                    left={
                      <>
                        <HospitalLink id={t.id} name={t.hospitalName} />
                        <span className="text-slate-500"> · {t.email}</span>
                      </>
                    }
                    right={timeAgo(t.createdAt)}
                  />
                ))}
              </List>
            </Card>

            <Card title="Verified, but setup wizard not finished">
              <List empty="None — everyone finished onboarding.">
                {att.stuckOnboarding.map((t: any) => (
                  <Row
                    key={t.id}
                    left={
                      <>
                        <HospitalLink id={t.id} name={t.hospitalName} />
                        <span className="text-slate-500"> · {titleCase(t.status)}</span>
                      </>
                    }
                    right={`joined ${timeAgo(t.createdAt)}`}
                  />
                ))}
              </List>
            </Card>

            <Card title="Trials ending in the next 3 days">
              <List empty="No trials ending soon.">
                {att.trialsEnding.map((t: any) => (
                  <Row
                    key={t.id}
                    left={<HospitalLink id={t.id} name={t.hospitalName} />}
                    right={fmtDate(t.trialEndsAt, false)}
                  />
                ))}
              </List>
            </Card>

            <Card title="In grace period (payment overdue)">
              <List empty="No hospitals in grace period.">
                {att.gracePeriod.map((t: any) => (
                  <Row
                    key={t.id}
                    left={<HospitalLink id={t.id} name={t.hospitalName} />}
                    right={`suspends ${fmtDate(t.gracePeriodEndsAt, false)}`}
                  />
                ))}
              </List>
            </Card>

            <Card title="Low SMS wallets (under 20 units)">
              <List empty="All wallets are healthy.">
                {att.lowSmsWallets.map((w: any) => (
                  <Row
                    key={w.id}
                    left={<HospitalLink id={w.id} name={w.hospitalName} />}
                    right={`${w.balanceUnits} units`}
                  />
                ))}
              </List>
            </Card>

            <Card title="Failed messages, last 7 days">
              <List empty="No failed messages.">
                {data.failedMessages7d.map((f: any, i: number) => (
                  <Row
                    key={i}
                    left={
                      <>
                        <span className="capitalize">{f.channel}</span>
                        <span className="text-slate-500"> · {f.reason || "no reason recorded"}</span>
                      </>
                    }
                    right={`${f.count}×`}
                  />
                ))}
              </List>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
