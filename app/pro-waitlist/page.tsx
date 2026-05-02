"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

export default function ProWaitlistPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit() {
    setErrorMessage("");

    if (!name || !email) {
      setErrorMessage("Please enter both name and email.");
      return;
    }

    const { error } = await createClient().from("pro_waitlist").insert({
      name,
      email,
    });

    if (error) {
      setErrorMessage("Something went wrong. Try again.");
      return;
    }

    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F2A1F] p-8 text-white">
      <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/30 bg-[#FFFDF5] p-8 text-[#0F2A1F] shadow-2xl">
        <div className="relative mb-4 h-12 w-44"><Image src="/logo.png" alt="StockGPT" fill className="object-contain object-left" /></div>
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
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="mt-4 w-full rounded-xl border p-3"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {errorMessage && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

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