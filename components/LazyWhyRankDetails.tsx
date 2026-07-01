"use client";

import { useState } from "react";
import { getFactorExplanations } from "@/lib/research-explainability";
import type { StableRankingRow } from "@/lib/stable-rankings";

export function LazyWhyRankDetails({
  stock,
  dailyMove,
  light = false,
}: {
  stock: StableRankingRow;
  dailyMove: number | null | undefined;
  light?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const factors = open ? getFactorExplanations(stock, dailyMove) : [];

  return (
    <details
      className={
        light
          ? "mt-3 rounded-2xl border border-[#072116]/10 bg-white px-3 py-2"
          : "border-b border-[#072116]/8 bg-white/72 px-4 py-2"
      }
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer list-none py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#8a641a]">
        Why this rank?
      </summary>
      {open && (
        <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {factors.map((factor) => (
            <div
              key={factor.label}
              className="rounded-xl border border-[#072116]/8 bg-[#072116]/[0.025] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/45">
                  {factor.label}
                </p>
                <span className="shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-0.5 text-[8px] font-black text-[#8a641a]">
                  {factor.value}
                </span>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[#072116]/58">
                {factor.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
