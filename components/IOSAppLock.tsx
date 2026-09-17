"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isStockGPTIOSApp, requestNativeAuthentication } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";
const BACKGROUND_LOCK_AFTER_MS = 30_000;

type BiometricResult = {
  success?: boolean;
  available?: boolean;
  message?: string;
};

export function IOSAppLock() {
  const [isApp, setIsApp] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [message, setMessage] = useState("");
  const backgroundedAt = useRef<number | null>(null);

  const authenticate = useCallback(() => {
    setAuthenticating(true);
    setMessage("");
    const started = requestNativeAuthentication(
      "Unlock StockGPT to view your portfolio, watchlist and account.",
    );
    if (!started) {
      setAuthenticating(false);
      setMessage("Face ID could not start. Reopen StockGPT and try again.");
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
    if (!isApp) return;

    function onBiometricResult(event: Event) {
      const result = (event as CustomEvent<BiometricResult>).detail ?? {};
      setAuthenticating(false);

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

  if (!isApp || !enabled || !locked) return null;

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
