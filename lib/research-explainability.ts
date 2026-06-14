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

function rankBand(rank: number) {
  if (rank <= 25) return "elite top-25 rank";
  if (rank <= 75) return "high-conviction top-75 rank";
  if (rank <= 150) return "strong top-150 rank";
  if (rank <= 250) return "middle-of-table rank";
  if (rank <= 350) return "weaker lower-half rank";
  return "low rank versus the wider universe";
}

function dailyMoveLabel(move: number | null) {
  if (move == null) return null;
  if (move >= 3) return `price is surging ${move.toFixed(1)}% today`;
  if (move >= 1.5) return `price is up ${move.toFixed(1)}% today`;
  if (move <= -3) return `price is selling off ${Math.abs(move).toFixed(1)}% today`;
  if (move <= -1.5) return `price is down ${Math.abs(move).toFixed(1)}% today`;
  return `price action is controlled today at ${move >= 0 ? "+" : ""}${move.toFixed(1)}%`;
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

  const scoreDetail =
    score >= 25000
      ? `Elite score of ${score.toLocaleString()} is one of the clearest reasons this stock ranks highly.`
      : score >= 16000
        ? `Strong score of ${score.toLocaleString()} gives the model a solid reason to keep it high on the list.`
        : score >= 9000
          ? `Positive score of ${score.toLocaleString()} supports the rank, but it is not elite.`
          : score > 0
            ? `Score of ${score.toLocaleString()} is not strong, which is likely holding the rank back.`
            : "Score data is missing, so this rank needs extra caution.";

  const rankDetail =
    rank <= 25
      ? "Top-25 rank means the model currently sees this as one of the strongest opportunities in the covered universe."
      : rank <= 75
        ? "Top-75 rank is a high-conviction placement versus the wider list."
        : rank <= 150
          ? "Top-150 rank is still strong, but not the very highest conviction tier."
          : rank <= 250
            ? "Middle ranking means the stock has some support, but other names currently screen better."
            : "Lower ranking means the model sees weaker evidence here than in most of the universe.";

  const priceDetail =
    move == null
      ? "Daily price movement is unavailable, so the rank is leaning more heavily on score and stored model data."
      : move >= 2
        ? `Strong ${move.toFixed(1)}% daily move is giving the rank positive short-term confirmation.`
        : move > 0
          ? `Modest ${move.toFixed(1)}% daily gain supports the setup without looking too stretched.`
          : move <= -2
            ? `${Math.abs(move).toFixed(1)}% daily fall is a warning: the rank may be about a pullback opportunity, but fresh news needs checking.`
            : `Controlled ${move.toFixed(1)}% daily move means the ranking is not just chasing a one-day spike.`;

  return [
    {
      label: "AI score",
      value: score >= 16000 ? "Strong" : score >= 9000 ? "Positive" : score > 0 ? "Watch" : "Limited",
      detail: scoreDetail,
    },
    {
      label: "Rank quality",
      value: rank <= 75 ? "Strong" : rank <= 250 ? "Positive" : "Watch",
      detail: rankDetail,
    },
    {
      label: "Price confirmation",
      value: move == null ? "Limited" : move >= 1.5 ? "Strong" : move <= -2 ? "Watch" : "Neutral",
      detail: priceDetail,
    },
    {
      label: "Sector setup",
      value: /Technology|Communication|Consumer Discretionary/i.test(sector) ? "Positive" : /Utilities|Consumer Staples|Health Care|Real Estate/i.test(sector) ? "Neutral" : "Neutral",
      detail: /Technology|Communication|Consumer Discretionary/i.test(sector)
        ? `${sector} exposure can help when investors are rewarding growth and earnings upgrades.`
        : /Utilities|Consumer Staples|Health Care|Real Estate/i.test(sector)
          ? `${sector} exposure can be steadier, so the model may be valuing durability more than explosive momentum.`
          : `${sector} context is secondary here; score, rank and price confirmation are stronger clues than sector alone.`,
    },
    {
      label: "Risk read",
      value: rank <= 75 && score >= 16000 ? "Positive" : rank > 300 || score < 4500 ? "Watch" : "Neutral",
      detail:
        rank <= 75 && score >= 16000
          ? "High rank plus strong score reduces model-risk versus lower-ranked names, though position sizing still matters."
          : rank > 300 || score < 4500
            ? "Weak rank or score means this should be treated as a watchlist idea until better evidence appears."
            : "Risk looks balanced from the visible rank data, but this still needs price/news confirmation.",
    },
    {
      label: "Best use",
      value: score >= 16000 && rank <= 100 ? "Strong" : score >= 9000 ? "Positive" : "Watch",
      detail:
        score >= 16000 && rank <= 100
          ? "Best used as a serious research candidate because both rank and score are supporting it."
          : score >= 9000
            ? "Best used as a research candidate, not an automatic buy, because the signal is positive but not elite."
            : "Best used as a watchlist name because the model is not giving a strong enough reason yet.",
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
  const moveValue = Number.isFinite(dailyMovePct) ? Number(dailyMovePct) : null;

  const drivers: string[] = [];
  const cautions: string[] = [];

  if (score >= 25000) drivers.push(`an elite AI score of ${score.toLocaleString()}`);
  else if (score >= 16000) drivers.push(`a strong AI score of ${score.toLocaleString()}`);
  else if (score >= 9000) drivers.push(`a positive AI score of ${score.toLocaleString()}`);
  else if (score > 0) cautions.push(`a weak AI score of ${score.toLocaleString()}`);

  if (rank <= 25) drivers.push("a top-25 rank versus the wider universe");
  else if (rank <= 75) drivers.push("a top-75 rank");
  else if (rank <= 150) drivers.push("a still-strong top-150 rank");
  else if (rank > 300) cautions.push("a lower-half rank that signals weaker model evidence");

  if (moveValue != null) {
    if (moveValue >= 2) drivers.push(`${moveValue.toFixed(1)}% positive price confirmation today`);
    else if (moveValue > 0 && score >= 9000) drivers.push(`controlled positive price action today at +${moveValue.toFixed(1)}%`);
    else if (moveValue <= -2) cautions.push(`${Math.abs(moveValue).toFixed(1)}% downside move today that needs checking`);
  }

  if (move?.tone === "up") drivers.push(`rank momentum has improved (${move.label})`);
  if (move?.tone === "down") cautions.push(`rank momentum has weakened (${move.label})`);

  if (/Technology|Communication|Consumer Discretionary/i.test(sector) && score >= 9000) {
    drivers.push(`${sector} growth sensitivity`);
  }

  if (drivers.length === 0 && cautions.length === 0) {
    drivers.push(`${band.toLowerCase()} score band`, `${rankBand(rank)}`);
  }

  const primary = drivers.slice(0, 3).join(", ");
  const warning = cautions.slice(0, 2).join(", ");
  const summary = warning
    ? `${stock.ticker ?? "This stock"} ranks #${rank || "—"} because of ${primary || rankBand(rank)}, but the rank is being held back by ${warning}.`
    : `${stock.ticker ?? "This stock"} ranks #${rank || "—"} because of ${primary}.`;

  const bullets = [
    `Best evidence: ${primary || "no single dominant positive driver is visible in the ranking data"}.`,
    warning ? `Main caution: ${warning}.` : `Main caution: no major red flag is visible from score, rank movement or today's price move.`,
    `Score band: ${band}${score ? ` at ${score.toLocaleString()}` : ""}.`,
    move?.label && move.label !== "—" ? `Rank movement: ${move.label} over the latest comparison window.` : "Rank movement: no major change detected.",
    dailyMoveLabel(moveValue) ?? "1D price move: unavailable.",
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
