import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../../api/client";
import { Modal, ErrorBanner } from "../../components/ui";
import {
  Wallet,
  TrendingUp,
  Clock,
  ShieldCheck,
  Receipt,
  PiggyBank,
  Download,
  Plus,
} from "lucide-react";

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showExpense, setShowExpense] = useState(false);

  async function load() {
    const [s, e] = await Promise.all([
      api.get("/finance/summary"),
      api.get("/finance/expenses"),
    ]);
    setSummary(s);
    setExpenses(e.expenses);
  }

  useEffect(() => {
    load();
  }, []);

  if (!summary)
    return <div className="text-slate-400">Loading finance data…</div>;

  const STATS = [
    {
      label: "Revenue Today",
      value: `₦${summary.revenueToday.toLocaleString()}`,
      icon: Wallet,
      tint: "bg-blue-50 text-blue-600",
    },
    {
      label: "Revenue This Month",
      value: `₦${summary.revenueThisMonth.toLocaleString()}`,
      icon: TrendingUp,
      tint: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Outstanding Payments",
      value: `₦${summary.outstandingPayments.toLocaleString()}`,
      icon: Clock,
      tint: "bg-amber-50 text-amber-600",
    },
    {
      label: "Insurance Receivables",
      value: `₦${summary.insuranceReceivables.toLocaleString()}`,
      icon: ShieldCheck,
      tint: "bg-purple-50 text-purple-600",
    },
    {
      label: "Expenses This Month",
      value: `₦${summary.expenses.toLocaleString()}`,
      icon: Receipt,
      tint: "bg-red-50 text-red-500",
    },
    {
      label: "Net Cash Position",
      value: `₦${summary.netCashPosition.toLocaleString()}`,
      icon: PiggyBank,
      tint: "bg-teal-50 text-teal-600",
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Finance
          </h1>
          <p className="text-sm text-slate-500">
            Revenue, expenses, and outstanding balances at a glance
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition"
            onClick={() =>
              downloadFile("/finance/export", "ihops-finance-export.xlsx")
            }
          >
            <Download size={15} /> Export report
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
            onClick={() => setShowExpense(true)}
          >
            <Plus size={15} /> Record expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-100 p-4"
          >
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.tint}`}
            >
              <s.icon size={18} />
            </span>
            <div className="text-xs text-slate-400">{s.label}</div>
            <div className="text-lg font-mono font-semibold text-slate-800 mt-0.5">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display font-bold text-slate-800 mb-3">
        Recent expenses
      </h2>
      <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr
                key={e.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
              >
                <td className="px-4 py-3 text-slate-700">{e.category}</td>
                <td className="px-4 py-3 text-slate-600">{e.description}</td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  ₦{e.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(e.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {e.recordedBy.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showExpense && (
        <RecordExpenseModal
          onClose={() => setShowExpense(false)}
          onSaved={() => {
            setShowExpense(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RecordExpenseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState("Supplies");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await api.post("/finance/expenses", {
        category,
        description,
        amount: Number(amount),
        date,
        pin,
      });
      onSaved();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Record expense">
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Supplies</option>
            <option>Utilities</option>
            <option>Salaries</option>
            <option>Maintenance</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (₦)</label>
            <input
              type="number"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Confirm your PIN</label>
          <input
            type="password"
            inputMode="numeric"
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full disabled:opacity-50"
          disabled={loading}
          onClick={submit}
        >
          {loading ? "Saving…" : "Save expense"}
        </button>
      </div>
    </Modal>
  );
}
