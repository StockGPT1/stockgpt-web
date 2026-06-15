"use client";

import { useEffect } from "react";

const ANDROID_MOBILE_LAYOUT_FIXES = `
@media (max-width: 767px) {
  html[data-stockgpt-android="true"] .sg-app-shell {
    height: 100svh !important;
    min-height: 100svh !important;
    max-height: 100svh !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row {
    gap: 6px !important;
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row > .min-w-0 {
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row .sg-search-root {
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row .sg-search-shell {
    height: 38px !important;
    min-width: 0 !important;
    padding-left: 14px !important;
    padding-right: 8px !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row .sg-search-input {
    min-width: 0 !important;
    font-size: 13px !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row .sg-search-kbd,
  html[data-stockgpt-android="true"] .sg-mobile-search-row .sg-search-shell > div:last-child {
    display: none !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row a[href="/ask-stockgpt"] {
    height: 38px !important;
    gap: 4px !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
    font-size: 10.5px !important;
    white-space: nowrap !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row a[href="/ask-stockgpt"] span {
    font-size: 10.5px !important;
  }

  html[data-stockgpt-android="true"] .sg-app-content {
    padding-bottom: 12px !important;
  }

  html[data-stockgpt-android="true"] .sg-bottom-nav {
    position: relative !important;
    inset: auto !important;
    z-index: 30 !important;
    height: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
    width: 100% !important;
    padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    flex-shrink: 0 !important;
  }
}

@media (max-width: 370px) {
  html[data-stockgpt-android="true"] .sg-mobile-search-row a[href="/ask-stockgpt"] {
    width: 38px !important;
    min-width: 38px !important;
    justify-content: center !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  html[data-stockgpt-android="true"] .sg-mobile-search-row a[href="/ask-stockgpt"] span:last-child {
    display: none !important;
  }
}
`;

export function PremiumInteractionEffects() {
  useEffect(() => {
    if (!/Android/i.test(window.navigator.userAgent)) return;

    document.documentElement.dataset.stockgptAndroid = "true";

    return () => {
      delete document.documentElement.dataset.stockgptAndroid;
    };
  }, []);

  return (
    <style
      id="stockgpt-android-mobile-layout-fixes"
      dangerouslySetInnerHTML={{ __html: ANDROID_MOBILE_LAYOUT_FIXES }}
    />
  );
}
