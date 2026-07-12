import Link from "next/link";
import { StockLogo } from "@/components/StockLogo";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";

function formatScore(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function pct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
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

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Updated today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return `Updated ${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
}

export function PortfolioOpportunitiesWidget({
  opportunities,
  variant = "dashboard",
}: {
  opportunities: DashboardPortfolioOpportunity[];
  variant?: "dashboard" | "portfolio";
}) {
  const constrained = variant === "dashboard";
  const detailed = variant === "portfolio";

  return (
    <section
      className={[
        "min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#061b12]/88 p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.16)]",
        constrained
          ? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
          : "grid gap-2",
      ].join(" ")}
    >
      <div className="flex min-w-0 shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
            StockGPT opportunities
          </p>
          <h3 className="mt-0.5 truncate text-[17px] font-black leading-none tracking-[-0.04em]">
            Portfolio-fit ideas
          </h3>
        </div>
        <Link
          href="/rankings"
          className="shrink-0 rounded-full border border-[#ddb159]/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#ddb159] transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/50"
        >
          Review ideas →
        </Link>
      </div>

      {opportunities.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] p-3">
          <p className="text-[12px] font-black text-[#faf6f0]">
            No strong portfolio-fit ideas right now.
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-[#faf6f0]/52">
            StockGPT is not forcing a recommendation because current data does
            not show a strong enough setup.
          </p>
        </div>
      ) : (
        <div
          className={[
            "mt-2 min-w-0",
            constrained
              ? "min-h-0 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(221,177,89,0.45)_rgba(250,246,240,0.08)] [scrollbar-width:thin]"
              : "overflow-visible",
          ].join(" ")}
          tabIndex={constrained ? 0 : undefined}
          aria-label="Portfolio-fit opportunities list"
        >
          <div className="grid min-w-0 gap-2">
            {opportunities.map((item) => (
              <Link
                key={`${item.category}-${item.ticker}`}
                href={`/stock/${item.ticker}`}
                className="grid min-w-0 grid-cols-[34px_minmax(0,1fr)] gap-2 rounded-2xl border border-[#ddb159]/18 bg-[#0b2b1d] px-2.5 py-2 text-[#faf6f0] shadow-[0_8px_18px_rgba(0,0,0,0.10)] transition hover:-translate-y-px hover:border-[#ddb159]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]/50 sm:grid-cols-[34px_minmax(0,1fr)_auto] lg:bg-[#faf6f0] lg:text-[#072116] lg:hover:brightness-[0.98]"
              >
                <StockLogo ticker={item.ticker} size={30} />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
                    <p className="truncate text-[12px] font-black leading-none">
                      {item.ticker}
                    </p>
                    <p className="min-w-0 truncate text-[10px] font-bold text-[#faf6f0]/45 lg:text-[#072116]/45">
                      {item.company ?? item.category}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.08em] text-[#8a641a]">
                    {item.category}
                  </p>
                  <p
                    className={[
                      "mt-1 text-[10px] font-semibold leading-4 text-[#faf6f0]/58 lg:text-[#072116]/58",
                      constrained ? "line-clamp-1" : "line-clamp-2",
                    ].join(" ")}
                  >
                    {item.reason}
                  </p>
                  {detailed && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-4 text-[#faf6f0]/44 lg:text-[#072116]/44">
                      Risk: {item.risk}
                    </p>
                  )}
                  <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                    {item.recentMovePct != null && (
                      <span className="rounded-full bg-[#faf6f0]/6 px-2 py-0.5 text-[9px] font-bold text-[#faf6f0]/55 lg:bg-[#072116]/6 lg:text-[#072116]/55">
                        Recent move {pct(item.recentMovePct)}
                      </span>
                    )}
                    <span className="rounded-full bg-[#ddb159]/14 px-2 py-0.5 text-[9px] font-bold text-[#8a641a]">
                      {formatUpdatedLabel(item.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] font-black text-[#8a641a]">
                    {formatScore(item.score)}
                  </p>
                  <p className="mt-0.5 text-[9px] font-bold text-[#faf6f0]/45 lg:text-[#072116]/45">
                    #{item.rank ?? "—"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
