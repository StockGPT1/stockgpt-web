"use client";

import { useState } from "react";
import Link from "next/link";

export function AskStockGPTButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#ddb159]/70 bg-[#ddb159] px-4 text-[12px] font-black text-[#072116] shadow-[0_8px_22px_rgba(221,177,89,0.16)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_12px_30px_rgba(221,177,89,0.28)]"
      >
        <span>✦</span>
        <span>Ask StockGPT</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/45 p-3 backdrop-blur-sm">
          <div className="ml-auto flex h-full max-w-[390px] flex-col overflow-hidden rounded-3xl border border-[#ddb159]/35 bg-[#061b12] text-[#faf6f0] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="relative border-b border-[#ddb159]/18 bg-[radial-gradient(circle_at_80%_0%,rgba(221,177,89,0.18),transparent_38%),linear-gradient(135deg,#0d3420,#061b12)] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Ask StockGPT"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-[#ddb159]/30 text-[#ddb159] transition hover:bg-[#ddb159]/10"
              >
                ×
              </button>

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                ✦ AI Assistant
              </p>

              <h2 className="mt-1 text-[24px] font-black tracking-[-0.05em]">
                Ask StockGPT
              </h2>

              <p className="mt-2 max-w-[310px] text-[12px] font-medium leading-relaxed text-[#faf6f0]/65">
                The interface is ready. The live AI response endpoint still
                needs to be connected before this can answer user questions.
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-between p-4">
              <div className="rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0] px-3 py-3 text-[12px] font-semibold leading-relaxed text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
                No fake answers are shown here. To make this fully functional,
                connect this drawer to a real API route, for example{" "}
                <span className="font-black">/api/ask-stockgpt</span>, using
                live Supabase rankings, Yahoo data, news and portfolio data.
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/rankings"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-[#ddb159]/25 bg-[#faf6f0]/[0.035] px-3 py-2 text-[12px] font-bold text-[#faf6f0]/80 transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                >
                  View live rankings →
                </Link>

                <Link
                  href="/portfolio"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-[#ddb159]/25 bg-[#faf6f0]/[0.035] px-3 py-2 text-[12px] font-bold text-[#faf6f0]/80 transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                >
                  Open portfolio →
                </Link>

                <Link
                  href="/world-news"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-[#ddb159]/25 bg-[#faf6f0]/[0.035] px-3 py-2 text-[12px] font-bold text-[#faf6f0]/80 transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                >
                  Read market news →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
