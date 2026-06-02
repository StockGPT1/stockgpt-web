"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES_TO_WARM = [
  "/dashboard",
  "/rankings",
  "/portfolio",
  "/watchlist",
  "/notifications",
  "/world-news",
  "/settings",
  "/subscription",
];

export function NavigationWarmup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const warmRoutes = () => {
      if (cancelled) return;

      for (const href of ROUTES_TO_WARM) {
        router.prefetch(href);
      }
    };

    const initialTimer = window.setTimeout(warmRoutes, 700);

    const handleFocus = () => warmRoutes();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") warmRoutes();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return null;
}
