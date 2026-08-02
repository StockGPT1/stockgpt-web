"use client";

import {
  OFFER_TOTAL,
  offerClaimedPercent,
  offerSeatsClaimed,
  offerSeatsLeft,
} from "@/lib/limited-offer";

export function OfferSeatsMeter() {
  const seats = offerSeatsLeft();
  const claimed = offerSeatsClaimed();
  const pct = offerClaimedPercent();

  return (
    <div className="mx-auto mt-3 w-full max-w-md rounded-2xl border border-[#ddb159]/30 bg-[#ddb159]/8 px-4 py-3 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
          Founding offer — £4.99/mo
        </p>
        <p className="shrink-0 text-[12px] font-black text-[#faf6f0]" suppressHydrationWarning>
          {seats} <span className="font-bold text-[#faf6f0]/55">of {OFFER_TOTAL} left</span>
        </p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={OFFER_TOTAL}
        aria-valuenow={claimed}
        aria-label={`${claimed} of the next ${OFFER_TOTAL} member spots claimed`}
        suppressHydrationWarning
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ddb159] to-[#f0c867]"
          style={{ width: `${pct}%` }}
          suppressHydrationWarning
        />
      </div>
      <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-[#faf6f0]/50" suppressHydrationWarning>
        {claimed} of the next {OFFER_TOTAL} member spots are already claimed. The £4.99 monthly
        rate applies while spots remain.
      </p>
    </div>
  );
}
