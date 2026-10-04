import React from "react";

export function StatCard({ label, value, sub, tone = "teal" }: { label: string; value: string | number; sub?: string; tone?: "teal" | "amber" | "alert" }) {
  const toneClasses = { teal: "text-teal-700", amber: "text-amber-700", alert: "text-alert" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-teal-900/60 font-medium">{label}</div>
      <div className={`text-2xl font-mono font-semibold mt-1 ${toneClasses}`}>{value}</div>
      {sub && <div className="text-xs text-teal-900/50 mt-1">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "amber" | "alert" | "gray" }) {
  const map: Record<string, string> = {
    teal: "bg-teal-100 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    alert: "bg-red-50 text-alert",
    gray: "bg-gray-100 text-gray-600",
  };
  return <span className={`badge ${map[tone]}`}>{children}</span>;
}

export function PaymentBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="gray">—</Badge>;
  const map: Record<string, { label: string; tone: "teal" | "amber" | "alert" }> = {
    paid: { label: "Paid", tone: "teal" },
    partially_paid: { label: "Partial", tone: "amber" },
    not_paid: { label: "Unpaid", tone: "alert" },
    covered_by_insurance: { label: "Insurance", tone: "amber" },
  };
  const cfg = map[status] || { label: status, tone: "gray" as const };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-canvas">
      <div className="text-teal-700 font-display font-semibold animate-pulse">IHOPS is loading…</div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="bg-red-50 border border-red-200 text-alert text-sm rounded-lg px-3 py-2 mb-4">{message}</div>;
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center py-12 text-teal-900/50">
      <div className="font-display font-semibold text-teal-900/70">{title}</div>
      {sub && <div className="text-sm mt-1">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-bold text-lg text-teal-900">{title}</h3>
          <button onClick={onClose} className="text-teal-900/40 hover:text-teal-900 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
