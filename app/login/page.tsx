"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthProviderButtons } from "@/components/AuthProviderButtons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
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
    <main className="relative flex min-h-dvh items-start justify-center overflow-x-hidden overflow-y-auto bg-[#0F2A1F] px-4 py-4 text-[#faf6f0] sm:px-6 sm:py-6 lg:items-center lg:py-3">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(221,177,89,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_50%_95%,rgba(221,177,89,0.10),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.045)_0_1px,transparent_1px_42px)] opacity-30" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/10" />
        <div className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/5" />
      </div>

      <section className="relative my-auto w-full max-w-[430px] rounded-[2rem] border border-[#ddb159]/28 bg-[#082519]/82 p-5 text-[#faf6f0] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6 lg:my-0 lg:max-h-[calc(100dvh-1.5rem)] lg:max-w-[400px] lg:overflow-y-auto lg:p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ddb159]/70 to-transparent" />

        <div className="relative mx-auto mb-4 h-10 w-40 sm:mx-0 sm:h-11 sm:w-44 lg:mb-3 lg:h-9 lg:w-40">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain"
          />
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px] lg:text-[9px]">
            Private market intelligence
          </p>

          <h1 className="mt-2 text-[30px] font-black leading-none tracking-[-0.04em] sm:text-[36px] lg:text-[32px]">
            Welcome back.
          </h1>

          <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62 sm:text-[13px] lg:mt-2 lg:text-[12px]">
            Log in to access your rankings, portfolio tools, watchlist and premium StockGPT insights.
          </p>
        </div>

        <div className="mt-5 space-y-3 lg:mt-4 lg:space-y-2.5">
          <AuthProviderButtons onError={setErrorMessage} />

          <div className="flex items-center gap-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/35 lg:py-0.5 lg:text-[9px]">
            <span className="h-px min-w-0 flex-1 bg-[#ddb159]/14" />
            <span className="shrink-0">or use email</span>
            <span className="h-px min-w-0 flex-1 bg-[#ddb159]/14" />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px] lg:mb-1 lg:text-[9px]">
              Email
            </span>
            <input
              className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] lg:h-10 lg:text-[13px]"
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
            <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px] lg:mb-1 lg:text-[9px]">
              Password
            </span>
            <input
              className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] lg:h-10 lg:text-[13px]"
              type="password"
              placeholder="Enter your password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
          </label>

          {errorMessage && (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-[12px] font-bold text-red-200 lg:p-2.5 lg:text-[11px]">
              {errorMessage}
            </div>
          )}

          <button
            onClick={login}
            disabled={loading}
            className="mt-2 h-11 w-full rounded-full bg-[#ddb159] px-4 text-[14px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.22)] transition hover:brightness-105 disabled:opacity-60 lg:mt-1.5 lg:h-10 lg:text-[13px]"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <div className="grid gap-1.5 pt-1 text-center text-[12px] font-semibold text-[#faf6f0]/65 sm:text-[13px] lg:gap-1 lg:text-[12px]">
            <Link href="/forgot-password" className="transition hover:text-[#ddb159]">
              Forgotten password?
            </Link>

            <Link href="/signup" className="transition hover:text-[#ddb159]">
              Create an account
            </Link>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/45 p-3 text-center text-[10px] font-semibold leading-relaxed text-[#faf6f0]/45 sm:text-[11px] lg:mt-4 lg:p-2.5 lg:text-[10px]">
          Exclusive access to AI-ranked S&amp;P 500 intelligence, portfolio construction and market insights.
        </div>
      </section>
    </main>
  );
}
