"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isStockGPTIOSApp, requestNativeAuthentication } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";
const FACE_ID_OFFER_KEY = "stockgpt:faceid-offer-pending";
const BACKGROUND_LOCK_AFTER_MS = 30_000;

type BiometricResult = {
  success?: boolean;
  available?: boolean;
  message?: string;
};

type AuthPurpose = "unlock" | "offer" | null;

export function IOSAppLock() {
  const pathname = usePathname();
  const [isApp, setIsApp] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [message, setMessage] = useState("");
  const backgroundedAt = useRef<number | null>(null);
  const authPurpose = useRef<AuthPurpose>(null);

  const authenticate = useCallback(() => {
    authPurpose.current = "unlock";
    setAuthenticating(true);
    setMessage("");
    const started = requestNativeAuthentication(
      "Unlock StockGPT to view your portfolio, watchlist and account.",
    );
    if (!started) {
      authPurpose.current = null;
      setAuthenticating(false);
      setMessage("Face ID could not start. Reopen StockGPT and try again.");
    }
  }, []);

  const enableWithBiometrics = useCallback(() => {
    authPurpose.current = "offer";
    setAuthenticating(true);
    setMessage("");
    const started = requestNativeAuthentication(
      "Use Face ID to unlock StockGPT when you reopen the app.",
    );
    if (!started) {
      authPurpose.current = null;
      setAuthenticating(false);
      setMessage("Face ID could not start. You can enable it later in Settings.");
    }
  }, []);

  useEffect(() => {
    const app = isStockGPTIOSApp();
    setIsApp(app);
    if (!app) return;

    const storedEnabled = window.localStorage.getItem(FACE_ID_KEY) === "true";
    setEnabled(storedEnabled);
    if (storedEnabled) {
      setLocked(true);
      window.setTimeout(authenticate, 220);
    }
  }, [authenticate]);

  useEffect(() => {
    if (!isApp || enabled) {
      setShowOffer(false);
      return;
    }

    const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/");
    const pending = window.localStorage.getItem(FACE_ID_OFFER_KEY) === "true";

    if (!isAuthPage && pending) {
      const timeout = window.setTimeout(() => setShowOffer(true), 450);
      return () => window.clearTimeout(timeout);
    }

    setShowOffer(false);
  }, [enabled, isApp, pathname]);

  useEffect(() => {
    if (!isApp) return;

    function onBiometricResult(event: Event) {
      const result = (event as CustomEvent<BiometricResult>).detail ?? {};
      const purpose = authPurpose.current;
      authPurpose.current = null;
      setAuthenticating(false);

      if (purpose === "offer") {
        if (result.success) {
          window.localStorage.setItem(FACE_ID_KEY, "true");
          window.localStorage.removeItem(FACE_ID_OFFER_KEY);
          setEnabled(true);
          setShowOffer(false);
          setMessage("");
          window.dispatchEvent(new CustomEvent("stockgpt:faceid-setting", { detail: { enabled: true } }));
          return;
        }

        setMessage(
          result.available === false
            ? "Face ID is not available on this iPhone. You can continue without it."
            : result.message || "Face ID was not enabled. You can try again or do it later in Settings.",
        );
        return;
      }

      if (result.success) {
        setLocked(false);
        setMessage("");
        return;
      }

      if (result.available === false) {
        setMessage("Face ID or Touch ID is not available on this iPhone right now.");
        return;
      }

      setMessage(result.message || "Authentication was not completed.");
    }

    function onSetting(event: Event) {
      const nextEnabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled);
      setEnabled(nextEnabled);
      if (!nextEnabled) {
        setLocked(false);
        setMessage("");
      }
    }

    window.addEventListener("stockgpt:biometric-result", onBiometricResult);
    window.addEventListener("stockgpt:faceid-setting", onSetting);
    return () => {
      window.removeEventListener("stockgpt:biometric-result", onBiometricResult);
      window.removeEventListener("stockgpt:faceid-setting", onSetting);
    };
  }, [isApp]);

  useEffect(() => {
    if (!isApp) return;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        backgroundedAt.current = Date.now();
        return;
      }

      if (
        document.visibilityState === "visible" &&
        enabled &&
        backgroundedAt.current != null &&
        Date.now() - backgroundedAt.current >= BACKGROUND_LOCK_AFTER_MS
      ) {
        setLocked(true);
        window.setTimeout(authenticate, 120);
      }
      backgroundedAt.current = null;
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [authenticate, enabled, isApp]);

  if (!isApp) return null;

  if (showOffer && !enabled) {
    return (
      <div className="fixed inset-0 z-[225] flex items-end justify-center bg-black/55 px-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[8px]">
        <div className="w-full max-w-[430px] rounded-[30px] border border-white/10 bg-[#f7f5ef] p-5 text-center text-[#061b12] shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
          <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#061b12] text-[#ddb159] shadow-[0_12px_32px_rgba(6,27,18,0.2)]">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
              <path d="M9 10h.01M15 10h.01M9.5 15c1.4 1.1 3.6 1.1 5 0" />
            </svg>
          </div>
          <h2 className="mt-4 text-[23px] font-black tracking-[-0.04em]">Unlock with Face ID</h2>
          <p className="mx-auto mt-2 max-w-[330px] text-[12px] font-semibold leading-5 text-[#061b12]/55">
            Next time you open StockGPT, go straight to your portfolio after a quick Face ID check. Your password is not stored by StockGPT.
          </p>

          {message && (
            <p className="mt-3 rounded-xl bg-[#8e6a28]/8 px-3 py-2 text-[10px] font-bold leading-5 text-[#7b5b22]">{message}</p>
          )}

          <button
            type="button"
            onClick={enableWithBiometrics}
            disabled={authenticating}
            data-native-haptic="medium"
            className="mt-5 min-h-[52px] w-full rounded-2xl bg-[#061b12] px-5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(6,27,18,0.2)] active:scale-[0.985] disabled:opacity-60"
          >
            {authenticating ? "Checking Face ID…" : "Use Face ID"}
          </button>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(FACE_ID_KEY, "false");
              window.localStorage.removeItem(FACE_ID_OFFER_KEY);
              setShowOffer(false);
              setMessage("");
            }}
            className="mt-2 min-h-11 w-full px-4 text-[11px] font-black text-[#061b12]/48"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (!enabled || !locked) return null;

  return (
    <div className="fixed inset-0 z-[220] flex flex-col items-center justify-center bg-[#04180f] px-7 text-center text-[#faf6f0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(221,177,89,0.12),transparent_34%)]" />
      <div className="relative grid size-20 place-items-center rounded-[26px] border border-[#ddb159]/24 bg-[#ddb159]/10 text-[#ddb159] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 10V7a5 5 0 0 1 10 0v3" />
          <rect x="4" y="10" width="16" height="11" rx="3" />
          <path d="M12 14v3" />
        </svg>
      </div>
      <h1 className="relative mt-6 text-[27px] font-black tracking-[-0.04em]">StockGPT is locked</h1>
      <p className="relative mt-2 max-w-[310px] text-[12px] font-semibold leading-6 text-[#faf6f0]/52">
        Use Face ID or Touch ID to open your portfolio and account.
      </p>

      <button
        type="button"
        onClick={authenticate}
        disabled={authenticating}
        data-native-haptic="medium"
        className="relative mt-7 min-h-12 min-w-[190px] rounded-full bg-[#ddb159] px-6 text-[11px] font-black text-[#061b12] shadow-[0_12px_30px_rgba(221,177,89,0.18)] disabled:opacity-60"
      >
        {authenticating ? "Checking…" : "Unlock with Face ID"}
      </button>

      {message && (
        <div className="relative mt-4 max-w-[320px]">
          <p className="text-[10px] font-semibold leading-5 text-[#f1c66c]">{message}</p>
          {message.includes("not available") && (
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(FACE_ID_KEY, "false");
                setEnabled(false);
                setLocked(false);
              }}
              className="mt-3 min-h-10 px-4 text-[10px] font-black text-[#faf6f0]/70 underline decoration-[#ddb159]/40 underline-offset-4"
            >
              Turn off app lock on this device
            </button>
          )}
        </div>
      )}
    </div>
  );
}
