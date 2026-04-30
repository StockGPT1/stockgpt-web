"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function updatePassword() {
    setErrorMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMessage("Could not update password. Please request a new reset link.");
      return;
    }

    setDone(true);
  }

  return (
    <main className="min-h-screen bg-[#0F2A1F] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-[#0F2A1F]">
        <h1 className="text-3xl font-bold">Choose a new password</h1>

        {done ? (
          <div className="mt-6">
            <div className="rounded-xl bg-green-50 p-4 text-green-700">
              Password updated successfully.
            </div>
            <a href="/login" className="mt-4 block text-center underline">
              Log in
            </a>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              className="w-full rounded-xl border p-3"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              onClick={updatePassword}
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-bold"
            >
              Update password
            </button>
          </div>
        )}
      </div>
    </main>
  );
}