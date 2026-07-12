"use client";

import { useEffect, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { useAppChrome, useFocusedFlow } from "@/components/AppChromeProvider";

export function GlobalSearchOverlay({ showRankingData }: { showRankingData: boolean }) {
  const { searchOpen, closeSearch } = useAppChrome();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useFocusedFlow("global-search", searchOpen);

  useEffect(() => {
    if (!searchOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSearch();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.({ preventScroll: true });
    };
  }, [closeSearch, searchOpen]);

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] bg-[#020805]/96 text-[#faf6f0] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
      <div className="mx-auto flex h-[100dvh] max-w-xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ddb159]">Global search</p>
            <h2 id="global-search-title" className="mt-1 text-2xl font-black tracking-[-0.04em]">Search StockGPT</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={closeSearch} className="grid size-11 place-items-center rounded-full border border-[#ddb159]/25 text-xl text-[#ddb159]" aria-label="Close search">&times;</button>
        </header>
        <SearchBar showRankingData={showRankingData} presentation="overlay" autoFocus onNavigate={closeSearch} />
        <p className="mt-5 text-[12px] font-semibold leading-5 text-[#faf6f0]/48">
          Find tickers, portfolios, rankings, alerts, news, settings, and Ask StockGPT.
        </p>
      </div>
    </div>
  );
}
