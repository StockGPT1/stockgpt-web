"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    /* Warm the dashboard shell while the user types so the post-login
       navigation only has to stream the data, not the whole route. */
    router.prefetch("/dashboard");
  }, [router]);

  async function login() {
    if (loading) return;

    const next = normaliseInternalRedirect(
      new URLSearchParams(window.location.search).get("next"),
    );

    setLoading(true);
    setErrorMessage("");

    let redirecting = false;

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

      /* Client-side navigation streams the dashboard behind its loading
         skeleton immediately — a full window.location reload re-parses
         the entire app before anything paints. */
      redirecting = true;
      router.push(data?.redirectTo ?? "/dashboard");
    } finally {
      /* keep the button in its "Logging in..." state while navigating */
      if (!redirecting) setLoading(false);
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
