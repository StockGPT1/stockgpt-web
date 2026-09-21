"use client";

import { useEffect, useState } from "react";
import { isStockGPTIOSApp, requestNativeAuthentication } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";

type BiometricResult = {
  success?: boolean;
  available?: boolean;
  message?: string;
};

export function IOSSecurityCard() {
  const [isApp, setIsApp] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const app = isStockGPTIOSApp();
    setIsApp(app);
    if (app) setEnabled(window.localStorage.getItem(FACE_ID_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!isApp) return;

    function onResult(event: Event) {
      if (!pendingEnable) return;
      const result = (event as CustomEvent<BiometricResult>).detail ?? {};
      setPendingEnable(false);

      if (result.success) {
        window.localStorage.setItem(FACE_ID_KEY, "true");
        setEnabled(true);
        setMessage("Face ID app lock is on for this iPhone.");
        window.dispatchEvent(new CustomEvent("stockgpt:faceid-setting", { detail: { enabled: true } }));
        return;
      }

      setMessage(
        result.available === false
          ? "Face ID or Touch ID is not available on this device."
          : result.message || "Authentication was not completed.",
      );
    }

    window.addEventListener("stockgpt:biometric-result", onResult);
    return () => window.removeEventListener("stockgpt:biometric-result", onResult);
  }, [isApp, pendingEnable]);

  if (!isApp) return null;

  function turnOff() {
    window.localStorage.setItem(FACE_ID_KEY, "false");
    setEnabled(false);
    setMessage("Face ID app lock is off on this iPhone.");
    window.dispatchEvent(new CustomEvent("stockgpt:faceid-setting", { detail: { enabled: false } }));
  }

  function turnOn() {
    setMessage("");
    setPendingEnable(true);
    const started = requestNativeAuthentication(
      "Confirm Face ID to protect StockGPT on this iPhone.",
    );
    if (!started) {
      setPendingEnable(false);
      setMessage("Face ID could not start. Reopen the app and try again.");
    }
  }

  return (
    <section className="rounded-2xl border border-[#ddb159]/35 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8e6a28]">This iPhone</p>
          <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em]">Face ID app lock</h2>
          <p className="mt-1 max-w-md text-[11px] font-semibold leading-5 text-[#072116]/55">
            Require Face ID or Touch ID when StockGPT opens and after the app has been in the background for 30 seconds.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Face ID app lock"
          disabled={pendingEnable}
          data-native-haptic="medium"
          onClick={enabled ? turnOff : turnOn}
          className={[
            "relative h-8 w-[52px] shrink-0 rounded-full p-1 transition disabled:opacity-50",
            enabled ? "bg-[#0a7b56]" : "bg-[#072116]/18",
          ].join(" ")}
        >
          <span
            className={[
              "block size-6 rounded-full bg-white shadow-sm transition-transform",
              enabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
      {message && (
        <p className={`mt-3 text-[10px] font-bold leading-5 ${enabled ? "text-emerald-700" : "text-[#8e6a28]"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
