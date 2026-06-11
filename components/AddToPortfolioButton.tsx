"use client";

import { useEffect, useState } from "react";
import { ManualPortfolioEntry } from "@/components/ManualPortfolioEntry";
import { MobileSheet } from "@/components/MobileSheet";

type PortfolioOption = {
  id: string;
  name: string;
  cashBalance?: number | null;
  currency?: string | null;
};

export function AddToPortfolioButton({
  ticker,
  price,
  isAuthenticated,
  portfolios = [],
  defaultPortfolioId = null,
}: {
  ticker: string;
  price: number | null;
  isAuthenticated: boolean;
  portfolios?: PortfolioOption[];
  defaultPortfolioId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const upperTicker = ticker.toUpperCase();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const entryForm = (
    <ManualPortfolioEntry
      defaultTicker={ticker}
      defaultEntryPrice={price}
      compact
      isAuthenticated={isAuthenticated}
      portfolios={portfolios}
      defaultPortfolioId={defaultPortfolioId}
      onSuccess={() => {
        setTimeout(() => setOpen(false), 450);
      }}
    />
  );

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
        className="inline-flex h-10 max-w-full items-center justify-center rounded-full border border-[#ddb159]/34 bg-[#ddb159]/10 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-[#ddb159]/60 hover:bg-[#ddb159]/16"
      >
        + Add to portfolio
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[9999] hidden overflow-x-hidden bg-black/58 backdrop-blur-[18px] lg:block">
            <button
              type="button"
              aria-label="Close add to portfolio modal"
              className="absolute inset-0 h-full w-full cursor-default"
              onClick={() => setOpen(false)}
            />

            <div className="relative z-10 flex min-h-full w-full items-center justify-center px-5 py-6">
              <div
                className="relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto overflow-x-hidden rounded-[28px] border border-[#ddb159]/35 bg-[#faf6f0] shadow-[0_30px_90px_rgba(0,0,0,0.72)]"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 z-10 rounded-full border border-[#072116]/12 bg-white/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#072116]/60 shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:border-[#ddb159]/70 hover:text-[#072116]"
                >
                  Close
                </button>

                <div className="min-w-0 border-b border-[#072116]/8 px-5 pb-3 pr-24 pt-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Add holding
                  </p>

                  <h3 className="mt-1 truncate text-[28px] font-black leading-none tracking-[-0.04em] text-[#072116]">
                    Add {upperTicker} to portfolio
                  </h3>

                  <p className="mt-2 text-[12px] font-semibold leading-5 text-[#072116]/55">
                    Log shares you already own, or buy using available portfolio
                    cash. The latest StockGPT price auto-fills but can be edited.
                  </p>
                </div>

                <div className="min-w-0 p-4">{entryForm}</div>
              </div>
            </div>
          </div>

          <MobileSheet
            open={open}
            variant="full"
            title={`Add ${upperTicker} to portfolio`}
            eyebrow="Add holding"
            description="Log shares you already own, or buy using available portfolio cash."
            onClose={() => setOpen(false)}
          >
            <div className="rounded-3xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              {entryForm}
            </div>
          </MobileSheet>
        </>
      )}
    </>
  );
}
