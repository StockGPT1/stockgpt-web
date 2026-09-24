"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isStockGPTIOSApp } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";
const FACE_ID_OFFER_KEY = "stockgpt:faceid-offer-pending";

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
  const [showOffer, setShowOffer] = useState(false);

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

    function onSetting(event: Event) {
      const nextEnabled = Boolean(
        (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled,
      );
      setEnabled(nextEnabled);
    }

    window.addEventListener("stockgpt:faceid-setting", onSetting);
    return () => {
      window.removeEventListener("stockgpt:faceid-setting", onSetting);
    };
  }, [isApp]);

  if (!isApp || !showOffer || enabled) return null;

  function enableFaceIDLogin() {
    window.localStorage.setItem(FACE_ID_KEY, "true");
    window.localStorage.removeItem(FACE_ID_OFFER_KEY);
    setEnabled(true);
    setShowOffer(false);
    window.dispatchEvent(
      new CustomEvent("stockgpt:faceid-setting", {
        detail: { enabled: true },
      }),
    );
  }

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
          Enable Face ID for future logins on this iPhone. Face ID will only
          be requested from the login screen, not when moving between tabs.
        </p>

        <button
          type="button"
          onClick={enableFaceIDLogin}
          data-native-haptic="medium"
          className="mt-5 min-h-[52px] w-full rounded-2xl bg-[#061b12] px-5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(6,27,18,0.2)] active:scale-[0.985]"
        >
          Enable Face ID
        </button>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(FACE_ID_KEY, "false");
            window.localStorage.removeItem(FACE_ID_OFFER_KEY);
            setShowOffer(false);
          }}
          className="mt-2 min-h-11 w-full px-4 text-[11px] font-black text-[#061b12]/48"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
