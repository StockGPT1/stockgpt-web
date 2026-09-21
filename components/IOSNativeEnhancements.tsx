"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  isStockGPTIOSApp,
  nativeHaptic,
  requestNativePushPermission,
  requestNativePushToken,
} from "@/lib/ios-native";

const PULL_THRESHOLD = 72;
const MAX_PULL = 108;
const PUSH_PROMPTED_KEY = "stockgpt:ios-push-prompted-v2";
const PUSH_STATE_KEY = "stockgpt:ios-push-state";
const PUSH_TOKEN_KEY = "stockgpt:ios-push-token";
const PUSH_ENVIRONMENT_KEY = "stockgpt:ios-push-environment";

function hapticStyle(element: Element) {
  const value = element.getAttribute("data-native-haptic");
  if (
    value === "medium" ||
    value === "heavy" ||
    value === "success" ||
    value === "warning" ||
    value === "error"
  ) {
    return value;
  }
  return "light";
}

async function syncPushTokenToAccount(token: string, environment: string) {
  try {
    const response = await fetch("/api/ios/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: "ios",
        environment: environment === "production" ? "production" : "sandbox",
      }),
    });

    // A 401 is expected if the user granted notifications before signing in.
    // The saved token is retried automatically after the route changes/login completes.
    if (!response.ok && response.status !== 401) {
      console.warn("[ios] push token sync returned", response.status);
    }
  } catch (error) {
    console.warn("[ios] push token sync failed", error);
  }
}

export function IOSNativeEnhancements() {
  const pathname = usePathname();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  const updatePullDistance = useCallback((next: number) => {
    pullDistanceRef.current = next;
    setPullDistance(next);
  }, []);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!isStockGPTIOSApp()) return;

    function handleInteractiveClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest(
        "button, a, [role='button'], input[type='checkbox'], input[type='radio'], select",
      );
      if (!control || !control.closest(".sg-app-shell")) return;
      if (control.getAttribute("data-native-haptic") === "off") return;
      if (control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return;
      nativeHaptic(hapticStyle(control));
    }

    document.addEventListener("click", handleInteractiveClick, true);
    return () => document.removeEventListener("click", handleInteractiveClick, true);
  }, []);

  useEffect(() => {
    if (!isStockGPTIOSApp()) return;

    let promptTimer = 0;

    function onPermission(event: Event) {
      const granted = Boolean((event as CustomEvent<{ granted?: boolean }>).detail?.granted);
      window.localStorage.setItem(PUSH_PROMPTED_KEY, "true");
      window.localStorage.setItem(PUSH_STATE_KEY, granted ? "enabled" : "denied");
    }

    async function onPushToken(event: Event) {
      const detail = (event as CustomEvent<{ token?: string; environment?: string }>).detail;
      const token = detail?.token?.trim().toLowerCase();
      if (!token) return;

      const environment = detail?.environment === "production" ? "production" : "sandbox";
      window.localStorage.setItem(PUSH_PROMPTED_KEY, "true");
      window.localStorage.setItem(PUSH_STATE_KEY, "enabled");
      window.localStorage.setItem(PUSH_TOKEN_KEY, token);
      window.localStorage.setItem(PUSH_ENVIRONMENT_KEY, environment);
      await syncPushTokenToAccount(token, environment);
    }

    function onRegistrationError() {
      window.localStorage.setItem(PUSH_PROMPTED_KEY, "true");
      window.localStorage.setItem(PUSH_STATE_KEY, "error");
    }

    window.addEventListener("stockgpt:push-permission", onPermission);
    window.addEventListener("stockgpt:push-token", onPushToken);
    window.addEventListener("stockgpt:push-registration-error", onRegistrationError);

    // Ask native iOS for the last APNs token after listeners are installed.
    // The token is persisted natively, so a cold-launch timing race cannot lose it.
    requestNativePushToken();

    const prompted = window.localStorage.getItem(PUSH_PROMPTED_KEY);
    const pushState = window.localStorage.getItem(PUSH_STATE_KEY);

    if (!prompted && pushState !== "enabled" && pushState !== "denied") {
      // Ask once on the first real app launch. iOS owns the Allow / Don't Allow UI.
      // Only mark the request as completed when native iOS answers, so a bridge/startup
      // race cannot permanently suppress the notification prompt.
      promptTimer = window.setTimeout(() => {
        if (!requestNativePushPermission()) {
          window.localStorage.setItem(PUSH_STATE_KEY, "error");
        }
      }, 1200);
    }

    return () => {
      window.clearTimeout(promptTimer);
      window.removeEventListener("stockgpt:push-permission", onPermission);
      window.removeEventListener("stockgpt:push-token", onPushToken);
      window.removeEventListener("stockgpt:push-registration-error", onRegistrationError);
    };
  }, []);

  useEffect(() => {
    if (!isStockGPTIOSApp()) return;

    const token = window.localStorage.getItem(PUSH_TOKEN_KEY)?.trim().toLowerCase();
    if (!token) return;

    const environment =
      window.localStorage.getItem(PUSH_ENVIRONMENT_KEY) === "production"
        ? "production"
        : "sandbox";

    void syncPushTokenToAccount(token, environment);
  }, [pathname]);

  useEffect(() => {
    if (!isStockGPTIOSApp()) return;

    const scrollRoot = document.querySelector<HTMLElement>(".sg-app-content");
    if (!scrollRoot) return;
    // Capture the narrowed element in a non-null local before the event
    // handlers close over it. TypeScript cannot preserve querySelector's
    // null-check narrowing across nested callbacks.
    const root = scrollRoot;

    function reset() {
      startY.current = null;
      pulling.current = false;
      updatePullDistance(0);
    }

    function onTouchStart(event: TouchEvent) {
      if (refreshingRef.current || root.scrollTop > 0 || event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches.item(0);
      if (!touch) return;
      startY.current = touch.clientY;
      pulling.current = true;
    }

    function onTouchMove(event: TouchEvent) {
      if (!pulling.current || startY.current == null || event.touches.length !== 1) return;
      if (root.scrollTop > 0) {
        reset();
        return;
      }

      const touch = event.touches.item(0);
      if (!touch) return;
      const raw = touch.clientY - startY.current;
      if (raw <= 0) {
        updatePullDistance(0);
        return;
      }

      event.preventDefault();
      updatePullDistance(Math.min(MAX_PULL, raw * 0.5));
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD;
      startY.current = null;
      pulling.current = false;

      if (!shouldRefresh) {
        updatePullDistance(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      updatePullDistance(PULL_THRESHOLD);
      nativeHaptic("medium");
      window.setTimeout(() => window.location.reload(), 180);
    }

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", reset);
    };
  }, [updatePullDistance]);

  if (!pullDistance && !refreshing) return null;

  const ready = pullDistance >= PULL_THRESHOLD;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 z-[80] -translate-x-1/2 lg:hidden"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 62px)",
        transform: `translate(-50%, ${Math.max(0, pullDistance - 34)}px)`,
        opacity: Math.min(1, pullDistance / 42),
      }}
    >
      <div className="grid size-9 place-items-center rounded-full border border-[#ddb159]/35 bg-[#04180f]/95 shadow-[0_8px_24px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <span
          className={`block size-4 rounded-full border-2 border-[#ddb159]/30 border-t-[#ddb159] ${
            refreshing ? "animate-spin" : ""
          }`}
          style={!refreshing ? { transform: `rotate(${Math.min(300, pullDistance * 3.8)}deg)` } : undefined}
        />
      </div>
      <span className="sr-only">{ready ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  );
}
