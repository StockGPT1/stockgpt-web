/**
 * Human labels for ranking-engine factor codes. Pure functions, safe in
 * client components. Kept in sync with the meanings used by the
 * rankings "why" surfaces.
 */

export function canonicalFactor(raw: string | undefined) {
  return String(raw ?? "").replace(/_z$/, "");
}

const FRIENDLY_FACTOR_NAMES: Record<string, string> = {
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
  MA_dist: "price vs moving average",
  MA_slope: "moving-average trend",
  DownsideVol: "downside volatility",
  MaxDrawdown: "drawdown control",
  Beta: "market beta",
  DebtToEquity: "debt-to-equity",
  DividendYield: "dividend yield",
};

export function friendlyFactorName(raw: string | undefined) {
  const factor = canonicalFactor(raw);
  return (
    FRIENDLY_FACTOR_NAMES[factor] ??
    factor.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")
  );
}

export function sentenceCaseFactor(raw: string | undefined) {
  const name = friendlyFactorName(raw);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
