"use client";

import { useState } from "react";
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center justify-center rounded-full border border-[#ddb159]/34 bg-[#ddb159]/10 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159]/60 hover:bg-[#ddb159]/16"
      >
        + Portfolio
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(92vw,430px)]">
          <ManualPortfolioEntry
            defaultTicker={ticker}
            defaultEntryPrice={price}
            compact
            isAuthenticated={isAuthenticated}
          />
        </div>
      )}
    </div>
  );
}
