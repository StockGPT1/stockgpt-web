"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthProviderButtons } from "@/components/AuthProviderButtons";
import {
  AuthDivider,
  AuthMessage,
  AuthScaffold,
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthScaffold";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (loading) return;

    const next = normaliseInternalRedirect(
      new URLSearchParams(window.location.search).get("next"),
    );

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, next }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.error ?? "Incorrect email or password.");
        return;
      }

      window.location.href = data?.redirectTo ?? "/dashboard";
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="Private market intelligence"
      title="Welcome back."
      subtitle="Log in to your rankings, portfolio tools, watchlist and research."
      footer={
        <div className="grid gap-2.5 text-center text-[13px] font-semibold text-white/60">
          <p>
            <Link href="/forgot-password" className={authInlineLinkClass}>
              Forgotten password?
            </Link>
          </p>
          <p>
            New to StockGPT?{" "}
            <Link href="/signup" className={authInlineLinkClass}>
              Create an account
            </Link>
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <AuthProviderButtons onError={setErrorMessage} />

        <AuthDivider label="or use email" />

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
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
        </label>

        <label className="block">
          <span className={authLabelClass}>Password</span>
          <input
            className={authInputClass}
            type="password"
            placeholder="Enter your password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
        </label>

        {errorMessage && <AuthMessage tone="error">{errorMessage}</AuthMessage>}

        <button onClick={login} disabled={loading} className={authPrimaryButtonClass}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </div>
    </AuthScaffold>
  );
}
