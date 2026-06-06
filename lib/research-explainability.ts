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
      detail: "Strong score, high ranking and live price data are all available.",
    };
  }

  if (score >= 8000 && rank <= 250 && hasPrice) {
    return {
      label: "Medium",
      detail: "The model has enough ranking and price context, but the signal is not top-tier.",
    };
  }

  return {
    label: "Low",
    detail: "Use this as a watchlist prompt. The signal is weaker or has less supporting context.",
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

  if (/Technology|Communication|Consumer Discretionary/i.test(sector)) {
    tags.add("Growth potential");
  }

  if (/Utilities|Consumer Staples|Health Care|Real Estate/i.test(sector)) {
    tags.add("Lower volatility watch");
  }

  if (/Utilities|Real Estate|Energy|Financials|Consumer Staples/i.test(sector)) {
    tags.add("Income watch");
  }

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

export function getFactorExplanations(stock: ExplainableStock, dailyMovePct?: number | null): FactorExplanation[] {
  const score = numericScore(stock);
  const rank = n(stock.rank, 9999);
  const sector = cleanSector(stock.sector);
  const move = Number.isFinite(dailyMovePct) ? Number(dailyMovePct) : null;
  const band = scoreBand(score);

  return [
    {
      label: "Financial strength",
      value: score >= 16000 ? "Strong" : score >= 9000 ? "Positive" : "Limited",
      detail:
        score >= 9000
          ? `${band} overall AI score suggests the company clears the model's quality checks better than most names.`
          : "The visible score is not strong enough to treat financial quality as a clear edge without deeper review.",
    },
    {
      label: "Growth potential",
      value: /Technology|Communication|Consumer Discretionary/i.test(sector) || score >= 16000 ? "Positive" : "Neutral",
      detail: /Technology|Communication|Consumer Discretionary/i.test(sector)
        ? `${sector} exposure means the stock may have more growth sensitivity than defensive sectors.`
        : "Growth is treated as neutral from the visible ranking data unless the score or sector suggests otherwise.",
    },
    {
      label: "Price value",
      value: score >= 12000 && move != null && Math.abs(move) <= 1 ? "Positive" : "Neutral",
      detail:
        score >= 12000 && move != null && Math.abs(move) <= 1
          ? "The model score is strong while the daily move is not stretched, which makes it a cleaner research setup."
          : "No direct valuation metric is shown here, so use this as a prompt to check valuation before buying.",
    },
    {
      label: "Market trend",
      value: move == null ? "Limited" : move > 1.5 ? "Strong" : move < -2 ? "Watch" : "Neutral",
      detail:
        move == null
          ? "Daily price movement is unavailable."
          : move > 1.5
            ? `The stock is up ${move.toFixed(1)}% today, giving the ranking positive short-term confirmation.`
            : move < -2
              ? `The stock is down ${Math.abs(move).toFixed(1)}% today, so check whether the move is news-driven before acting.`
              : "Daily price action is relatively controlled, so the ranking signal is not being dominated by a sharp one-day move.",
    },
    {
      label: "Risk level",
      value: rank <= 75 && score >= 16000 ? "Positive" : rank > 300 ? "Watch" : "Neutral",
      detail:
        rank <= 75 && score >= 16000
          ? "High rank and strong score reduce model risk, though position sizing still matters."
          : rank > 300
            ? "Lower-ranked names carry more model risk and should be reviewed more carefully."
            : "Risk looks balanced from the visible ranking data, but it still depends on portfolio exposure and news.",
    },
    {
      label: "Dividend profile",
      value: /Utilities|Real Estate|Energy|Financials|Consumer Staples/i.test(sector) ? "Neutral" : "Limited",
      detail: /Utilities|Real Estate|Energy|Financials|Consumer Staples/i.test(sector)
        ? `${sector} can contain income-focused names, but dividend yield still needs checking before treating it as income.`
        : "Dividend evidence is not visible in this view, so do not treat this as an income idea without checking yield and payout quality.",
    },
  ];
}

export function buildRankExplanation(stock: ExplainableStock, move?: RankMoveLike, dailyMovePct?: number | null) {
  const score = numericScore(stock);
  const rank = n(stock.rank, 0);
  const sector = cleanSector(stock.sector);
  const confidence = getModelConfidence(stock);
  const tags = getStyleTags(stock, dailyMovePct);
  const band = scoreBand(score);

  const summary = `${stock.ticker ?? "This stock"} ranks #${rank || "—"} because it has a ${band.toLowerCase()} AI score${
    score ? ` (${score.toLocaleString()})` : ""
  }, sits in ${sector}, and currently carries ${confidence.label.toLowerCase()} model confidence.`;

  const bullets = [
    `Score quality: ${band}${score ? ` at ${score.toLocaleString()}` : ""}.`,
    `Sector context: ${sector}.`,
    move?.label && move.label !== "—" ? `Rank movement: ${move.label} over the latest comparison window.` : "Rank movement: no major change detected.",
    Number.isFinite(dailyMovePct) ? `1D price move: ${Number(dailyMovePct).toFixed(1)}%.` : "1D price move: unavailable.",
    `Best use: ${tags.slice(0, 2).join(" / ")}.`,
  ];

  return { summary, bullets, confidence, tags };
}

export function buildResearchReport(stock: ExplainableStock, dailyMovePct?: number | null) {
  const score = numericScore(stock);
  const rank = n(stock.rank, 9999);
  const sector = cleanSector(stock.sector);
  const confidence = getModelConfidence(stock);
  const tags = getStyleTags(stock, dailyMovePct);
  const band = scoreBand(score);

  const bullCase =
    rank <= 75 && score >= 16000
      ? `${stock.ticker} has a top-tier ranking and ${band.toLowerCase()} score, which suggests the model sees stronger quality/trend alignment than most of the S&P 500.`
      : `${stock.ticker} has enough ranking strength to be worth researching, especially if the score is improving versus sector peers.`;

  const bearCase =
    rank > 250 || score < 9000
      ? `The ranking is not high enough to treat this as a high-conviction idea. It may be more useful as a watchlist name than an immediate portfolio addition.`
      : `The main bear case is that a strong ranking can still fail if valuation, earnings expectations or news flow turn against the stock.`;

  const keyRisks = [
    sector === "Unknown sector"
      ? "Sector context is limited, so compare against peers before relying on the ranking."
      : `${sector} exposure can create sector-specific risk. Compare the stock against peer ranks before acting.`,
    confidence.label === "Low"
      ? "Model confidence is low, so require extra confirmation from earnings, valuation and price trend."
      : "Model confidence is not a guarantee. Use position sizing and stop-loss discipline.",
    Number.isFinite(dailyMovePct) && Number(dailyMovePct) < -2
      ? "The stock is falling today, so check whether the move is caused by fresh news before adding risk."
      : "A good rank does not remove market risk or single-stock event risk.",
  ];

  return {
    bullCase,
    bearCase,
    keyRisks,
    confidence,
    tags,
    scoreBand: band,
    factors: getFactorExplanations(stock, dailyMovePct),
  };
}
