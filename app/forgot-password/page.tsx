"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/30 bg-[#FFFDF5] p-8 text-[#0F2A1F] shadow-2xl">
        <div className="relative mb-4 h-12 w-44">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            className="object-contain object-left"
          />
        </div>

        <h1 className="text-3xl font-bold">Reset your password</h1>

        <p className="mt-2 text-slate-600">
          Enter your email and we’ll send a secure reset link if the account exists.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-700">
            {message}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              className="w-full rounded-xl border p-3"
              type="email"
              placeholder="Email address"
              value={email}
              maxLength={254}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resetPassword()}
            />

            {message && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {message}
              </div>
            )}

            <button
              onClick={resetPassword}
              disabled={loading}
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <Link href="/login" className="block text-center text-sm underline">
              Back to login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
