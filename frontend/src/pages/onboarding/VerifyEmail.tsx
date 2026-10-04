import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../../api/client";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    api
      .get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus("ok");
        setMessage(res.message);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e.message);
      });
  }, [params]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center">
        {status === "loading" && <p className="text-teal-900/60">Verifying…</p>}
        {status === "ok" && (
          <>
            <div className="text-4xl mb-3">✅</div>
            <h1 className="text-xl font-extrabold text-teal-900">Email verified</h1>
            <p className="text-sm text-teal-900/60 mt-2">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-extrabold text-teal-900">Couldn't verify</h1>
            <p className="text-sm text-teal-900/60 mt-2">{message}</p>
          </>
        )}
        <Link to="/login" className="btn-primary inline-block mt-5">Go to sign in</Link>
      </div>
    </div>
  );
}
