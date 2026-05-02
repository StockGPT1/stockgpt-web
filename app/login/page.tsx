"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setErrorMessage("");

    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage("Incorrect email or password.");
      return;
    }

    window.location.href = "/account";
  }

  return (
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-[#0F2A1F]">
        <img src="/logo.png" alt="StockGPT" className="mb-4 h-10 w-10 rounded" />
        <h1 className="text-3xl font-bold">Log in to StockGPT</h1>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />

          <input
            className="w-full rounded-xl border p-3"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />

          {errorMessage && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            onClick={login}
            disabled={loading}
            className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <a
            href="/forgot-password"
            className="block text-center text-sm underline"
          >
            Forgotten password?
          </a>

          <a href="/signup" className="block text-center text-sm underline">
            Create an account
          </a>
        </div>
      </div>
    </main>
  );
}