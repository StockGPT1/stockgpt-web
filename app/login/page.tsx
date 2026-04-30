"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/account";
  }

  return (
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-[#0F2A1F]">
        <h1 className="text-3xl font-bold">Log in to StockGPT</h1>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            type="email"
            placeholder="Email / username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-xl border p-3"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={login}
            className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold"
          >
            Log in
          </button>

          <a href="/signup" className="block text-center text-sm underline">
            Create an account
          </a>
        </div>
      </div>
    </main>
  );
}