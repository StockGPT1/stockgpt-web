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

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  ROE: "Return on equity — how efficiently the company turns shareholder equity into profit.",
  ROIC: "Return on invested capital — how productively the business earns returns on the capital it uses.",
  GrossMargin: "The share of revenue left after direct production costs — a read on pricing power.",
  OperatingMargin: "Operating profit as a share of revenue — how well sales convert into profit.",
  FCFMargin: "Free cash flow as a share of revenue — how much of each sale becomes usable cash.",
  RevenueGrowth: "How quickly sales are expanding compared with peers.",
  EPSGrowth: "Growth in earnings per share — whether profit per share is improving.",
  FCFGrowth: "Growth in free cash flow — whether real cash generation is improving.",
  PE_rel: "Price-to-earnings valuation compared with sector peers.",
  EVToEBITDA_rel: "Enterprise value versus operating earnings, compared with sector peers.",
  PS_rel: "Price-to-sales valuation compared with sector peers.",
  FCFYield: "Free cash flow relative to market value — the cash return for the price paid.",
  Momentum12_1: "The price trend over the last 12 months, excluding the most recent month to avoid noise.",
  Momentum6_1: "The price trend over the last 6 months, excluding the most recent month.",
  MA_dist: "How far the price sits above or below its moving-average trend line.",
  MA_slope: "Whether the moving-average trend line itself is rising or falling.",
  DownsideVol: "How unstable negative returns have been — lower means calmer falls.",
  MaxDrawdown: "The largest recent peak-to-trough fall in the share price.",
  Beta: "How sensitive the share price is to moves in the wider market.",
  DebtToEquity: "Debt levels compared with shareholder equity — a leverage check.",
  DividendYield: "Annual dividend income relative to the share price.",
};

export function factorDescription(raw: string | undefined) {
  return (
    FACTOR_DESCRIPTIONS[canonicalFactor(raw)] ??
    "One of the ranking model's factor inputs, scored against the covered universe and sector peers."
  );
}
