"use client";

import { useId, useMemo, useState } from "react";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { StockLogo } from "@/components/StockLogo";
import { HoldingLedgerRow, PortfolioExposureView } from "@/components/portfolio-workspace/PortfolioHoldingsVisuals";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import type {
  HoldingFilter,
  HoldingSort,
  HoldingsView,
  PortfolioMeta,
} from "@/components/portfolio-workspace/types";
import {
  money,
  signedMoney,
  signedPct,
  statusForHolding,
  statusTone,
  toneClass,
} from "@/components/portfolio-workspace/utils";

const FILTERS: Array<{ value: HoldingFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "oversized", label: "Oversized" },
  { value: "reviews", label: "Model reviews" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
  { value: "missing", label: "Missing prices" },
];

const SORTS: Array<{ value: HoldingSort; label: string }> = [
  { value: "value", label: "Highest value" },
  { value: "allocation", label: "Largest allocation" },
  { value: "best", label: "Best return %" },
  { value: "worst", label: "Worst return %" },
  { value: "score", label: "Highest AI score" },
  { value: "rank", label: "Best rank" },
  { value: "urgent", label: "Most urgent" },
  { value: "ticker", label: "Ticker A–Z" },
];

function urgentScore(holding: ExtendedHolding, riskTolerance: string | null) {
  const status = statusForHolding(holding, riskTolerance);
  if (status === "Price unavailable") return 100;
  if (status === "Review" || status === "Review size") return 90;
  if (status === "Oversized") return 75;
  if (status === "Under pressure") return 65;
  return holding.actionAlerts.length * 10 + holding.eventAlerts.length * 2;
}

function matchesFilter(
  holding: ExtendedHolding,
  filter: HoldingFilter,
  riskTolerance: string | null,
) {
  const status = statusForHolding(holding, riskTolerance);
  if (filter === "all") return true;
  if (filter === "oversized") return status === "Oversized" || status === "Review size";
  if (filter === "reviews") return holding.actionAlerts.length > 0 || status === "Review";
  if (filter === "gainers") return holding.totalPnLDollars > 0;
  if (filter === "losers") return holding.totalPnLDollars < 0;
  return holding.currentPrice <= 0 && holding.shares > 0;
}

function sortHoldings(
  holdings: ExtendedHolding[],
  sort: HoldingSort,
  riskTolerance: string | null,
) {
  return holdings.slice().sort((a, b) => {
    if (sort === "allocation") return b.currentAllocationPct - a.currentAllocationPct;
    if (sort === "best") return b.pnlPercent - a.pnlPercent;
    if (sort === "worst") return a.pnlPercent - b.pnlPercent;
    if (sort === "score") return b.score - a.score;
    if (sort === "rank") return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
    if (sort === "urgent") return urgentScore(b, riskTolerance) - urgentScore(a, riskTolerance);
    if (sort === "ticker") return a.ticker.localeCompare(b.ticker);
    return b.currentValue - a.currentValue;
  });
}

