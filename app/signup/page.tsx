"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

function ConsentCheckbox({
  id,
  checked,
  onChange,
  required = false,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex w-full items-start gap-3 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/52 px-3 py-2.5 text-left transition focus-within:border-[#ddb159]/55 hover:border-[#ddb159]/32"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        required={required}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#ddb159]"
      />
      <span className="text-[11px] font-semibold leading-relaxed text-[#faf6f0]/70 sm:text-[12px]">
        {children}
      </span>
    </label>
  );
}

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [marketingConsent, setMarketingConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [newsletterDigestConsent, setNewsletterDigestConsent] = useState(false);

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function signUp() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          dob,
          phone,
          email,
          password,
          marketingConsent,
          emailConsent,
          termsAccepted,
          newsletterDigestConsent,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(data?.error ?? "Could not create account. Please check your details.");
        return;
      }

      setSent(true);
      setMessage(data?.message ?? "Check your email to verify your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-[#0F2A1F] px-4 py-5 text-[#faf6f0] sm:h-dvh sm:items-center sm:overflow-hidden sm:px-6 sm:py-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(221,177,89,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_50%_95%,rgba(221,177,89,0.10),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.045)_0_1px,transparent_1px_42px)] opacity-30" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/10" />
        <div className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/5" />
      </div>

      <section className="relative w-full max-w-[27rem] overflow-hidden rounded-[1.75rem] border border-[#ddb159]/28 bg-[#082519]/82 p-4 text-[#faf6f0] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:max-w-[29rem] sm:p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ddb159]/70 to-transparent" />

        <div className="relative mx-auto mb-3 h-10 w-40 sm:mx-0 sm:mb-3 sm:h-10 sm:w-44">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain"
          />
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
            Private access
          </p>

          <h1 className="mt-1.5 text-[27px] font-black leading-none tracking-[-0.04em] sm:text-[32px]">
            Create your account.
          </h1>

          <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62">
            StockGPT is available to users aged 18 or over. Your details are
            validated securely before account creation.
          </p>
        </div>

        {sent ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-center text-[13px] font-bold leading-relaxed text-emerald-100 sm:text-left">
            {message || "Check your email to verify your account."}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                  First name
                </span>
                <input
                  className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f]"
                  placeholder="First name"
                  value={firstName}
                  maxLength={60}
                  autoComplete="given-name"
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                  Last name
                </span>
                <input
                  className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f]"
                  placeholder="Last name"
                  value={lastName}
                  maxLength={60}
                  autoComplete="family-name"
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>

            <div className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                  Date of birth
                </span>
                <input
                  className="block h-10 w-full min-w-0 appearance-none rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-3 text-[13px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:px-4 sm:text-[14px]"
                  type="date"
                  value={dob}
                  autoComplete="bday"
                  onChange={(e) => setDob(e.target.value)}
                />
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                  Phone
                </span>
                <input
                  className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f]"
                  placeholder="Optional"
                  value={phone}
                  maxLength={25}
                  autoComplete="tel"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>

            <label className="block min-w-0">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                Email
              </span>
              <input
                className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f]"
                type="email"
                placeholder="you@example.com"
                value={email}
                maxLength={254}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signUp()}
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                Password
              </span>
              <input
                className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f]"
                type="password"
                placeholder="Minimum 12 characters"
                value={password}
                minLength={12}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signUp()}
              />
            </label>

            <div className="space-y-2">
              <ConsentCheckbox
                id="marketing-consent"
                checked={marketingConsent}
                onChange={setMarketingConsent}
              >
                Marketing consent — I agree to receive occasional StockGPT product
                updates, offers and launch announcements.
              </ConsentCheckbox>

              <ConsentCheckbox
                id="email-consent"
                checked={emailConsent}
                onChange={setEmailConsent}
                required
              >
                Email consent — I agree to receive important account, security and
                subscription emails needed to use StockGPT.
              </ConsentCheckbox>

              <ConsentCheckbox
                id="terms-accepted"
                checked={termsAccepted}
                onChange={setTermsAccepted}
                required
              >
                Terms and conditions — I confirm I am 18 or over and agree to the{" "}
                <Link href="/legal#terms" className="font-black text-[#ddb159] underline-offset-4 hover:underline">
                  Terms
                </Link>
                ,{" "}
                <Link href="/legal#privacy" className="font-black text-[#ddb159] underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>{" "}
                and research-only disclaimer.
              </ConsentCheckbox>

              <ConsentCheckbox
                id="newsletter-digest-consent"
                checked={newsletterDigestConsent}
                onChange={setNewsletterDigestConsent}
              >
                Newsletter digest consent — I would like to receive StockGPT market
                digest emails and research summaries.
              </ConsentCheckbox>
            </div>

            {message && (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-[12px] font-bold text-red-200 sm:text-[13px]">
                {message}
              </div>
            )}

            <button
              onClick={signUp}
              disabled={loading}
              className="mt-1 h-11 w-full rounded-full bg-[#ddb159] px-4 text-[14px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.22)] transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create account"}
            </button>

            <div className="pt-1 text-center text-[12px] font-semibold text-[#faf6f0]/65 sm:text-[13px]">
              <Link href="/login" className="transition hover:text-[#ddb159]">
                Already have an account? Log in
              </Link>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/45 p-3 text-center text-[10px] font-semibold leading-relaxed text-[#faf6f0]/45 sm:text-[11px]">
          Exclusive access to AI-ranked S&amp;P 500 intelligence, portfolio
          construction and market insights.
        </div>
      </section>
    </main>
  );
}
