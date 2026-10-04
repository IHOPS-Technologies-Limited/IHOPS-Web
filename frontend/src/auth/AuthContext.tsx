import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken } from "../api/client";

interface Staff {
  id: string;
  name: string;
  email?: string | null;
  role:
    | "administrator"
    | "doctor"
    | "receptionist"
    | "finance_officer"
    | "nurse";
  staffIdDisplay: string;
  mustChangePin: boolean;
  department?: string | null;
}
interface Tenant {
  id: string;
  hospitalName: string;
  hospitalType?: string;
  status: string;
  setupWizardCompleted: boolean;
  trialEndsAt: string | null;
  currency?: string;
}

interface AuthState {
  staff: Staff | null;
  tenant: Tenant | null;
  loading: boolean;
  setSession: (token: string, staff: Staff, tenant?: Tenant) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/auth/me");
      setStaff(data.staff);
      setTenant(data.tenant);
    } catch {
      localStorage.removeItem("ihops_token");
      setStaff(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSession(token: string, s: Staff, t?: Tenant) {
    localStorage.setItem("ihops_token", token);
    setStaff(s);
    if (t) setTenant(t);
  }

  function logout() {
    localStorage.removeItem("ihops_token");
    setStaff(null);
    setTenant(null);
  }

  return (
    <AuthContext.Provider
      value={{ staff, tenant, loading, setSession, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
