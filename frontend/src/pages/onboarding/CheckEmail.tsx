import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { api } from "../../api/client";

export default function CheckEmail() {
  const { state } = useLocation() as { state?: { email?: string } };
  const [sent, setSent] = useState(false);

  async function resend() {
    if (!state?.email) return;
    await api.post("/auth/resend-verification", { email: state.email });
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-3">📬</div>
        <h1 className="text-xl font-extrabold text-teal-900">Check your email</h1>
        <p className="text-sm text-teal-900/60 mt-2">
          We've sent a verification link to <span className="font-medium">{state?.email}</span>. It expires in 24 hours.
        </p>
        <button onClick={resend} className="btn-secondary mt-5 w-full" disabled={sent}>
          {sent ? "Verification email resent" : "Resend verification email"}
        </button>
        <p className="text-sm mt-4">
          <Link to="/login" className="text-teal-700 font-medium">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
