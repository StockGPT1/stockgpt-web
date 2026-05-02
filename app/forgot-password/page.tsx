"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function resetPassword() {
    setErrorMessage("");

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: "https://stockgpt.pro/update-password",
    });

    if (error) {
      setErrorMessage("Could not send reset email. Please try again.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-[#0F2A1F]">
        <img src="/logo.png" alt="StockGPT" className="mb-4 h-10 w-10 rounded" />
        <h1 className="text-3xl font-bold">Reset your password</h1>

        <p className="mt-2 text-slate-600">
          Enter your email and we’ll send you a secure reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-700">
            Check your email for the password reset link.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              className="w-full rounded-xl border p-3"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              onClick={resetPassword}
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold"
            >
              Send reset link
            </button>

            <a href="/login" className="block text-center text-sm underline">
              Back to login
            </a>
          </div>
        )}
      </div>
    </main>
  );
}