"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProWaitlistPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (!email) return;

    const { error } = await supabase.from("pro_waitlist").insert({ email });

    if (error) {
      alert(error.message);
      return;
    }

    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F2A1F] p-8 text-white">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-[#0F2A1F]">
        <h1 className="text-3xl font-bold">Join the Pro waitlist</h1>

        <p className="mt-3 text-slate-600">
          Be first to access advanced StockGPT features when Pro launches.
        </p>

        {done ? (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-700">
            You’re on the waitlist.
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
              onClick={submit}
              className="mt-4 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold"
            >
              Join waitlist
            </button>
          </>
        )}
      </div>
    </main>
  );
}