"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthMessage,
  AuthScaffold,
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthScaffold";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function resetPassword() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(data?.error ?? "Too many attempts. Please wait and try again.");
        return;
      }

      setSent(true);
      setMessage(
        data?.message ??
          "If an account exists for that email, a reset link has been sent.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="Account recovery"
      title="Reset your password."
      subtitle="Enter your email and we'll send a secure reset link if the account exists."
      footer={
        <p className="text-center text-[13px] font-semibold text-white/60">
          Remembered it?{" "}
          <Link href="/login" className={authInlineLinkClass}>
            Back to log in
          </Link>
        </p>
      }
    >
      {sent ? (
        <AuthMessage tone="success">{message}</AuthMessage>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className={authLabelClass}>Email</span>
            <input
              className={authInputClass}
              type="email"
              placeholder="you@example.com"
              value={email}
              maxLength={254}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resetPassword()}
            />
          </label>

          {message && <AuthMessage tone="error">{message}</AuthMessage>}

          <button onClick={resetPassword} disabled={loading} className={authPrimaryButtonClass}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </div>
      )}
    </AuthScaffold>
  );
}
