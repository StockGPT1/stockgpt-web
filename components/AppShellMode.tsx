"use client";

import { useEffect } from "react";

/* The iOS app shell (Capacitor WKWebView) appends "StockGPTApp" to its
   user agent. Tagging <html> lets CSS and components adapt when the site
   runs inside the native app — e.g. hiding web-only marketing chrome and
   payment prompts that Apple's review guidelines restrict in-app. */
export function AppShellMode() {
  useEffect(() => {
    if (navigator.userAgent.includes("StockGPTApp")) {
      document.documentElement.setAttribute("data-app-shell", "true");
    }
  }, []);

  return null;
}
