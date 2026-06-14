"use client";

import { useEffect } from "react";
import type { FinancialMetrics } from "@/lib/yahoo-financials";

type FactorDiagnostic = {
  factor?: string;
  previous?: number | null;
  current?: number | null;
  change?: number | null;
};

type RankingDiagnostics = {
  diagnosis?: string | null;
  factor_contributions?: Record<string, number> | null;
  top_positive_factors?: FactorDiagnostic[] | null;
  top_negative_factors?: FactorDiagnostic[] | null;
  quality_score?: number | null;
  growth_score?: number | null;
  value_score?: number | null;
  momentum_score?: number | null;
  risk_score?: number | null;
  income_score?: number | null;
  factor_coverage?: number | null;
};

type RankingRow = {
  rank?: number | null;
  score?: number | null;
  momentum?: number | null;
  pe?: number | null;
  risk?: number | null;
  factor_coverage?: number | null;
  data_confidence?: string | null;
};

const staleWhyRankPatterns = [
  "rank context from live financial metrics",
  "52-week range",
  "price is around",
];

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function num(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function signed(value: number, digits = 3) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function multiple(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
}

function friendlyFactorName(raw: string | undefined) {
  const factor = String(raw ?? "").replace(/_z$/, "");
  const names: Record<string, string> = {
    ROIC: "ROIC",
    ROE: "ROE",
    GrossMargin: "gross margin",
    OperatingMargin: "operating margin",
    FCFMargin: "free-cash-flow margin",
    RevenueGrowth: "revenue growth",
    EPSGrowth: "EPS growth",
    FCFGrowth: "free-cash-flow growth",
    PE_rel: "sector-adjusted P/E",
    EVToEBITDA_rel: "sector-adjusted EV/EBITDA",
    PS_rel: "sector-adjusted price/sales",
    FCFYield: "free-cash-flow yield",
    Momentum12_1: "12-month momentum",
    Momentum6_1: "6-month momentum",
    MA_dist: "price above moving average",
    MA_slope: "rising moving average",
    DownsideVol: "lower downside volatility",
    MaxDrawdown: "controlled drawdown",
    Beta: "lower beta",
    DebtToEquity: "lower debt-to-equity",
    DividendYield: "dividend yield",
  };
  return names[factor] ?? factor.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function contributionDrivers(diagnostics: RankingDiagnostics | null) {
  const contributions = diagnostics?.factor_contributions ?? {};
  const rows = Object.entries(contributions)
    .map(([factor, value]) => ({ factor, current: num(value) ?? 0 }))
    .filter((item) => item.current > 0.0005)
    .sort((a, b) => b.current - a.current);

  if (rows.length) return rows.slice(0, 4);

  return (diagnostics?.top_positive_factors ?? [])
    .map((item) => ({ factor: item.factor ?? "", current: num(item.current) ?? num(item.change) ?? 0 }))
    .filter((item) => item.current > 0.0005)
    .sort((a, b) => b.current - a.current)
    .slice(0, 4);
}

function isFavourableMetricCard(label: string, value: number | string | null) {
  if (value == null) return false;
  if (label === "RSI") {
    const n = num(value);
    return n != null && n >= 50 && n < 70;
  }
  if (label === "MACD") return value === "bullish" || value === "bullish_cross";
  if (label === "6M trend") return (num(value) ?? 0) > 0;
  if (label === "P/E") return (num(value) ?? 0) > 0;
  if (label === "EPS") return (num(value) ?? 0) > 0;
  return true;
}

function diagnosticSummary(
  ticker: string,
  diagnostics: RankingDiagnostics | null,
  metrics: FinancialMetrics | null,
  ranking: RankingRow | null,
) {
  const drivers = contributionDrivers(diagnostics);
  const parts: string[] = [];

  if (drivers.length) {
    parts.push(
      drivers
        .slice(0, 3)
        .map((item) => `${friendlyFactorName(item.factor)} (${signed(item.current)})`)
        .join(", "),
    );
  }

  const pe = num(ranking?.pe) ?? num(metrics?.forwardPE) ?? num(metrics?.trailingPE);
  const eps = num(metrics?.epsForward) ?? num(metrics?.epsTrailingTwelveMonths);
  const sixMonth = num(metrics?.sixMonthChangePct);
  const rsi = num(metrics?.rsi14);

  if (eps != null && eps > 0) parts.push(`positive EPS (${eps.toFixed(2)})`);
  if (pe != null && pe > 0) parts.push(`P/E ${multiple(pe)}`);
  if (sixMonth != null && sixMonth > 0) parts.push(`6M trend ${signedPct(sixMonth)}`);
  if (rsi != null && rsi >= 50 && rsi < 70) parts.push(`RSI ${rsi.toFixed(1)}`);
  if (metrics?.macdSignal === "bullish_cross") parts.push("MACD bullish cross");
  else if (metrics?.macdSignal === "bullish") parts.push("MACD bullish");

  const unique = Array.from(new Set(parts)).slice(0, 4);
  if (unique.length) {
    return `${ticker} ranks here because the ranking engine is seeing ${unique.join("; ")}.`;
  }

  return `${ticker} ranks here based on the stored StockGPT score and available factor inputs; no negative or neutral indicators are being shown as support.`;
}

function makeMetricCard(labelText: string, valueText: string, detailText: string) {
  const card = document.createElement("div");
  card.className = "rounded-xl border border-[#072116]/8 bg-[#072116]/[0.025] p-2.5";

  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-2";

  const label = document.createElement("p");
  label.className = "truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/45";
  label.textContent = labelText;

  const chip = document.createElement("span");
  chip.className = "shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-0.5 text-[8px] font-black text-[#8a641a]";
  chip.textContent = valueText;

  const detail = document.createElement("p");
  detail.className = "mt-1 text-[10px] font-semibold leading-4 text-[#072116]/58";
  detail.textContent = detailText;

  row.append(label, chip);
  card.append(row, detail);
  return card;
}

function diagnosticCards(diagnostics: RankingDiagnostics | null, metrics: FinancialMetrics | null, ranking: RankingRow | null) {
  const cards: HTMLElement[] = [];
  const drivers = contributionDrivers(diagnostics);

  drivers.forEach((item) => {
    cards.push(makeMetricCard(
      friendlyFactorName(item.factor),
      signed(item.current),
      `This was one of the largest positive factor contributions in the ranking engine for this ticker.`,
    ));
  });

  const pe = num(ranking?.pe) ?? num(metrics?.forwardPE) ?? num(metrics?.trailingPE);
  if (isFavourableMetricCard("P/E", pe)) {
    cards.push(makeMetricCard("P/E", multiple(pe!), `P/E context used for valuation. Sector-adjusted valuation contributes when it screens favourably.`));
  }

  const eps = num(metrics?.epsForward) ?? num(metrics?.epsTrailingTwelveMonths);
  if (isFavourableMetricCard("EPS", eps)) {
    cards.push(makeMetricCard("EPS", eps!.toFixed(2), `Positive EPS gives the ranking engine earnings support where data is available.`));
  }

  const rsi = num(metrics?.rsi14);
  if (isFavourableMetricCard("RSI", rsi)) {
    cards.push(makeMetricCard("RSI", rsi!.toFixed(1), `RSI is constructive but not overbought.`));
  }

  if (isFavourableMetricCard("MACD", metrics?.macdSignal ?? null)) {
    cards.push(makeMetricCard("MACD", String(metrics!.macdSignal).replace(/_/g, " "), `MACD is positive, so it is included as supporting chart context.`));
  }

  const sixMonth = num(metrics?.sixMonthChangePct) ?? num(ranking?.momentum);
  if (isFavourableMetricCard("6M trend", sixMonth)) {
    cards.push(makeMetricCard("Trend", signedPct(sixMonth!), `Positive price trend is included because it is favourable to the setup.`));
  }

  return cards.length ? cards.slice(0, 8) : [makeMetricCard("Ranking factors", "Loading", "Opening this row fetches the strongest available positive ranking drivers.")];
}

function detailsContainsStaleCopy(details: HTMLDetailsElement) {
  const text = details.textContent?.toLowerCase() ?? "";
  return staleWhyRankPatterns.some((pattern) => text.includes(pattern));
}

async function patchDetails(details: HTMLDetailsElement, force = false) {
  if (details.dataset.stockgptFinancialLoading === "true") return;
  if (!force && details.dataset.stockgptFinancialPatched === "true" && !detailsContainsStaleCopy(details)) return;

  const link = details.parentElement?.querySelector<HTMLAnchorElement>('a[href^="/stock/"]');
  const ticker = cleanTicker(link?.getAttribute("href")?.split("/stock/")[1] ?? link?.textContent);
  if (!ticker) return;

  details.dataset.stockgptFinancialLoading = "true";
  try {
    const response = await fetch(`/api/rankings/financial-metrics?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } });
    const data = response.ok ? await response.json() : null;
    const metrics = (data?.metrics ?? null) as FinancialMetrics | null;
    const diagnostics = (data?.diagnostics ?? null) as RankingDiagnostics | null;
    const ranking = (data?.ranking ?? null) as RankingRow | null;
    const summary = details.querySelector<HTMLParagraphElement>("summary + p");
    const grid = details.querySelector<HTMLElement>("summary + p + div");

    details.dataset.stockgptDiagnosticsOwner = "true";
    if (summary) summary.textContent = diagnosticSummary(ticker, diagnostics, metrics, ranking);
    if (grid) grid.replaceChildren(...diagnosticCards(diagnostics, metrics, ranking));
    details.dataset.stockgptFinancialPatched = "true";
  } finally {
    delete details.dataset.stockgptFinancialLoading;
  }
}

export function RankingsFinancialWhyPatch() {
  useEffect(() => {
    function onToggle(event: Event) {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      const summary = details.querySelector("summary")?.textContent?.toLowerCase() ?? "";
      if (!summary.includes("why this rank")) return;
      void patchDetails(details, true);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const details = target?.closest?.("details") as HTMLDetailsElement | null;
        if (!details || !details.open) continue;
        const summary = details.querySelector("summary")?.textContent?.toLowerCase() ?? "";
        if (!summary.includes("why this rank")) continue;
        if (detailsContainsStaleCopy(details)) void patchDetails(details, true);
      }
    });

    document.addEventListener("toggle", onToggle, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      document.removeEventListener("toggle", onToggle, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
