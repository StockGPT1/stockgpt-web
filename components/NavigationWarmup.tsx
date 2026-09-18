"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrandLoaderPage } from "@/components/BrandLoader";

function labelForPath(pathname: string) {
  if (pathname.startsWith("/stock/")) return "Running the numbers";
  if (pathname.startsWith("/rankings")) return "Scoring 500+ stocks";
  if (pathname.startsWith("/portfolio")) return "Weighing your holdings";
  if (pathname.startsWith("/watchlist")) return "Loading your watchlist";
  if (pathname.startsWith("/notifications")) return "Checking your alerts";
  if (pathname.startsWith("/world-news")) return "Scanning the globe";
  if (pathname.startsWith("/settings")) return "Opening your settings";
  if (pathname.startsWith("/dashboard")) return "Pulling up your dashboard";
  return "Loading StockGPT";
}

function internalDestination(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const anchor = element?.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;

  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Gives every in-app link instant visual feedback while the App Router starts
 * the next route. Route-level loading.tsx takes over as soon as navigation
 * begins, so slow mobile networks never leave a dead-looking pause.
 */
export function NavigationWarmup() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const locationKey = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [pathname, searchParams],
  );

  useEffect(() => {
    setPendingLabel(null);
  }, [locationKey]);

  useEffect(() => {
    if (!pendingLabel) return;
    const timeout = window.setTimeout(() => setPendingLabel(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [pendingLabel]);

  useEffect(() => {
    function begin(target: EventTarget | null) {
      const url = internalDestination(target);
      if (!url) return;

      const current = new URL(window.location.href);
      if (
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash
      ) {
        return;
      }

      setPendingLabel(labelForPath(url.pathname));
      router.prefetch(`${url.pathname}${url.search}`);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      begin(event.target);
    }

    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      begin(event.target);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  if (!pendingLabel) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[2147483600]">
      <BrandLoaderPage label={pendingLabel} />
    </div>
  );
}
