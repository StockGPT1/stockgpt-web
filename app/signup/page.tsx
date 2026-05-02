"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
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
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/30 bg-[#FFFDF5] p-8 text-[#0F2A1F] shadow-2xl">
        <div className="relative mb-4 h-12 w-44"><Image src="/logo.png" alt="StockGPT" fill className="object-contain object-left" /></div>
        <h1 className="text-3xl font-bold">Create your StockGPT account</h1>

        {sent ? (
          <p className="mt-6 text-green-700">
            Check your email to verify your account.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <input className="w-full rounded-xl border p-3" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="w-full rounded-xl border p-3" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            <input className="w-full rounded-xl border p-3" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="w-full rounded-xl border p-3" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full rounded-xl border p-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {errorMessage && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>}

            <button
              onClick={signUp}
              disabled={loading}
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold"
            >
              {loading ? "Creating..." : "Create account"}
            </button>

            <a href="/login" className="block text-center text-sm underline">
              Already have an account? Log in
            </a>
          </div>
        )}
      </div>
    </main>
  );
}