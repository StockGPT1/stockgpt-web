"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signIn() {
  setLoading(true);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "https://stockgpt.pro/auth/callback?next=/account",
    },
  });

  setLoading(false);

  if (error) {
    alert(error.message);
    return;
  }

  setSent(true);
}

  return (
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-[#0F2A1F] shadow-xl">
        <h1 className="text-3xl font-bold">Log in to StockGPT</h1>

        <p className="mt-2 text-slate-600">
          Enter your email and we’ll send you a secure login link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-800">
            Check your email for the login link.
          </div>
        ) : (
          <>
            <input
              className="mt-6 w-full rounded-xl border p-3"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              onClick={signIn}
              disabled={loading || !email}
              className="mt-4 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send login link"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}