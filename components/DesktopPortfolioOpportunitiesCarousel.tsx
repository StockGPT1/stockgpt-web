"use client";

import Link from "next/link";
import { useRef } from "react";
import { StockLogo } from "@/components/StockLogo";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";

function formatScore(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatMove(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatUpdatedLabel(value?: string | null) {
  if (!value) return "Update time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update time unavailable";

  const diffMs = Date.now() - date.getTime();
  if (diffMs >= 0 && diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000));
    return `Updated ${mins} min${mins === 1 ? "" : "s"} ago`;
  }

  if (date.toDateString() === new Date().toDateString()) {
    return `Updated today ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return `Updated ${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })}`;
}

export function DesktopPortfolioOpportunitiesCarousel({
  opportunities,
}: {
  opportunities: DashboardPortfolioOpportunity[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollTrack(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    const distance = Math.max(320, Math.min(track.clientWidth * 0.82, 760));
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  return (
    <section
      aria-labelledby="desktop-portfolio-opportunities-title"
      className="hidden min-w-0 lg:block"
    >
      <div className="mb-2 flex min-w-0 items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#ddb159]">
            StockGPT opportunities
          </p>
          <h2
            id="desktop-portfolio-opportunities-title"
            className="mt-0.5 truncate text-[19px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]"
          >
            Portfolio-fit ideas
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {opportunities.length > 1 && (
            <div className="flex items-center gap-1" aria-label="Scroll portfolio-fit ideas">
              <button
                type="button"
                onClick={() => scrollTrack(-1)}
                aria-label="Show previous portfolio-fit ideas"
                className="inline-flex size-8 items-center justify-center rounded-full border border-[#ddb159]/24 bg-[#0a281b]/72 text-[15px] font-black text-[#ddb159] transition hover:border-[#ddb159]/55 hover:bg-[#ddb159]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/55"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollTrack(1)}
                aria-label="Show next portfolio-fit ideas"
                className="inline-flex size-8 items-center justify-center rounded-full border border-[#ddb159]/24 bg-[#0a281b]/72 text-[15px] font-black text-[#ddb159] transition hover:border-[#ddb159]/55 hover:bg-[#ddb159]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/55"
              >
                →
              </button>
            </div>
          )}

          <Link
            href="/rankings"
            className="rounded-full border border-[#ddb159]/24 bg-[#0a281b]/58 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#ddb159] transition hover:border-[#ddb159]/55 hover:bg-[#ddb159]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/55"
          >
            Review all →
          </Link>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="rounded-2xl border border-[#ddb159]/18 bg-[#0b2b1d]/52 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-sm">
          <p className="text-[12px] font-black text-[#faf6f0]">
            No strong portfolio-fit ideas right now.
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#faf6f0]/52">
            StockGPT is not forcing a recommendation when the current setup is not strong enough.
          </p>
        </div>
      ) : (
        <div
          ref={trackRef}
          tabIndex={0}
          aria-label="Portfolio-fit ideas carousel"
          className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 pr-[clamp(24px,5vw,72px)] scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {opportunities.map((item) => {
            const move = formatMove(item.recentMovePct);

            return (
              <Link
                key={`${item.category}-${item.ticker}`}
                href={`/stock/${item.ticker}`}
                className="group relative grid min-h-[154px] w-[clamp(285px,31vw,360px)] shrink-0 snap-start grid-cols-[42px_minmax(0,1fr)_auto] gap-x-3 overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[linear-gradient(135deg,rgba(14,52,34,0.82),rgba(7,31,21,0.72))] p-4 text-[#faf6f0] shadow-[0_12px_28px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#ddb159]/55 hover:shadow-[0_16px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/55"
              >
                <div className="pointer-events-none absolute -right-12 -top-14 size-28 rounded-full bg-[#ddb159]/10 blur-3xl" />

                <StockLogo ticker={item.ticker} company={item.company} size={38} />

                <div className="relative min-w-0">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <h3 className="shrink-0 text-[14px] font-black leading-none tracking-[-0.02em]">
                      {item.ticker}
                    </h3>
                    <p className="min-w-0 truncate text-[10px] font-bold text-[#faf6f0]/48">
                      {item.company ?? item.category}
                    </p>
                  </div>

                  <p className="mt-2 truncate text-[9px] font-black uppercase tracking-[0.11em] text-[#ddb159]">
                    {item.category}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-[1.45] text-[#faf6f0]/68">
                    {item.reason}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[9.5px] font-semibold text-[#faf6f0]/42">
                    Watch: {item.risk}
                  </p>

                  <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                    {move && (
                      <span className="rounded-full bg-[#faf6f0]/6 px-2 py-0.5 text-[8.5px] font-bold text-[#faf6f0]/58">
                        Recent move {move}
                      </span>
                    )}
                    <span className="rounded-full bg-[#ddb159]/12 px-2 py-0.5 text-[8.5px] font-bold text-[#ddb159]/82">
                      {formatUpdatedLabel(item.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="relative text-right">
                  <p className="text-[12px] font-black tabular-nums text-[#ddb159]">
                    {formatScore(item.score)}
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-[#faf6f0]/42">
                    #{item.rank ?? "—"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
