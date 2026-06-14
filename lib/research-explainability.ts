export type ExplainableStock = {
  ticker: string | null;
  company?: string | null;
  sector?: string | null;
  rank?: number | null;
  score?: number | string | null;
  price?: number | string | null;
};

export type RankMoveLike = {
  label: string;
  tone: "up" | "down" | "flat" | "none";
  title?: string;
};

export type FactorExplanation = {
  label: string;
  value: "Strong" | "Positive" | "Neutral" | "Watch" | "Limited";
  detail: string;
};

export type ModelConfidence = {
  label: "High" | "Medium" | "Low";
  detail: string;
};

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanSector(sector?: string | null) {
  return sector?.trim() || "Unknown sector";
}

export function numericScore(stock: ExplainableStock) {
  return n(stock.score, 0);
}

export function numericPrice(stock: ExplainableStock) {
  return n(stock.price, 0);
}

export function scoreBand(score: number) {
  if (score >= 25000) return "Elite";
  if (score >= 16000) return "Strong";
  if (score >= 9000) return "Positive";
  if (score >= 4500) return "Mixed";
  return "Weak";
}

export function getModelConfidence(stock: ExplainableStock): ModelConfidence {
  const score = numericScore(stock);
  const rank = n(stock.rank, 9999);
  const hasPrice = numericPrice(stock) > 0;

  if (score >= 16000 && rank <= 75 && hasPrice) {
    return {
      label: "High",
      detail: "High rank, score and live price are available. See factor diagnostics for the actual drivers.",
    };
  }

  if (score >= 8000 && rank <= 250 && hasPrice) {
    return {
      label: "Medium",
      detail: "The ranking has enough context, but factor diagnostics should be checked before interpreting the rank.",
    };
  }

  return {
    label: "Low",
    detail: "Use this as a watchlist prompt until factor diagnostics and price context improve.",
  };
}

export function confidenceClassName(label: ModelConfidence["label"]) {
  if (label === "High") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (label === "Medium") return "border-[#ddb159]/30 bg-[#ddb159]/12 text-[#ddb159]";
  return "border-red-400/30 bg-red-500/10 text-red-200";
}

export function lightConfidenceClassName(label: ModelConfidence["label"]) {
  if (label === "High") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (label === "Medium") return "border-[#ddb159]/30 bg-[#ddb159]/18 text-[#8a641a]";
  return "border-red-500/20 bg-red-500/10 text-red-700";
}

export function getStyleTags(stock: ExplainableStock, dailyMovePct?: number | null) {
  const sector = cleanSector(stock.sector);
  const score = numericScore(stock);
  const rank = n(stock.rank, 9999);
  const move = Number.isFinite(dailyMovePct) ? Number(dailyMovePct) : 0;
  const tags = new Set<string>();

  if (score >= 16000 && rank <= 100) tags.add("High conviction");
  if (score >= 9000 && rank <= 250) tags.add("Quality signal");
  if (move >= 1.5) tags.add("Positive momentum");
  if (move <= -2) tags.add("Pullback watch");
  if (/Technology|Communication|Consumer Discretionary/i.test(sector)) tags.add("Growth potential");
  if (/Utilities|Consumer Staples|Health Care|Real Estate/i.test(sector)) tags.add("Lower volatility watch");
  if (/Utilities|Real Estate|Energy|Financials|Consumer Staples/i.test(sector)) tags.add("Income watch");
  if (score >= 12000 && Math.abs(move) <= 1) tags.add("Value/reversion watch");
  if (tags.size === 0) tags.add("Research watchlist");

  return Array.from(tags).slice(0, 4);
}

export function matchesScoreFilter(stock: ExplainableStock, filter: string) {
  if (!filter || filter === "all") return true;
  const score = numericScore(stock);

  if (filter === "elite") return score >= 25000;
  if (filter === "strong") return score >= 16000;
  if (filter === "positive") return score >= 9000;
  if (filter === "mixed") return score >= 4500 && score < 9000;
  if (filter === "weak") return score > 0 && score < 4500;

  return true;
}

export function matchesPriceMoveFilter(changePct: number | null | undefined, filter: string) {
  if (!filter || filter === "all") return true;
  if (!Number.isFinite(changePct)) return filter === "unknown";
  const move = Number(changePct);

  if (filter === "up") return move > 0;
  if (filter === "down") return move < 0;
  if (filter === "big-up") return move >= 2;
  if (filter === "big-down") return move <= -2;
  if (filter === "flat") return Math.abs(move) < 0.75;

  return true;
}

export function matchesStyleFilter(stock: ExplainableStock, dailyMovePct: number | null | undefined, filter: string) {
  if (!filter || filter === "all") return true;
  const tags = getStyleTags(stock, dailyMovePct).map((tag) => tag.toLowerCase());
  const sector = cleanSector(stock.sector);

  if (filter === "low-risk") return tags.some((tag) => tag.includes("lower volatility"));
  if (filter === "growth") return tags.some((tag) => tag.includes("growth"));
  if (filter === "value") return tags.some((tag) => tag.includes("value"));
  if (filter === "income") return tags.some((tag) => tag.includes("income"));
  if (filter === "momentum") return tags.some((tag) => tag.includes("momentum"));
  if (filter === "pullback") return tags.some((tag) => tag.includes("pullback"));
  if (filter === "defensive") return /Utilities|Consumer Staples|Health Care/i.test(sector);

  return true;
}

export function matchesConfidenceFilter(stock: ExplainableStock, filter: string) {
  if (!filter || filter === "all") return true;
  return getModelConfidence(stock).label.toLowerCase() === filter;
}

export function getFactorExplanations(_stock: ExplainableStock, _dailyMovePct?: number | null): FactorExplanation[] {
  return [
    {
      label: "Factor diagnostics",
      value: "Limited",
      detail: "Open this dropdown to load the actual ranking factor diagnostics from the ranking engine.",
    },
  ];
}

export function buildRankExplanation(stock: ExplainableStock, _move?: RankMoveLike, _dailyMovePct?: number | null) {
  const confidence = getModelConfidence(stock);
  const tags = getStyleTags(stock, _dailyMovePct);

  return {
    summary: `${stock.ticker ?? "This stock"}: loading actual ranking factor diagnostics from the ranking engine.`,
    bullets: ["Loading factor diagnostics."],
    confidence,
    tags,
  };
}

export function buildResearchReport(stock: ExplainableStock, dailyMovePct?: number | null) {
  const confidence = getModelConfidence(stock);
  const tags = getStyleTags(stock, dailyMovePct);
  const band = scoreBand(numericScore(stock));

  return {
    bullCase: "Use the ranking factor diagnostics for the actual drivers behind this rank.",
    bearCase: "A high rank is not a buy instruction; review the underlying factor diagnostics and current news before acting.",
    keyRisks: [
      "Rankings are research prompts, not financial advice.",
      "Factor diagnostics can change as fundamentals, price trend and risk inputs update.",
      "Market and single-stock event risk still apply.",
    ],
    confidence,
    tags,
    scoreBand: band,
    factors: getFactorExplanations(stock, dailyMovePct),
  };
}
