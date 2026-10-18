// Shared building blocks for the IHOPS Internal (Super Admin) console.
// Dark-theme counterparts of the light components in components/ui.tsx.

import React, { useEffect, useState } from "react";
import { X, Copy, Check, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  amberButton,
  ghostButton,
  dangerButton,
  darkInput,
  darkLabel,
} from "./styles";

// ---------- formatting ----------

export function fmtDate(d?: string | Date | null, withTime = true): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function fmtNaira(n?: number | null): string {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function timeAgo(d?: string | Date | null): string {
  if (!d) return "—";
  const secs = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function titleCase(s?: string | null): string {
  return (s || "").replace(/_/g, " ");
}

// ---------- badges ----------

const BADGE_TONES: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  blue: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  red: "bg-red-500/15 text-red-300 border-red-500/20",
  slate: "bg-white/5 text-slate-300 border-white/10",
};

export function DarkBadge({
  tone = "slate",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize whitespace-nowrap ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const tone =
    status === "active"
      ? "green"
      : status === "trialing"
        ? "blue"
        : status === "grace_period" || status === "pending_approval"
          ? "amber"
          : status === "suspended" || status === "rejected"
            ? "red"
            : "slate";
  return <DarkBadge tone={tone}>{titleCase(status) || "—"}</DarkBadge>;
}

// ---------- layout helpers ----------

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-display font-extrabold text-white">{title}</h1>
        {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-[#111827] border border-white/10 rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-display font-bold text-white">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "amber" | "red" | "green";
}) {
  const color =
    tone === "amber"
      ? "text-amber-400"
      : tone === "red"
        ? "text-red-400"
        : tone === "green"
          ? "text-emerald-400"
          : "text-white";
  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-mono font-semibold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 break-words">{children || "—"}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-500 text-center py-8">{children}</div>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={darkLabel}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// ---------- feedback ----------

export type Notice = { kind: "ok" | "error"; text: string } | null;

export function NoticeBar({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose?: () => void;
}) {
  if (!notice) return null;
  const ok = notice.kind === "ok";
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        ok
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          : "bg-red-500/10 border-red-500/20 text-red-300"
      }`}
      role={ok ? "status" : "alert"}
    >
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{notice.text}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function errText(e: any): string {
  return e?.data?.error || e?.message || "Something went wrong";
}

// ---------- modals ----------

export function DarkModal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-[#111827] border border-white/10 rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#111827] z-10">
          <h3 className="font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Destructive / sensitive action confirmation. If `typeToConfirm` is given the
// button stays disabled until the exact text is typed — and the server checks
// it again, so bypassing the UI doesn't bypass the safeguard.
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  danger = false,
  typeToConfirm,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  typeToConfirm?: string;
  onConfirm: (typed: string) => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const blocked =
    typeToConfirm !== undefined && typed.trim().toLowerCase() !== typeToConfirm.trim().toLowerCase();

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(typed.trim());
    } catch (e: any) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DarkModal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <div className="space-y-4 text-sm text-slate-300">
        {danger && (
          <div className="flex gap-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>This can't be undone.</span>
          </div>
        )}
        {children}
        {typeToConfirm !== undefined && (
          <Field label={`Type “${typeToConfirm}” to confirm`}>
            <input
              className={darkInput}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          </Field>
        )}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2" role="alert">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className={ghostButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={danger ? dangerButton : amberButton}
            onClick={go}
            disabled={busy || blocked}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </DarkModal>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API unavailable (non-HTTPS / old browser): fall back.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? "Copied" : label}
    </button>
  );
}

// One-time display of a generated credential (temp PIN / password / link).
export function SecretModal({
  open,
  onClose,
  title,
  intro,
  secrets,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: React.ReactNode;
  secrets: { label: string; value: string; mono?: boolean }[];
}) {
  return (
    <DarkModal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {intro && <div className="text-sm text-slate-300">{intro}</div>}
        {secrets.map((s) => (
          <div key={s.label} className="rounded-lg bg-slate-900 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">{s.label}</span>
              <CopyButton value={s.value} />
            </div>
            <div
              className={`text-white break-all select-all ${s.mono === false ? "text-sm" : "font-mono text-lg tracking-wide"}`}
            >
              {s.value}
            </div>
          </div>
        ))}
        <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          This is shown only once and isn't stored anywhere in readable form.
          Copy it now and pass it on securely.
        </p>
        <div className="flex justify-end">
          <button className={amberButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </DarkModal>
  );
}

// Simple tab bar.
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/10 mb-5" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
            value === t.id
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          {t.label}
          {!!t.badge && (
            <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
