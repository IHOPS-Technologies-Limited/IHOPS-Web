import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const COPY: Record<string, { title: string; body: string }> = {
  pending_verification: { title: "Verify your email", body: "Please verify your hospital's email address before continuing." },
  pending_approval: { title: "Application under review", body: "Your Public Hospital application is being reviewed by the IHOPS team. We'll notify your registered email once a decision is made." },
  suspended: { title: "Account suspended", body: "Your subscription has lapsed and the grace period has ended. Renew your subscription to restore access — none of your data has been deleted." },
  rejected: { title: "Application not approved", body: "Your Public Hospital application was not approved. You're welcome to register again under the Starter or Standard plan." },
};

export default function AccountRestricted() {
  const { tenant, logout } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState(tenant?.status || "pending_verification");

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get("/auth/tenant-status");
        setStatus(res.status);
        if (res.status === "active" || res.status === "trialing") window.location.href = "/app/dashboard";
      } catch {
        /* ignore */
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const copy = COPY[status] || COPY.pending_verification;

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-3">⏳</div>
        <h1 className="text-xl font-extrabold text-teal-900">{copy.title}</h1>
        <p className="text-sm text-teal-900/60 mt-2">{copy.body}</p>
        {status === "suspended" && (
          <button className="btn-primary w-full mt-5" onClick={() => nav("/app/admin/subscription")}>Renew subscription</button>
        )}
        <button className="btn-secondary w-full mt-3" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
