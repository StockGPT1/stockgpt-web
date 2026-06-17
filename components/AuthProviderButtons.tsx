"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type AuthProvider = "google";

const PROVIDERS: Array<{
  id: AuthProvider;
  label: string;
}> = [
  { id: "google", label: "Continue with Google" },
];

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.29h6.47c-.28 1.5-1.13 2.77-2.4 3.62v2.96h3.89c2.27-2.09 3.53-5.16 3.53-8.6Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-2.96c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.27v3.05A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.34A7.2 7.2 0 0 1 4.91 12c0-.81.14-1.6.38-2.34V6.61H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.02-3.05Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.72c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.96 1.14 15.24 0 12 0A11.99 11.99 0 0 0 1.27 6.61l4.02 3.05C6.23 6.83 8.88 4.72 12 4.72Z"
      />
    </svg>
  );
}

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
      onError(`Could not continue with Google. ${error.message}`);
    }
  }

  return (
    <div className="grid w-full min-w-0 gap-2">
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
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-[#ddb159]/18 bg-[#faf6f0] px-3 text-[13px] font-black text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-[14px]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_5px_rgba(0,0,0,0.12)]">
              <GoogleLogo />
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
