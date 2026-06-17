"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type AuthProvider = "google" | "apple";

const PROVIDERS: Array<{
  id: AuthProvider;
  label: string;
  icon: string;
}> = [
  { id: "google", label: "Continue with Google", icon: "G" },
  { id: "apple", label: "Continue with Apple", icon: "" },
];

export function AuthProviderButtons({
  onError,
  redirectTo = "/dashboard",
}: {
  onError: (message: string) => void;
  redirectTo?: string;
}) {
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);

  async function continueWithProvider(provider: AuthProvider) {
    if (loadingProvider) return;

    setLoadingProvider(provider);
    onError("");

    const origin = window.location.origin;
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setLoadingProvider(null);
      onError(
        `Could not continue with ${provider === "google" ? "Google" : "Apple"}. ${error.message}`,
      );
    }
  }

  return (
    <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2">
      {PROVIDERS.map((provider) => {
        const isLoading = loadingProvider === provider.id;
        const disabled = Boolean(loadingProvider);

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => continueWithProvider(provider.id)}
            disabled={disabled}
            aria-label={provider.label}
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-[#ddb159]/18 bg-[#faf6f0] px-3 text-[13px] font-black text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#072116]/10 bg-white text-[12px] font-black text-[#072116]">
              {provider.icon}
            </span>
            <span className="truncate">
              {isLoading ? "Opening..." : provider.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
