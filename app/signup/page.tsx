"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { trackClientEvent } from "@/lib/analytics/client-events";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";

const LAUNCH_COUPON = "50PORTFOLIO2026";
const SAVED_COUPON_KEY = "stockgpt.savedCoupon";

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
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex w-full items-start gap-2.5 rounded-xl border border-[#ddb159]/14 bg-[#04180f]/52 px-3 py-2 text-left transition focus-within:border-[#ddb159]/55 hover:border-[#ddb159]/32 lg:py-1.5"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        required={required}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#ddb159]"
      />

      <span className="text-[10.5px] font-semibold leading-relaxed text-[#faf6f0]/70 sm:text-[11px]">
        {children}
      </span>
    </label>
  );
}

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [marketingConsent, setMarketingConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [newsletterDigestConsent, setNewsletterDigestConsent] = useState(false);

  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [offerSaved, setOfferSaved] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const coupon = new URLSearchParams(window.location.search).get("coupon");
      const savedCoupon = localStorage.getItem(SAVED_COUPON_KEY);

      if (coupon === LAUNCH_COUPON) {
        localStorage.setItem(SAVED_COUPON_KEY, LAUNCH_COUPON);
        localStorage.setItem("stockgpt.savedCouponAt", String(Date.now()));
      }

      // TODO: Pass this saved code into Stripe Checkout once the checkout route
      // supports safe, server-validated automatic promotion-code application.
      setOfferSaved(coupon === LAUNCH_COUPON || savedCoupon === LAUNCH_COUPON);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timeout = window.setTimeout(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendCooldown]);

  const isCodeLengthValid = code.length >= 6 && code.length <= 8;

  async function signUp() {
    if (loading) return;

    const next = normaliseInternalRedirect(
      new URLSearchParams(window.location.search).get("next"),
    );

    trackClientEvent("signup_started", { coupon_saved: offerSaved });
    setLoading(true);
    setMessage("");
    setMessageTone("info");

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
          email,
          password,
          marketingConsent,
          emailConsent,
          termsAccepted,
          newsletterDigestConsent,
          next,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error ?? "Could not create account. Please check your details.");
        return;
      }

      setSent(true);
      setCode("");
      setResendCooldown(60);
      setMessageTone("info");
      setMessage(data?.message ?? "If this email is eligible, enter the verification code from your email.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (loading || !isCodeLengthValid) return;

    setLoading(true);
    setMessage("");
    setMessageTone("info");

    try {
      const { error } = await createClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });

      if (error) {
        setMessageTone("error");
        setMessage("That code is invalid or expired. Check it, or request a new one.");
        return;
      }

      setMessageTone("success");
      setMessage("Email verified. Taking you to StockGPT...");
      window.location.href = normaliseInternalRedirect(
        new URLSearchParams(window.location.search).get("next"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (resending || resendCooldown > 0) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessageTone("error");
      setMessage("Enter your email again before requesting a new code.");
      return;
    }

    setResending(true);
    setMessage("");
    setMessageTone("info");

    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            normaliseInternalRedirect(
              new URLSearchParams(window.location.search).get("next"),
            ),
          )}`,
        },
      });

      if (error) {
        setMessageTone("error");
        setMessage("Could not resend the code yet. Please wait a moment and try again.");
        return;
      }

      setMessageTone("info");
      setMessage("We sent a new verification code. Please check your inbox and junk folder.");
      setResendCooldown(60);
    } finally {
      setResending(false);
    }
  }

  const messageClasses =
    messageTone === "error"
      ? "rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-[12px] font-bold text-red-200 sm:text-[13px]"
      : messageTone === "success"
        ? "rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-[12px] font-bold text-emerald-100 sm:text-[13px]"
        : "rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/10 p-3 text-[12px] font-bold text-[#f6e7bf] sm:text-[13px]";

  return (
    <main className="relative flex min-h-[100svh] w-full items-start justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#0F2A1F] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[#faf6f0] [-webkit-overflow-scrolling:touch] sm:min-h-dvh sm:px-6 sm:py-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(221,177,89,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_50%_95%,rgba(221,177,89,0.10),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.045)_0_1px,transparent_1px_42px)] opacity-30" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/10" />
        <div className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/5" />
      </div>

      <section className="relative mx-auto my-auto w-full max-w-[29rem] overflow-hidden rounded-[1.75rem] border border-[#ddb159]/28 bg-[#082519]/82 p-4 text-[#faf6f0] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:max-w-[64rem] lg:p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ddb159]/70 to-transparent" />

        <div className="relative grid min-w-0 gap-4 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <div className="relative mx-auto mb-3 h-9 w-40 sm:mx-0 sm:h-10 sm:w-44 lg:mb-4 lg:h-11 lg:w-48">
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

              <h1 className="mt-1.5 text-[26px] font-black leading-none tracking-[-0.04em] sm:text-[30px] lg:text-[40px]">
                Create your account.
              </h1>

              <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62 lg:max-w-[22rem] lg:text-[13px]">
                StockGPT is available to users aged 18 or over. Your details are validated securely before account creation.
              </p>
            </div>

            <div className="mt-4 hidden rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/45 p-3 text-[11px] font-semibold leading-relaxed text-[#faf6f0]/48 lg:block">
              AI-ranked S&amp;P 500 intelligence, portfolio construction and market research tools in one workspace.
            </div>
          </div>

          <div className="min-w-0">
            {offerSaved && !sent && (
              <div className="mb-3 rounded-2xl border border-[#ddb159]/25 bg-[#ddb159]/10 px-4 py-3 text-[11px] font-bold leading-5 text-[#f6e7bf]">
                Offer saved: 50% off your first month after your free trial.
              </div>
            )}

            {sent ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/55 p-4 text-center sm:text-left">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
                    Email verification
                  </p>
                  <h2 className="mt-1.5 text-[24px] font-black leading-none tracking-[-0.04em] sm:text-[28px]">
                    Enter your verification code.
                  </h2>
                  <p className="mt-2 break-words text-[12px] font-semibold leading-relaxed text-[#faf6f0]/62 sm:text-[13px]">
                    If this email is eligible, we sent a code to <span className="text-[#faf6f0]">{email}</span>. Check your inbox and junk folder.
                  </p>
                </div>

                <label className="block min-w-0">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                    Verification code
                  </span>
                  <input
                    className="block h-12 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-center text-[20px] font-black tracking-[0.32em] text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/18 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:text-[22px] sm:tracking-[0.45em]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="00000000"
                    value={code}
                    maxLength={8}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                  />
                </label>

                {message && <div className={messageClasses}>{message}</div>}

                <button
                  onClick={verifyCode}
                  disabled={loading || !isCodeLengthValid}
                  className="h-10 w-full rounded-full bg-[#ddb159] px-4 text-[14px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.22)] transition hover:brightness-105 disabled:opacity-60 lg:h-11"
                >
                  {loading ? "Checking..." : "Verify email"}
                </button>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={resending || resendCooldown > 0}
                    className="h-10 rounded-full border border-[#ddb159]/22 bg-[#04180f]/65 px-4 text-[12px] font-black text-[#faf6f0] transition hover:border-[#ddb159]/55 disabled:opacity-55"
                  >
                    {resending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setCode("");
                      setMessage("");
                      setMessageTone("info");
                    }}
                    className="h-10 rounded-full border border-[#ddb159]/22 bg-[#04180f]/65 px-4 text-[12px] font-black text-[#faf6f0] transition hover:border-[#ddb159]/55"
                  >
                    Change details
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 lg:space-y-2">
                <div className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2 lg:gap-2">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                      First name
                    </span>
                    <input
                      className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] lg:h-9"
                      placeholder="First name"
                      value={firstName}
                      maxLength={60}
                      autoComplete="given-name"
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                      Last name
                    </span>
                    <input
                      className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] lg:h-9"
                      placeholder="Last name"
                      value={lastName}
                      maxLength={60}
                      autoComplete="family-name"
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </label>
                </div>

                <label className="block min-w-0">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                    Date of birth
                  </span>
                  <input
                    className="block h-10 w-full min-w-0 appearance-none rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-3 text-[13px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] sm:px-4 sm:text-[14px] lg:h-9"
                    type="date"
                    value={dob}
                    autoComplete="bday"
                    onChange={(e) => setDob(e.target.value)}
                  />
                </label>

                <div className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2 lg:gap-2">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                      Email
                    </span>
                    <input
                      className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] lg:h-9"
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
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/85 sm:text-[10px]">
                      Password
                    </span>
                    <input
                      className="block h-10 w-full min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/75 px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/70 focus:bg-[#04180f] lg:h-9"
                      type="password"
                      placeholder="Minimum 12 characters"
                      value={password}
                      minLength={12}
                      autoComplete="new-password"
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && signUp()}
                    />
                  </label>
                </div>

                <div className="grid gap-2 lg:grid-cols-2">
                  <ConsentCheckbox id="marketing-consent" checked={marketingConsent} onChange={setMarketingConsent}>
                    Marketing consent — I agree to receive occasional StockGPT product updates, offers and launch announcements.
                  </ConsentCheckbox>

                  <ConsentCheckbox id="email-consent" checked={emailConsent} onChange={setEmailConsent} required>
                    Email consent — I agree to receive important account, security and subscription emails needed to use StockGPT.
                  </ConsentCheckbox>

                  <ConsentCheckbox id="terms-accepted" checked={termsAccepted} onChange={setTermsAccepted} required>
                    Terms and conditions — I confirm I am 18 or over and agree to the{" "}
                    <Link href="/legal#terms" className="font-black text-[#ddb159] underline-offset-4 hover:underline">Terms</Link>,{" "}
                    <Link href="/legal#privacy" className="font-black text-[#ddb159] underline-offset-4 hover:underline">Privacy Policy</Link>{" "}
                    and research-only disclaimer.
                  </ConsentCheckbox>

                  <ConsentCheckbox id="newsletter-digest-consent" checked={newsletterDigestConsent} onChange={setNewsletterDigestConsent}>
                    Newsletter digest consent — I would like to receive StockGPT market digest emails and research summaries.
                  </ConsentCheckbox>
                </div>

                {message && <div className={messageClasses}>{message}</div>}

                <button
                  onClick={signUp}
                  disabled={loading}
                  className="h-10 w-full rounded-full bg-[#ddb159] px-4 text-[14px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.22)] transition hover:brightness-105 disabled:opacity-60 lg:h-11"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>

                <div className="text-center text-[12px] font-semibold text-[#faf6f0]/65 sm:text-[13px]">
                  <Link href="/login" className="transition hover:text-[#ddb159]">
                    Already have an account? Log in
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/45 p-3 text-center text-[10px] font-semibold leading-relaxed text-[#faf6f0]/45 sm:text-[11px] lg:hidden">
              Exclusive access to AI-ranked S&amp;P 500 intelligence, portfolio construction and market insights.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
