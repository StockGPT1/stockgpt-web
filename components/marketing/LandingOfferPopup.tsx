"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import { trackClientEvent } from "@/lib/analytics/client-events";

const OFFER_CODE = "50PORTFOLIO2026";
const DISMISSAL_KEY = "stockgpt.offer.dismissal";
const SAVED_COUPON_KEY = "stockgpt.savedCoupon";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type DismissalState = {
  count: number;
  dismissedUntil: number | null;
};

function readDismissal(): DismissalState {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSAL_KEY) ?? "{}") as Partial<DismissalState>;
    return {
      count: Number.isFinite(parsed.count) ? Number(parsed.count) : 0,
      dismissedUntil: typeof parsed.dismissedUntil === "number" ? parsed.dismissedUntil : null,
    };
  } catch {
    return { count: 0, dismissedUntil: null };
  }
}

function scrollProgress(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    return target.scrollTop / Math.max(1, target.scrollHeight - target.clientHeight);
  }

  const root = document.scrollingElement;
  return root ? root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight) : 0;
}

export function LandingOfferPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const excluded =
      pathname === "/signup" ||
      pathname === "/login" ||
      pathname === "/demo" ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/portfolio") ||
      pathname.startsWith("/rankings") ||
      pathname.startsWith("/stock/") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/world-news") ||
      pathname.startsWith("/ask-stockgpt");

    if (excluded) return;

    let cancelled = false;
    let timer: number | undefined;

    const showOffer = () => {
      if (cancelled) return;
      setOpen(true);
      trackClientEvent("offer_popup_shown", { pathname });
    };

    const handleScroll = (event: Event) => {
      if (scrollProgress(event.target) < 0.45) return;
      document.removeEventListener("scroll", handleScroll, true);
      showOffer();
    };

    async function prepareOffer() {
      if (localStorage.getItem(SAVED_COUPON_KEY) === OFFER_CODE) return;

      const dismissal = readDismissal();
      if (dismissal.count >= 2) return;
      if (dismissal.dismissedUntil && dismissal.dismissedUntil > Date.now()) return;

      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (user || cancelled) return;
      } catch {
        if (cancelled) return;
      }

      timer = window.setTimeout(showOffer, 12_000);
      document.addEventListener("scroll", handleScroll, true);
    }

    void prepareOffer();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function dismiss() {
    const current = readDismissal();
    const nextCount = Math.min(2, current.count + 1);
    localStorage.setItem(
      DISMISSAL_KEY,
      JSON.stringify({
        count: nextCount,
        dismissedUntil: nextCount >= 2 ? null : Date.now() + SEVEN_DAYS_MS,
      } satisfies DismissalState),
    );
    setOpen(false);
    trackClientEvent("offer_popup_dismissed", { pathname, dismissal_count: nextCount });
  }

  function claimOffer() {
    localStorage.setItem(SAVED_COUPON_KEY, OFFER_CODE);
    localStorage.setItem("stockgpt.savedCouponAt", String(Date.now()));
  }

  if (!open) return null;

  return (
    <aside
      role="region"
      aria-label="StockGPT launch offer"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[70] rounded-[24px] border border-[#ddb159]/38 bg-[#061b12]/[0.98] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[370px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Launch offer</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Research with less first-month cost.</h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss launch offer"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-white/12 text-xl text-white/60 transition hover:border-[#ddb159]/45 hover:text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-[13px] font-semibold leading-6 text-white/66">
        Get a few days free, then 50% off your first month with code{" "}
        <span className="font-black text-[#ddb159]">{OFFER_CODE}</span>. Cancel anytime.
      </p>
      <p className="mt-2 text-[10px] font-semibold text-white/38">
        Educational research only. Not financial advice.
      </p>

      <div className="mt-4 grid gap-2">
        <TrackedLink
          href="/signup?coupon=50PORTFOLIO2026&source=offer_popup"
          eventName="offer_popup_claimed"
          eventProperties={{ pathname, coupon: OFFER_CODE }}
          onClick={claimOffer}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ddb159] px-5 text-center text-[12px] font-black text-[#072116]"
        >
          Claim 50% off
        </TrackedLink>
        <TrackedLink
          href="/demo?source=offer_popup"
          eventName="offer_popup_tour_clicked"
          eventProperties={{ pathname }}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb159]/30 px-5 text-center text-[11px] font-black text-[#ddb159]"
        >
          Take the tour first
        </TrackedLink>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-10 text-[11px] font-black text-white/48 transition hover:text-white"
        >
          No thanks
        </button>
      </div>
    </aside>
  );
}