export function PortfolioHoldings({
  holdings,
  meta,
  onHolding,
  onAdd,
}: {
  holdings: ExtendedHolding[];
  meta: PortfolioMeta;
  onHolding: (holding: ExtendedHolding) => void;
  onAdd?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [sort, setSort] = useState<HoldingSort>("value");
  const [sector, setSector] = useState("all");
  const [view, setView] = useState<HoldingsView>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();

  const sectors = useMemo(
    () => Array.from(new Set(holdings.map((holding) => holding.sector).filter((value): value is string => Boolean(value)))).sort(),
    [holdings],
  );
  const visible = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const filtered = holdings.filter((holding) => {
      const searchable = `${holding.ticker} ${holding.company ?? ""} ${holding.sector ?? ""}`.toLowerCase();
      return (
        (!lowered || searchable.includes(lowered)) &&
        (sector === "all" || holding.sector === sector) &&
        matchesFilter(holding, filter, meta.riskTolerance)
      );
    });
    return sortHoldings(filtered, sort, meta.riskTolerance);
  }, [filter, holdings, meta.riskTolerance, query, sector, sort]);

  const missingCount = holdings.filter((holding) => holding.shares > 0 && holding.currentPrice <= 0).length;
  const activeFilterCount = Number(filter !== "all") + Number(sector !== "all");

  return (
    <div>
      <section>
        <h2 className="text-[25px] font-semibold tracking-[-0.035em] text-[#faf6f0] lg:text-[30px]">Your positions</h2>
        <p className="mt-2 text-[12px] leading-5 text-[#faf6f0]/56">
          {holdings.length} holding{holdings.length === 1 ? "" : "s"} · Returns show unrealised gains and losses on open positions.
        </p>
        {missingCount > 0 && <p className="mt-2 text-[12px] text-[#f1908d]">{missingCount} position{missingCount === 1 ? " has" : "s have"} an unavailable price.</p>}
      </section>

      {holdings.length > 0 && <section className="sg-portfolio-holdings-controls mt-5 border-b border-[#faf6f0]/8 pb-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)] lg:items-center lg:gap-4">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#faf6f0]/14 bg-transparent px-4 focus-within:border-[#ddb159]/70 focus-within:ring-2 focus-within:ring-[#ddb159]/10">
          <PortfolioIcon name="search" className="size-4 shrink-0 text-[#ddb159]" />
          <span className="sr-only">Search holdings</span>
          <input
            aria-label="Search holdings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ticker, company or sector"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/28"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="grid size-11 shrink-0 place-items-center rounded-full text-[#faf6f0]/58 hover:bg-[#faf6f0]/6 hover:text-[#faf6f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
            >
              <PortfolioIcon name="close" className="size-4" />
            </button>
          )}
        </label>

        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 lg:mt-0">
          <label className="min-w-0">
            <span className="sr-only">Sort holdings</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as HoldingSort)}
              className="h-11 w-full truncate rounded-lg border border-[#faf6f0]/14 bg-transparent px-3 text-[12px] font-semibold text-[#faf6f0] outline-none focus-visible:ring-2 focus-visible:ring-[#ddb159]/60"
            >
              {SORTS.map((item) => <option key={item.value} value={item.value} className="bg-[#08281b]">{item.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            aria-label={`Filter holdings${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ""}`}
            aria-controls={filterPanelId}
            className={`relative grid size-11 place-items-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] ${
              activeFilterCount > 0
                ? "border-[#ddb159]/55 bg-[#ddb159]/12 text-[#ddb159]"
                : "border-[#faf6f0]/14 bg-transparent text-[#faf6f0]/65"
            }`}
          >
            <PortfolioIcon name="filter" className="size-4" />
            {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#ddb159] text-[9px] font-black text-[#061b12]">{activeFilterCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => setView((value) => (value === "list" ? "map" : "list"))}
            aria-label={view === "list" ? "Show holdings map" : "Show holdings list"}
            aria-pressed={view === "map"}
            className="grid size-11 place-items-center rounded-lg border border-[#faf6f0]/14 bg-transparent text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
          >
            <PortfolioIcon name={view === "list" ? "map" : "list"} className="size-4" />
          </button>
        </div>

        {filtersOpen && (
          <div id={filterPanelId} className="mt-4 grid gap-4 border-t border-[#faf6f0]/8 pt-4 lg:col-span-2 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-end">
            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/34">Position state</p>
              <div className="sg-native-edge-portfolio-phone -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    aria-pressed={filter === item.value}
                    className={`min-h-11 shrink-0 rounded-full px-4 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] ${
                      filter === item.value
                        ? "bg-[#ddb159] text-[#061b12]"
                        : "border border-[#ddb159]/14 text-[#faf6f0]/48 hover:text-[#faf6f0]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/34">Sector</span>
              <select
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#faf6f0]/14 bg-transparent px-3 text-[12px] font-semibold text-[#faf6f0] outline-none focus-visible:ring-2 focus-visible:ring-[#ddb159]/60"
              >
                <option value="all" className="bg-[#08281b]">All sectors</option>
                {sectors.map((item) => <option key={item} value={item} className="bg-[#08281b]">{item}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={() => { setFilter("all"); setSector("all"); }}
              disabled={activeFilterCount === 0}
              className="h-11 rounded-lg border border-[#faf6f0]/14 px-4 text-[11px] font-semibold text-[#faf6f0]/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] disabled:opacity-30"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>}

      {holdings.length > 0 && <div className="mt-5 flex items-center justify-between gap-4">
        <p role="status" aria-live="polite" className="text-[12px] text-[#faf6f0]/56">
          {visible.length} of {holdings.length} positions
        </p>
        {activeFilterCount > 0 && <p className="text-[10px] font-black text-[#ddb159]">Filters active</p>}
      </div>}

      {visible.length === 0 ? (
        <div className="mt-5 border-y border-[#faf6f0]/8 py-10 text-center">
          <p className="text-[19px] font-semibold text-[#faf6f0]">{holdings.length === 0 ? "Your positions start here" : "No holdings match this view"}</p>
          <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-[#faf6f0]/56">{holdings.length === 0 ? "Add an existing investment or import your holdings to see each position here." : "Try a broader search or clear the active filters."}</p>
          {holdings.length === 0 ? onAdd && <button type="button" onClick={onAdd} data-native-haptic="medium" className="mt-5 min-h-11 rounded-full bg-[#ddb159] px-5 text-[12px] font-semibold text-[#061b12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">Add your first holding</button> : <button
            type="button"
            onClick={() => { setQuery(""); setFilter("all"); setSector("all"); }}
            className="mt-5 h-11 rounded-full border border-[#ddb159]/24 px-5 text-[12px] font-semibold text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
          >
            Reset view
          </button>}
        </div>
      ) : view === "map" ? (
        <div className="mt-5">
          <PortfolioExposureView holdings={visible} riskTolerance={meta.riskTolerance} currency={meta.currency} onSelect={onHolding} />
        </div>
      ) : (
        <>
          <div className="mt-4 border-t border-[#faf6f0]/8 lg:hidden">
            {visible.map((holding) => (
              <HoldingLedgerRow key={holding.ticker} holding={holding} currency={meta.currency} riskTolerance={meta.riskTolerance} onOpen={onHolding} />
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto border-y border-[#faf6f0]/8 bg-[#08281b] lg:block">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#08281b] text-[10px] font-semibold text-[#faf6f0]/58">
                <tr>
                  <th className="sticky left-0 bg-[#08281b] px-5 py-4">Asset</th>
                  <th className="px-4 py-4 text-right">Value</th>
                  <th className="px-4 py-4 text-right">Unrealised return</th>
                  <th className="px-4 py-4">Allocation</th>
                  <th className="px-4 py-4 text-right">AI score</th>
                  <th className="px-4 py-4 text-right">Rank</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#faf6f0]/8">
                {visible.map((holding) => {
                  const status = statusForHolding(holding, meta.riskTolerance);
                  const priceAvailable = holding.currentPrice > 0 || holding.shares <= 0;
                  return (
                    <tr key={holding.ticker} className="group h-[70px] hover:bg-[#faf6f0]/[0.025]">
                      <td className="sticky left-0 bg-[#08281b] px-5 group-hover:bg-[#0b3021]">
                        <button type="button" onClick={() => onHolding(holding)} className="flex min-h-11 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">
                          <StockLogo ticker={holding.ticker} company={holding.company} size={38} />
                          <span className="min-w-0"><span className="block max-w-[230px] truncate text-[13px] font-black text-[#faf6f0]">{holding.company || holding.ticker}</span><span className="mt-0.5 block text-[10px] font-semibold text-[#faf6f0]/36">{holding.ticker} · {holding.shares.toLocaleString("en-GB", { maximumFractionDigits: 6 })} shares</span></span>
                        </button>
                      </td>
                      <td className="px-4 text-right text-[12px] font-black tabular-nums text-[#faf6f0]">{priceAvailable ? money(holding.currentValue, meta.currency) : "—"}</td>
                      <td className={`px-4 text-right text-[11px] font-black tabular-nums ${toneClass(holding.totalPnLDollars)}`}>{priceAvailable ? `${signedMoney(holding.totalPnLDollars, meta.currency)} · ${signedPct(holding.pnlPercent)}` : "Unavailable"}</td>
                      <td className="w-[190px] px-4"><div className="flex items-center gap-3"><span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#faf6f0]/9"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#b7842f,#ddb159_55%,#f2d27a)]" style={{ width: `${Math.max(holding.currentAllocationPct > 0 ? 0.35 : 0, Math.min(100, holding.currentAllocationPct))}%` }} /></span><span className="w-12 text-right text-[10px] font-black tabular-nums text-[#faf6f0]/58">{holding.currentAllocationPct.toFixed(1)}%</span></div></td>
                      <td className="px-4 text-right text-[11px] font-black tabular-nums text-[#ddb159]">{Math.round(holding.score).toLocaleString("en-GB")}</td>
                      <td className="px-4 text-right text-[11px] font-black tabular-nums text-[#faf6f0]/58">#{holding.rank ?? "—"}</td>
                      <td className={`px-4 text-[10px] font-black ${statusTone(status)}`}>{status}</td>
                      <td className="px-4 text-right"><button type="button" onClick={() => onHolding(holding)} className="min-h-11 rounded-full border border-[#ddb159]/18 px-4 text-[10px] font-black text-[#ddb159] hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">Open</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
