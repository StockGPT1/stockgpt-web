"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signUp() {
    setLoading(true);
    setErrorMessage("");

    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://stockgpt.pro/auth/callback?next=/account",
        data: {
          full_name: fullName,
          date_of_birth: dob,
          phone,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0F2A1F] px-4 py-6 text-[#faf6f0] sm:px-6 sm:py-8">
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
            Private access
          </p>

          <h1 className="mt-2 text-[30px] font-black leading-none tracking-[-0.04em] sm:text-4xl">
            Create your account.
          </h1>

          <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#faf6f0]/62">
            Join StockGPT to access AI rankings, watchlists, portfolio tools and
            premium market intelligence.
          </p>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-center text-[13px] font-bold leading-relaxed text-emerald-100 sm:text-left">
            Check your email to verify your account.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85">
                Full name
              </span>
              <input
                className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:h-12"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85">
                  Date of birth
                </span>
                <input
                  className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:h-12"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85">
                  Phone
                </span>
                <input
                  className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:h-12"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85">
                Email
              </span>
              <input
                className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:h-12"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signUp()}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85">
                Password
              </span>
              <input
                className="h-11 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:h-12"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signUp()}
              />
            </label>

            {errorMessage && (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-[13px] font-bold text-red-200">
                {errorMessage}
              </div>
            )}

            <button
              onClick={signUp}
              disabled={loading}
              className="mt-2 h-12 w-full rounded-full bg-[#ddb159] px-4 text-[14px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.22)] transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create account"}
            </button>

            <div className="pt-2 text-center text-[13px] font-semibold text-[#faf6f0]/65">
              <Link href="/login" className="transition hover:text-[#ddb159]">
                Already have an account? Log in
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/45 p-3 text-center text-[11px] font-semibold leading-relaxed text-[#faf6f0]/45">
          Exclusive access to AI-ranked S&amp;P 500 intelligence, portfolio
          construction and market insights.
        </div>
      </section>
    </main>
  );
}
