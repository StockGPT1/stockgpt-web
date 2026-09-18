"use client";

import { useState, type ReactNode } from "react";

type AuthProvider = "apple" | "google";
type AuthMode = "login" | "signup";

function AppleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" focusable="false">
      <path
        fill="currentColor"
        d="M17.05 12.54c-.02-2.14 1.75-3.18 1.83-3.23-1-.97-2.56-1.1-3.11-1.11-1.31-.14-2.59.79-3.25.79-.67 0-1.68-.77-2.77-.75-1.41.02-2.73.84-3.45 2.11-1.51 2.62-.38 6.48 1.06 8.6.72 1.03 1.56 2.19 2.65 2.15 1.07-.04 1.47-.69 2.76-.69 1.28 0 1.66.69 2.78.66 1.15-.02 1.87-1.03 2.56-2.07.84-1.18 1.18-2.35 1.19-2.41-.03-.01-2.23-.86-2.25-4.05ZM14.91 6.82c.58-.73.98-1.73.87-2.74-.84.04-1.9.59-2.5 1.3-.53.62-1 1.63-.87 2.6.95.07 1.91-.48 2.5-1.16Z"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.29h6.47c-.28 1.5-1.13 2.77-2.4 3.62v2.96h3.89c2.27-2.09 3.53-5.16 3.53-8.6Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-2.96c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.27v3.05A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.34A7.2 7.2 0 0 1 4.91 12c0-.81.14-1.6.38-2.34V6.61H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.02-3.05Z" />
      <path fill="#EA4335" d="M12 4.72c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.96 1.14 15.24 0 12 0A11.99 11.99 0 0 0 1.27 6.61l4.02 3.05C6.23 6.83 8.88 4.72 12 4.72Z" />
    </svg>
  );
}

export function AuthProviderButtons({
  onError,
  redirectTo = "/dashboard",
  mode = "login",
}: {
  onError: (message: string) => void;
  redirectTo?: string;
  mode?: AuthMode;
}) {
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);

  async function continueWithProvider(provider: AuthProvider) {
    if (loadingProvider) return;

    setLoadingProvider(provider);
    onError("");

    try {
      /* supabase-js is only needed once the user actually clicks, keeping
         it out of the auth pages' initial bundle. */
      const { createClient } = await import("@/utils/supabase/client");
      const origin = window.location.origin;
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const safeRedirectTo =
        requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
          ? requestedNext
          : redirectTo;
      const callback = `${origin}/auth/callback?next=${encodeURIComponent(safeRedirectTo)}${mode === "signup" ? "&signup=1" : ""}`;

      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback },
      });

      if (error) throw error;
    } catch (error) {
      setLoadingProvider(null);
      const providerName = provider === "apple" ? "Apple" : "Google";
      const message = error instanceof Error ? error.message : "Please try again.";
      onError(`Could not continue with ${providerName}. ${message}`);
    }
  }

  const providers: Array<{
    id: AuthProvider;
    label: string;
    icon: ReactNode;
    className: string;
  }> = [
    {
      id: "apple",
      label: mode === "signup" ? "Sign up with Apple" : "Continue with Apple",
      icon: <AppleLogo />,
      className: "border-white bg-white text-black hover:bg-white/92",
    },
    {
      id: "google",
      label: mode === "signup" ? "Sign up with Google" : "Continue with Google",
      icon: <GoogleLogo />,
      className: "border-[#ddb159]/18 bg-[#faf6f0] text-[#072116] hover:bg-white",
    },
  ];

  return (
    /* OAuth provider buttons are web-only on main. The native iOS branch
       supplies native Apple/Google authentication inside the app shell. */
    <div className="sg-web-only grid w-full min-w-0 gap-2.5">
      {providers.map((provider) => {
        const isLoading = loadingProvider === provider.id;
        const disabled = Boolean(loadingProvider);

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => continueWithProvider(provider.id)}
            disabled={disabled}
            aria-label={provider.label}
            className={`flex h-[52px] min-w-0 items-center justify-center gap-2.5 rounded-2xl border px-4 text-[14px] font-black shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition active:scale-[0.985] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${provider.className}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {provider.icon}
            </span>
            <span className="truncate">
              {isLoading ? "Opening securely..." : provider.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
