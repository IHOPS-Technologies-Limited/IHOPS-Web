import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { superAdminApi } from "../../api/client";
import {
  StatusBadge,
  Tabs,
  NoticeBar,
  Notice,
  errText,
  titleCase,
} from "../../components/superadmin/ui";
import { ArrowLeft } from "lucide-react";
import OverviewTab from "./hospital/OverviewTab";
import StaffTab from "./hospital/StaffTab";
import DepartmentsTab from "./hospital/DepartmentsTab";
import SubscriptionTab from "./hospital/SubscriptionTab";
import WalletTab from "./hospital/WalletTab";
import ActivityTab from "./hospital/ActivityTab";
import DangerTab from "./hospital/DangerTab";

type TabId = "overview" | "staff" | "departments" | "subscription" | "wallet" | "activity" | "danger";

export interface TabProps {
  data: any;
  reload: () => Promise<void>;
  notify: (n: Notice) => void;
}

// One hospital's management page: everything that used to need a terminal.
export default function HospitalDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [notice, setNotice] = useState<Notice>(null);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await superAdminApi.get(`/internal/hospitals/${id}`);
      setData(r);
    } catch (e: any) {
      if (e.status === 404) setMissing(true);
      else setNotice({ kind: "error", text: errText(e) });
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    setMissing(false);
    reload();
  }, [reload]);

  const notify = (n: Notice) => {
    setNotice(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (missing)
    return (
      <div className="text-center py-16">
        <p className="text-slate-300 mb-3">This hospital no longer exists.</p>
        <Link to="/internal/hospitals" className="text-amber-400">← Back to hospitals</Link>
      </div>
    );
  if (!data) return <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>;

  const h = data.hospital;
  const lockedStaff = data.staff.filter((s: any) => s.locked).length;
  const props: TabProps = { data, reload, notify };

  return (
    <div>
      <Link to="/internal/hospitals" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3">
        <ArrowLeft size={13} /> All hospitals
      </Link>
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-display font-extrabold text-white">{h.hospitalName}</h1>
          <StatusBadge status={h.status} />
        </div>
        <p className="text-sm text-slate-400 mt-0.5">
          {h.hospitalType} · {h.email} · {titleCase(data.subscription?.planCode)}
          {data.subscription?.billingCycle && data.subscription.billingCycle !== "none" ? ` (${data.subscription.billingCycle})` : ""}
        </p>
      </div>

      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "staff", label: `Staff (${data.staff.length})`, badge: lockedStaff },
          { id: "departments", label: `Departments (${data.departments.length})` },
          { id: "subscription", label: "Subscription" },
          { id: "wallet", label: "SMS wallet" },
          { id: "activity", label: "Activity" },
          { id: "danger", label: "Danger zone" },
        ]}
      />

      {tab === "overview" && <OverviewTab {...props} />}
      {tab === "staff" && <StaffTab {...props} />}
      {tab === "departments" && <DepartmentsTab {...props} />}
      {tab === "subscription" && <SubscriptionTab {...props} />}
      {tab === "wallet" && <WalletTab {...props} />}
      {tab === "activity" && <ActivityTab {...props} />}
      {tab === "danger" && <DangerTab {...props} onDeleted={() => nav("/internal/hospitals")} />}
    </div>
  );
}
