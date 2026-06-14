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

function canonicalFactor(raw: string | undefined) {
  return String(raw ?? "").replace(/_z$/, "");
}

function friendlyFactorName(raw: string | undefined) {
  const factor = canonicalFactor(raw);
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

function factorMeaning(raw: string | undefined) {
  const factor = canonicalFactor(raw);
  const meanings: Record<string, string> = {
    ROE: "ROE means return on equity. It measures how efficiently a company turns shareholder equity into profit; a positive ranking contribution means profitability screens well versus peers.",
    ROIC: "ROIC means return on invested capital. It measures how productively the company earns returns on the capital used in the business; strong ROIC points to a higher-quality operator.",
    GrossMargin: "Gross margin is the share of revenue left after direct costs. A positive contribution suggests the company has pricing power or efficient production before overheads.",
    OperatingMargin: "Operating margin shows operating profit as a share of revenue. A positive contribution means the core business is converting sales into profit well.",
    FCFMargin: "Free-cash-flow margin measures cash generated after capital spending as a share of revenue. Positive contribution means the business is turning sales into usable cash.",
    RevenueGrowth: "Revenue growth shows whether sales are expanding. A positive contribution means the model sees stronger top-line growth than many peers.",
    EPSGrowth: "EPS growth means earnings-per-share growth. It shows whether profit per share is improving, which can support a higher ranking when positive.",
    FCFGrowth: "Free-cash-flow growth tracks whether usable cash generation is improving. Positive contribution means the company is expanding cash output, not just accounting earnings.",
    PE_rel: "Sector-adjusted P/E compares price-to-earnings valuation with peers. A positive contribution means the stock looks more attractive on earnings valuation after sector context.",
    EVToEBITDA_rel: "EV/EBITDA compares enterprise value with operating earnings before depreciation and amortisation. A positive contribution means valuation looks favourable versus peers on this measure.",
    PS_rel: "Price/sales compares market value with revenue. A positive contribution means the stock screens favourably on sales valuation for its sector.",
    FCFYield: "Free-cash-flow yield compares cash generation with market value. A higher positive contribution means investors are getting more cash flow for the price paid.",
    Momentum12_1: "12-month momentum excludes the most recent month to avoid short-term noise. A positive contribution means the longer-term price trend has been strong.",
    Momentum6_1: "6-month momentum excludes the most recent month. A positive contribution means medium-term trend strength is helping the rank.",
    MA_dist: "Distance above moving average measures how far price is above its trend line. A positive contribution means price is trading constructively above trend without relying only on one-day movement.",
    MA_slope: "Moving-average slope measures whether the trend line itself is rising. A positive contribution means the underlying price trend is improving.",
    DownsideVol: "Downside volatility measures how unstable negative returns have been. A positive contribution means downside swings look relatively controlled.",
    MaxDrawdown: "Max drawdown measures the biggest recent fall from peak to trough. A positive contribution means recent drawdowns have been more contained.",
    Beta: "Beta measures sensitivity to the wider market. A positive contribution here means market sensitivity is helping rather than hurting the risk sleeve.",
    DebtToEquity: "Debt-to-equity compares debt with shareholder equity. A positive contribution means leverage looks more manageable versus peers.",
    DividendYield: "Dividend yield compares annual dividend income with share price. A positive contribution means income support is helping the ranking where relevant.",
  };

  return meanings[factor] ?? `${friendlyFactorName(raw)} contributed positively to the ranking engine. This means the metric screened favourably versus the covered universe or sector peers.`;
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
      factorMeaning(item.factor),
    ));
  });

  const pe = num(ranking?.pe) ?? num(metrics?.forwardPE) ?? num(metrics?.trailingPE);
  if (isFavourableMetricCard("P/E", pe)) {
    cards.push(makeMetricCard("P/E", multiple(pe!), `P/E means price-to-earnings. It compares the share price with earnings per share; a favourable P/E helps when valuation looks reasonable against earnings and peers.`));
  }

  const eps = num(metrics?.epsForward) ?? num(metrics?.epsTrailingTwelveMonths);
  if (isFavourableMetricCard("EPS", eps)) {
    cards.push(makeMetricCard("EPS", eps!.toFixed(2), `EPS means earnings per share. Positive EPS shows the company is profitable on a per-share basis, which supports the rank when earnings quality is favourable.`));
  }

  const rsi = num(metrics?.rsi14);
  if (isFavourableMetricCard("RSI", rsi)) {
    cards.push(makeMetricCard("RSI", rsi!.toFixed(1), `RSI means relative strength index. A constructive RSI between 50 and 70 suggests positive momentum without looking heavily overbought.`));
  }

  if (isFavourableMetricCard("MACD", metrics?.macdSignal ?? null)) {
    cards.push(makeMetricCard("MACD", String(metrics!.macdSignal).replace(/_/g, " "), `MACD means moving average convergence/divergence. A bullish reading suggests momentum is turning or staying positive.`));
  }

  const sixMonth = num(metrics?.sixMonthChangePct) ?? num(ranking?.momentum);
  if (isFavourableMetricCard("6M trend", sixMonth)) {
    cards.push(makeMetricCard("Trend", signedPct(sixMonth!), `Six-month trend measures medium-term price progress. A positive reading helps when the stock is showing sustained momentum.`));
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
