"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function resetPassword() {
    setLoading(true);
    setErrorMessage("");

    const siteUrl = window.location.origin;
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent("/update-password")}`;

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setErrorMessage("Could not send reset email. Please try again.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0F2A1F] px-4 py-8 text-[#faf6f0] sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(221,177,89,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_50%_95%,rgba(221,177,89,0.10),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.045)_0_1px,transparent_1px_42px)] opacity-30" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/10" />
        <div className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/5" />
      </div>

      <section className="relative w-full max-w-md rounded-[2rem] border border-[#ddb159]/28 bg-[#082519]/82 p-5 text-[#faf6f0] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ddb159]/70 to-transparent" />

        <div className="relative mx-auto mb-5 h-12 w-44 sm:mx-0">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain"
          />
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
            Secure recovery
          </p>

          <h1 className="mt-2 text-[31px] font-black leading-none tracking-[-0.04em] sm:text-4xl">
            Reset your password.
          </h1>

          <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#faf6f0]/62">
            Enter your email and we’ll send you a secure reset link to regain
            access to your StockGPT account.
          </p>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-center text-[13px] font-bold leading-relaxed text-emerald-100 sm:text-left">
            Check your email for the password reset link.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85">
                Email
              </span>
              <input
                className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f]"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetPassword()}
              />
            </label>

            {errorMessage && (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-[13px] font-bold text-red-200">
                {errorMessage}
              </div>
            )}

            <button
              onClick={resetPassword}
              disabled={loading}
              className="mt-2 h-12 w-full rounded-full bg-[#ddb159] px-4 text-[14px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.22)] transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <div className="pt-2 text-center text-[13px] font-semibold text-[#faf6f0]/65">
              <Link href="/login" className="transition hover:text-[#ddb159]">
                Back to login
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/45 p-3 text-center text-[11px] font-semibold leading-relaxed text-[#faf6f0]/45">
          Your StockGPT account stays protected while you regain access.
        </div>
      </section>
    </main>
  );
}
