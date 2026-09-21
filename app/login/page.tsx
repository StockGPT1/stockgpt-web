"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthProviderButtons } from "@/components/AuthProviderButtons";
import {
  AuthMessage,
  AuthScaffold,
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthScaffold";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";
import { isStockGPTIOSApp } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";
const FACE_ID_OFFER_KEY = "stockgpt:faceid-offer-pending";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isIOSApp, setIsIOSApp] = useState(false);

  useEffect(() => {
    setIsIOSApp(isStockGPTIOSApp());
    /* Warm the dashboard shell while the user types so the post-login
       navigation only has to stream the data, not the whole route. */
    router.prefetch("/dashboard");
  }, [router]);

  function queueFaceIDOffer() {
    if (!isStockGPTIOSApp()) return;
    if (window.localStorage.getItem(FACE_ID_KEY) !== null) return;
    window.localStorage.setItem(FACE_ID_OFFER_KEY, "true");
    window.dispatchEvent(new CustomEvent("stockgpt:faceid-offer"));
  }

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

      queueFaceIDOffer();

      /* Client-side navigation streams the dashboard behind its loading
         skeleton immediately — a full window.location reload re-parses
         the entire app before anything paints. */
      redirecting = true;
      router.push(data?.redirectTo ?? "/dashboard");
    } catch (error) {
      console.error("[login] request failed", error);
      setErrorMessage(
        "Could not reach StockGPT. Check that your iPhone is still connected to the same Wi-Fi and try again.",
      );
    } finally {
      /* keep the button in its "Signing in..." state while navigating */
      if (!redirecting) setLoading(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="Private market intelligence"
      title={isIOSApp ? "Welcome to StockGPT." : "Welcome back."}
      subtitle={
        isIOSApp
          ? "Secure access to your rankings, portfolio, watchlist and market intelligence."
          : "Log in to your rankings, portfolio tools, watchlist and research."
      }
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
        {isIOSApp && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-[10px] font-bold text-white/52">
            <svg viewBox="0 0 24 24" className="size-4 text-[#ddb159]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3" />
              <rect x="4" y="10" width="16" height="11" rx="3" />
            </svg>
            Secure sign-in · Face ID available after your first login
          </div>
        )}

        <AuthProviderButtons onError={setErrorMessage} />

        <div className="flex items-center gap-3 py-1 text-[9.5px] font-black uppercase tracking-[0.18em] text-white/30">
          <span className="h-px min-w-0 flex-1 bg-white/10" />
          <span className="shrink-0">or use email</span>
          <span className="h-px min-w-0 flex-1 bg-white/10" />
        </div>

        <label className="block">
          <span className={authLabelClass}>Email</span>
          <input
            className={authInputClass}
            type="email"
            placeholder="you@example.com"
            value={email}
            maxLength={254}
            autoComplete="email"
            enterKeyHint="next"
            onChange={(e) => setEmail(e.target.value)}
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
            enterKeyHint="go"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {errorMessage && <AuthMessage tone="error">{errorMessage}</AuthMessage>}

        <button
          type="button"
          onClick={() => void login()}
          disabled={loading}
          data-native-haptic="medium"
          className={authPrimaryButtonClass}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </AuthScaffold>
  );
}
