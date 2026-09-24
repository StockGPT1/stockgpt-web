"use client";

import { useEffect, useState } from "react";
import { isStockGPTIOSApp } from "@/lib/ios-native";

const FACE_ID_KEY = "stockgpt:faceid-enabled";

export function IOSSecurityCard() {
  const [isApp, setIsApp] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const app = isStockGPTIOSApp();
    setIsApp(app);
    if (app) setEnabled(window.localStorage.getItem(FACE_ID_KEY) === "true");
  }, []);

  if (!isApp) return null;

  function setFaceIDLogin(nextEnabled: boolean) {
    window.localStorage.setItem(FACE_ID_KEY, String(nextEnabled));
    setEnabled(nextEnabled);
    setMessage(
      nextEnabled
        ? "Face ID sign-in is on for this iPhone."
        : "Face ID sign-in is off for this iPhone.",
    );
    window.dispatchEvent(
      new CustomEvent("stockgpt:faceid-setting", {
        detail: { enabled: nextEnabled },
      }),
    );
  }

  return (
    <section className="rounded-2xl border border-[#ddb159]/35 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8e6a28]">
            This iPhone
          </p>
          <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em]">
            Face ID sign-in
          </h2>
          <p className="mt-1 max-w-md text-[11px] font-semibold leading-5 text-[#072116]/55">
            Use Face ID from the login screen for quick access. StockGPT will
            not ask for Face ID when you switch tabs or resume the app.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Face ID sign-in"
          data-native-haptic="medium"
          onClick={() => setFaceIDLogin(!enabled)}
          className={[
            "relative h-8 w-[52px] shrink-0 rounded-full p-1 transition",
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
        <p
          className={`mt-3 text-[10px] font-bold leading-5 ${
            enabled ? "text-emerald-700" : "text-[#8e6a28]"
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
