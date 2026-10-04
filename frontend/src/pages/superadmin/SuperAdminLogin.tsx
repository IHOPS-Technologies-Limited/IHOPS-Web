import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { superAdminApi } from "../../api/client";
import { ErrorBanner } from "../../components/ui";
import { ShieldCheck } from "lucide-react";
import { darkInput, amberButton } from "../../components/superadmin/styles";

export default function SuperAdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApi.post("/auth/super-admin/login", {
        email,
        password,
      });
      localStorage.setItem("ihops_superadmin_token", res.token);
      localStorage.setItem("ihops_superadmin_name", res.superAdmin.name);
      nav("/internal/approvals");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
            <ShieldCheck size={20} className="text-slate-950" />
          </span>
          <div>
            <h1 className="text-lg font-display font-extrabold text-white leading-tight">
              IHOPS Internal
            </h1>
            <p className="text-xs text-slate-400">
              Platform operations console
            </p>
          </div>
        </div>
        <ErrorBanner message={error} />
        <div className="space-y-3">
          <input
            className={darkInput}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={darkInput}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button
            className={`w-full ${amberButton}`}
            disabled={loading}
            onClick={submit}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
