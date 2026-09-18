"use client";

import { useEffect, useState } from "react";
import { isStockGPTIOSApp, requestNativePushPermission } from "@/lib/ios-native";

type PushState = "idle" | "requesting" | "enabled" | "denied" | "error";

export function IOSPushSetupCard() {
  const [isApp, setIsApp] = useState(false);
  const [state, setState] = useState<PushState>("idle");

  useEffect(() => {
    const app = isStockGPTIOSApp();
    setIsApp(app);
    if (!app) return;

    const stored = window.localStorage.getItem("stockgpt:ios-push-state");
    if (stored === "enabled" || stored === "denied") setState(stored);

    function onPermission(event: Event) {
      const granted = Boolean((event as CustomEvent<{ granted?: boolean }>).detail?.granted);
      const next: PushState = granted ? "enabled" : "denied";
      setState(next);
      window.localStorage.setItem("stockgpt:ios-push-state", next);
    }

    function onToken() {
      setState("enabled");
      window.localStorage.setItem("stockgpt:ios-push-state", "enabled");
    }

    function onError() {
      setState("error");
    }

    window.addEventListener("stockgpt:push-permission", onPermission);
    window.addEventListener("stockgpt:push-token", onToken);
    window.addEventListener("stockgpt:push-registration-error", onError);
    return () => {
      window.removeEventListener("stockgpt:push-permission", onPermission);
      window.removeEventListener("stockgpt:push-token", onToken);
      window.removeEventListener("stockgpt:push-registration-error", onError);
    };
  }, []);

  if (!isApp || state === "enabled") return null;

  return (
    <section className="mb-4 rounded-[20px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(221,177,89,0.11),rgba(8,37,25,0.72))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.16)] lg:hidden">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#ddb159]/14 text-[#ddb159]">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21h4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black text-[#faf6f0]">iPhone alerts</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/52">
            Get StockGPT portfolio and price alerts on your Lock Screen, then tap straight back into the relevant app page.
          </p>
          {state === "denied" && (
            <p className="mt-2 text-[10px] font-bold leading-4 text-[#e8bd61]">
              Notifications are currently blocked. You can re-enable them in iPhone Settings → Notifications → StockGPT.
            </p>
          )}
          {state === "error" && (
            <p className="mt-2 text-[10px] font-bold leading-4 text-[#f1908d]">
              The phone could not register for alerts. Check that Push Notifications is enabled for the StockGPT target in Xcode.
            </p>
          )}
          <button
            type="button"
            disabled={state === "requesting" || state === "denied"}
            data-native-haptic="medium"
            onClick={() => {
              setState("requesting");
              if (!requestNativePushPermission()) setState("error");
            }}
            className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[#ddb159] px-4 text-[10px] font-black text-[#061b12] disabled:opacity-50"
          >
            {state === "requesting" ? "Waiting for iOS…" : state === "denied" ? "Notifications blocked" : "Enable iPhone alerts"}
          </button>
        </div>
      </div>
    </section>
  );
}
