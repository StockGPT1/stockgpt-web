"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { trackClientEvent } from "@/lib/analytics/client-events";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";
import {
  AuthMessage,
  AuthScaffold,
  authGhostButtonClass,
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthScaffold";

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
      className="flex w-full items-start gap-2.5 rounded-xl border border-white/10 bg-[#071b11] px-3 py-2.5 text-left transition focus-within:border-[#ddb159]/60 hover:border-[#ddb159]/32"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        required={required}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#ddb159]"
      />

      <span className="text-[10.5px] font-semibold leading-relaxed text-white/62">
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
      /* supabase-js loads on demand so it stays out of the first paint */
      const { createClient } = await import("@/utils/supabase/client");
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
      const { createClient } = await import("@/utils/supabase/client");
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

  return (
    <AuthScaffold
      eyebrow="Private access"
      title={sent ? "Check your email." : "Create your account."}
      subtitle={
        sent ? (
          <>
            If this email is eligible, we sent a verification code to{" "}
            <span className="font-black text-[#faf6f0]">{email}</span>. Check your inbox
            and junk folder.
          </>
        ) : (
          "Free to create — explore the dashboard, subscribe inside when ready. Available to users aged 18 or over."
        )
      }
      footer={
        !sent && (
          <p className="text-center text-[13px] font-semibold text-white/60">
            Already have an account?{" "}
            <Link href="/login" className={authInlineLinkClass}>
              Log in
            </Link>
          </p>
        )
      }
    >
      {sent ? (
        <div className="space-y-4">
          <label className="block min-w-0">
            <span className={authLabelClass}>Verification code</span>
            <input
              className="block h-14 w-full min-w-0 rounded-xl border border-white/10 bg-[#071b11] px-4 text-center text-[22px] font-black tracking-[0.35em] text-[#faf6f0] outline-none transition placeholder:text-white/15 focus:border-[#ddb159]/80 focus:ring-2 focus:ring-[#ddb159]/25 sm:tracking-[0.45em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="00000000"
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
            />
          </label>

          {message && <AuthMessage tone={messageTone}>{message}</AuthMessage>}

          <button
            onClick={verifyCode}
            disabled={loading || !isCodeLengthValid}
            className={authPrimaryButtonClass}
          >
            {loading ? "Checking..." : "Verify email"}
          </button>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={resendCode}
              disabled={resending || resendCooldown > 0}
              className={authGhostButtonClass}
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
              className={authGhostButtonClass}
            >
              Change details
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {offerSaved && (
            <AuthMessage tone="info">
              Offer saved: 50% off your first month after your free trial.
            </AuthMessage>
          )}

          <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={authLabelClass}>First name</span>
              <input
                className={authInputClass}
                placeholder="First name"
                value={firstName}
                maxLength={60}
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>

            <label className="block min-w-0">
              <span className={authLabelClass}>Last name</span>
              <input
                className={authInputClass}
                placeholder="Last name"
                value={lastName}
                maxLength={60}
                autoComplete="family-name"
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>

          <label className="block min-w-0">
            <span className={authLabelClass}>Date of birth</span>
            <input
              className={`${authInputClass} appearance-none`}
              type="date"
              value={dob}
              autoComplete="bday"
              onChange={(e) => setDob(e.target.value)}
            />
          </label>

          <label className="block min-w-0">
            <span className={authLabelClass}>Email</span>
            <input
              className={authInputClass}
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
            <span className={authLabelClass}>Password</span>
            <input
              className={authInputClass}
              type="password"
              placeholder="Minimum 12 characters"
              value={password}
              minLength={12}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signUp()}
            />
          </label>

          <div className="grid gap-2">
            <ConsentCheckbox id="marketing-consent" checked={marketingConsent} onChange={setMarketingConsent}>
              Marketing consent — I agree to receive occasional StockGPT product updates, offers and launch announcements.
            </ConsentCheckbox>

            <ConsentCheckbox id="email-consent" checked={emailConsent} onChange={setEmailConsent} required>
              Email consent — I agree to receive important account, security and subscription emails needed to use StockGPT.
            </ConsentCheckbox>

            <ConsentCheckbox id="terms-accepted" checked={termsAccepted} onChange={setTermsAccepted} required>
              Terms and conditions — I confirm I am 18 or over and agree to the{" "}
              <Link href="/legal#terms" className="font-black !text-[#ddb159] !underline !decoration-[#ddb159]/45 underline-offset-2 hover:!decoration-[#ddb159]">Terms</Link>,{" "}
              <Link href="/legal#privacy" className="font-black !text-[#ddb159] !underline !decoration-[#ddb159]/45 underline-offset-2 hover:!decoration-[#ddb159]">Privacy Policy</Link>{" "}
              and research-only disclaimer.
            </ConsentCheckbox>

            <ConsentCheckbox id="newsletter-digest-consent" checked={newsletterDigestConsent} onChange={setNewsletterDigestConsent}>
              Newsletter digest consent — I would like to receive StockGPT market digest emails and research summaries.
            </ConsentCheckbox>
          </div>

          {message && <AuthMessage tone={messageTone}>{message}</AuthMessage>}

          <button onClick={signUp} disabled={loading} className={authPrimaryButtonClass}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </div>
      )}
    </AuthScaffold>
  );
}
