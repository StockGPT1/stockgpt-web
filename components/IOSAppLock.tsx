"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isStockGPTIOSApp, requestNativeAuthentication } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";
const FACE_ID_OFFER_KEY = "stockgpt:faceid-offer-pending";

type BiometricResult = {
  success?: boolean;
  available?: boolean;
  message?: string;
};

function isPublicEntryPath(pathname: string) {
  return (
    pathname === "/welcome" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/")
  );
}

export function IOSAppLock() {
  const pathname = usePathname();
  const [isApp, setIsApp] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [message, setMessage] = useState("");
  const isOfferingFaceID = useRef(false);

  const enableWithBiometrics = useCallback(() => {
    isOfferingFaceID.current = true;
    setAuthenticating(true);
    setMessage("");

    const started = requestNativeAuthentication(
      "Use Face ID to sign in to StockGPT on this iPhone.",
    );

    if (!started) {
      isOfferingFaceID.current = false;
      setAuthenticating(false);
      setMessage("Face ID could not start. You can enable it later in Settings.");
    }
  }, []);

  useEffect(() => {
    const app = isStockGPTIOSApp();
    setIsApp(app);
    if (!app) return;

    setEnabled(window.localStorage.getItem(FACE_ID_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!isApp || enabled) {
      setShowOffer(false);
      return;
    }

    const isPublicEntry = isPublicEntryPath(pathname);
    const pending = window.localStorage.getItem(FACE_ID_OFFER_KEY) === "true";

    if (!isPublicEntry && pending) {
      const timeout = window.setTimeout(() => setShowOffer(true), 450);
      return () => window.clearTimeout(timeout);
    }

    setShowOffer(false);
  }, [enabled, isApp, pathname]);

  useEffect(() => {
    if (!isApp) return;

    function onBiometricResult(event: Event) {
      if (!isOfferingFaceID.current) return;

      isOfferingFaceID.current = false;
      setAuthenticating(false);

      const result = (event as CustomEvent<BiometricResult>).detail ?? {};

      if (result.success) {
        window.localStorage.setItem(FACE_ID_KEY, "true");
        window.localStorage.removeItem(FACE_ID_OFFER_KEY);
        setEnabled(true);
        setShowOffer(false);
        setMessage("");
        window.dispatchEvent(
          new CustomEvent("stockgpt:faceid-setting", {
            detail: { enabled: true },
          }),
        );
        return;
      }

      setMessage(
        result.available === false
          ? "Face ID is not available on this iPhone. You can continue without it."
          : result.message ||
              "Face ID was not enabled. You can try again or do it later in Settings.",
      );
    }

    function onSetting(event: Event) {
      const nextEnabled = Boolean(
        (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled,
      );
      setEnabled(nextEnabled);
      if (!nextEnabled) {
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

  if (!isApp || !showOffer || enabled) return null;

  return (
    <div className="fixed inset-0 z-[225] flex items-end justify-center bg-black/55 px-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[8px]">
      <div className="w-full max-w-[430px] rounded-[30px] border border-white/10 bg-[#f7f5ef] p-5 text-center text-[#061b12] shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
        <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#061b12] text-[#ddb159] shadow-[0_12px_32px_rgba(6,27,18,0.2)]">
          <svg
            viewBox="0 0 24 24"
            className="size-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
            <path d="M9 10h.01M15 10h.01M9.5 15c1.4 1.1 3.6 1.1 5 0" />
          </svg>
        </div>
        <h2 className="mt-4 text-[23px] font-black tracking-[-0.04em]">
          Sign in with Face ID
        </h2>
        <p className="mx-auto mt-2 max-w-[330px] text-[12px] font-semibold leading-5 text-[#061b12]/55">
          Use Face ID from the login screen for quick access to your StockGPT
          account. Moving between tabs will not ask you to authenticate again.
        </p>

        {message && (
          <p className="mt-3 rounded-xl bg-[#8e6a28]/8 px-3 py-2 text-[10px] font-bold leading-5 text-[#7b5b22]">
            {message}
          </p>
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
