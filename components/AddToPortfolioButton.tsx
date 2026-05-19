"use client";

import { useEffect, useState } from "react";
import { ManualPortfolioEntry } from "@/components/ManualPortfolioEntry";

export function AddToPortfolioButton({
  ticker,
  price,
  isAuthenticated,
}: {
  ticker: string;
  price: number | null;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            window.location.href = "/login";
            return;
          }

          setOpen(true);
        }}
        className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/34 bg-[#ddb159]/10 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-[#ddb159]/60 hover:bg-[#ddb159]/16"
      >
        + Add to portfolio
      </button>

      {open && (
        <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[88px] z-[9999] overflow-hidden sm:bottom-0">
          <button
            type="button"
            aria-label="Close add to portfolio"
            className="absolute inset-0 h-full w-full cursor-default bg-transparent backdrop-blur-[32px] backdrop-brightness-[0.42] backdrop-saturate-50"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 flex h-full items-center justify-center px-3 py-4">
            <div
              className="relative max-h-full w-full max-w-[470px] overflow-y-auto rounded-[26px] border border-[#ddb159]/35 bg-[#faf6f0] shadow-[0_30px_90px_rgba(0,0,0,0.72)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 z-10 rounded-full border border-[#072116]/12 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#072116]/60 shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:border-[#ddb159]/70 hover:text-[#072116]"
              >
                Close
              </button>

              <div className="border-b border-[#072116]/8 px-4 pb-3 pt-4 pr-24">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Add holding
                </p>

                <h3 className="mt-1 text-[24px] font-black leading-none tracking-[-0.04em] text-[#072116]">
                  Add {ticker} to portfolio
                </h3>

                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#072116]/55">
                  Enter shares and average entry price. StockGPT will track
                  value, AI score movement, rank movement and alerts.
                </p>
              </div>

              <div className="p-3">
                <ManualPortfolioEntry
                  defaultTicker={ticker}
                  defaultEntryPrice={price}
                  compact
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
