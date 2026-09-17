"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isStockGPTIOSApp, nativeHaptic } from "@/lib/ios-native";

const PULL_THRESHOLD = 72;
const MAX_PULL = 108;

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

export function IOSNativeEnhancements() {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  function updatePullDistance(next: number) {
    pullDistanceRef.current = next;
    setPullDistance(next);
  }

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

    async function handlePushToken(event: Event) {
      const token = (event as CustomEvent<{ token?: string }>).detail?.token;
      if (!token) return;

      try {
        const response = await fetch("/api/ios/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform: "ios" }),
        });
        if (!response.ok) console.warn("[ios] push token sync returned", response.status);
      } catch (error) {
        console.warn("[ios] push token sync failed", error);
      }
    }

    function handlePushOpen(event: Event) {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (!path || !path.startsWith("/")) return;
      router.push(path);
    }

    window.addEventListener("stockgpt:push-token", handlePushToken);
    window.addEventListener("stockgpt:push-open", handlePushOpen);
    return () => {
      window.removeEventListener("stockgpt:push-token", handlePushToken);
      window.removeEventListener("stockgpt:push-open", handlePushOpen);
    };
  }, [router]);

  useEffect(() => {
    if (!isStockGPTIOSApp()) return;

    const scrollRoot = document.querySelector<HTMLElement>(".sg-app-content");
    if (!scrollRoot) return;

    function reset() {
      startY.current = null;
      pulling.current = false;
      updatePullDistance(0);
    }

    function onTouchStart(event: TouchEvent) {
      if (refreshingRef.current || scrollRoot.scrollTop > 0 || event.touches.length !== 1) {
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
      if (scrollRoot.scrollTop > 0) {
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

    scrollRoot.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollRoot.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollRoot.addEventListener("touchend", onTouchEnd, { passive: true });
    scrollRoot.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      scrollRoot.removeEventListener("touchstart", onTouchStart);
      scrollRoot.removeEventListener("touchmove", onTouchMove);
      scrollRoot.removeEventListener("touchend", onTouchEnd);
      scrollRoot.removeEventListener("touchcancel", reset);
    };
  }, []);

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
