"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  AuthMessage,
  AuthScaffold,
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthScaffold";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword() {
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await createClient().auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage("Could not update password. Please request a new reset link.");
        return;
      }

      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="Account recovery"
      title="Choose a new password."
      subtitle="Pick something strong — you'll use it to sign in from now on."
      footer={
        <p className="text-center text-[13px] font-semibold text-white/60">
          All set?{" "}
          <Link href="/login" className={authInlineLinkClass}>
            Back to log in
          </Link>
        </p>
      }
    >
      {done ? (
        <AuthMessage tone="success">
          Password updated successfully. You can now log in with your new password.
        </AuthMessage>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className={authLabelClass}>New password</span>
            <input
              className={authInputClass}
              type="password"
              placeholder="Enter a new password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updatePassword()}
            />
          </label>

          {errorMessage && <AuthMessage tone="error">{errorMessage}</AuthMessage>}

          <button onClick={updatePassword} disabled={loading} className={authPrimaryButtonClass}>
            {loading ? "Updating..." : "Update password"}
          </button>
        </div>
      )}
    </AuthScaffold>
  );
}
