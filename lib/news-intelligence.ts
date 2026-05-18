export type BaseNewsArticle = {
  id: string | number;
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  affected_tickers: string[] | string | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
};

export type StockLike = {
  ticker: string | null;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | string | null;
  price?: number | string | null;
};

export type AffectedStockInsight = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | string | null;
  price?: number | string | null;
  impactRating: number;
  matchReason: string;
  scoreEffect: string;
};

export type EnrichedNewsArticle = {
  id: string;
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
  affectedStocks: AffectedStockInsight[];
};

const COMPANY_STOP_WORDS = new Set([
  "inc",
  "inc.",
  "corp",
  "corp.",
  "corporation",
  "company",
  "co",
  "co.",
  "plc",
  "ltd",
  "ltd.",
  "class",
  "common",
  "stock",
  "holdings",
  "holding",
  "group",
  "the",
  "and",
  "services",
  "systems",
  "technologies",
  "technology",
]);

const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Information Technology": [
    "technology",
    "software",
    "semiconductor",
    "chip",
    "chips",
    "ai",
    "cloud",
    "data center",
    "cybersecurity",
    "hardware",
    "memory",
    "servers",
  ],
  Technology: [
    "technology",
    "software",
    "semiconductor",
    "chip",
    "chips",
    "ai",
    "cloud",
    "data center",
    "cybersecurity",
    "hardware",
    "memory",
    "servers",
  ],
  "Health Care": [
    "healthcare",
    "health care",
    "drug",
    "pharma",
    "biotech",
    "medicine",
    "medicare",
    "fda",
    "clinical",
    "hospital",
    "medical",
  ],
  Healthcare: [
    "healthcare",
    "health care",
    "drug",
    "pharma",
    "biotech",
    "medicine",
    "medicare",
    "fda",
    "clinical",
    "hospital",
    "medical",
  ],
  Financials: [
    "bank",
    "banks",
    "interest rates",
    "fed",
    "federal reserve",
    "credit",
    "loans",
    "insurance",
    "fintech",
    "yield",
    "capital markets",
  ],
  "Consumer Discretionary": [
    "consumer",
    "retail",
    "ecommerce",
    "e-commerce",
    "auto",
    "autos",
    "travel",
    "restaurants",
    "luxury",
    "housing",
  ],
  "Consumer Staples": [
    "consumer staples",
    "grocery",
    "food",
    "beverage",
    "household",
    "packaged goods",
    "supermarket",
  ],
  "Communication Services": [
    "advertising",
    "streaming",
    "media",
    "social media",
    "telecom",
    "broadband",
    "gaming",
    "internet",
  ],
  Industrials: [
    "industrial",
    "manufacturing",
    "aerospace",
    "defense",
    "defence",
    "logistics",
    "freight",
    "airlines",
    "rail",
    "infrastructure",
  ],
  Energy: [
    "oil",
    "gas",
    "energy",
    "opec",
    "crude",
    "lng",
    "pipeline",
    "refining",
    "renewables",
  ],
  Utilities: [
    "utilities",
    "electricity",
    "power grid",
    "grid",
    "water",
    "renewable energy",
    "rates",
  ],
  Materials: [
    "materials",
    "mining",
    "chemicals",
    "steel",
    "copper",
    "gold",
    "lithium",
    "commodities",
  ],
  "Real Estate": [
    "real estate",
    "reit",
    "property",
    "commercial property",
    "mortgage",
    "office space",
    "housing",
  ],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text: string, term: string) {
  const cleaned = term.trim().toLowerCase();

  if (!cleaned) return false;

  if (cleaned.includes(" ")) {
    return text.includes(cleaned);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(cleaned)}([^a-z0-9]|$)`, "i").test(
    text,
  );
}

export function normaliseTickers(value: BaseNewsArticle["affected_tickers"]) {
  if (Array.isArray(value)) {
    return value
      .map((ticker) => String(ticker).trim().toUpperCase())
      .filter((ticker) => ticker && ticker !== "SECTOR-WIDE");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter((ticker) => ticker && ticker !== "SECTOR-WIDE");
  }

  return [];
}

export function articleText(article: BaseNewsArticle) {
  return [
    article.title,
    article.summary,
    article.source,
    article.impact,
    article.impact_reason,
    normaliseTickers(article.affected_tickers).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function titleText(article: BaseNewsArticle) {
  return (article.title ?? "").toLowerCase();
}

function companyTerms(company: string | null) {
  if (!company) return [];

  const clean = company
    .replace(/[(),.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = clean
    .split(" ")
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3 && !COMPANY_STOP_WORDS.has(word));

  const phrase = clean.toLowerCase();

  return Array.from(new Set([phrase, ...words])).filter(Boolean);
}

function sectorTerms(sector: string | null) {
  if (!sector) return [];

  return SECTOR_KEYWORDS[sector] ?? [sector.toLowerCase()];
}

export function inferImpact(article: BaseNewsArticle) {
  const explicit = (article.impact ?? "").toLowerCase().trim();

  if (explicit === "positive" || explicit === "negative" || explicit === "neutral") {
    return explicit;
  }

  const text = articleText(article);

  const negativeWords = [
    "falls",
    "fall",
    "drops",
    "drop",
    "cuts",
    "cut",
    "misses",
    "miss",
    "lawsuit",
    "probe",
    "investigation",
    "warning",
    "recall",
    "tariff",
    "sanction",
    "ban",
    "slump",
    "downgrade",
    "weak",
    "loss",
    "losses",
    "layoff",
    "layoffs",
    "strike",
    "risk",
  ];

  const positiveWords = [
    "beats",
    "beat",
    "raises",
    "raise",
    "upgrade",
    "surge",
    "jumps",
    "jump",
    "rally",
    "record",
    "growth",
    "profit",
    "profits",
    "deal",
    "contract",
    "approval",
    "launch",
    "partnership",
    "strong",
    "expands",
  ];

  const negativeHits = negativeWords.filter((word) => containsTerm(text, word)).length;
  const positiveHits = positiveWords.filter((word) => containsTerm(text, word)).length;

  if (negativeHits > positiveHits) return "negative";
  if (positiveHits > negativeHits) return "positive";
  return "neutral";
}

export function impactStyle(impact: string | null) {
  const s = inferImpact({ impact } as BaseNewsArticle);

  if (s === "positive") {
    return {
      bg: "bg-emerald-500/12",
      text: "text-emerald-400",
      border: "border-emerald-500/25",
      label: "Positive",
    };
  }

  if (s === "negative") {
    return {
      bg: "bg-red-500/12",
      text: "text-red-400",
      border: "border-red-500/25",
      label: "Negative",
    };
  }

  return {
    bg: "bg-[#faf6f0]/8",
    text: "text-[#faf6f0]/50",
    border: "border-[#faf6f0]/12",
    label: "Neutral",
  };
}

export function formatNewsDate(dateStr: string | null) {
  if (!dateStr) return "Date unavailable";

  return new Date(dateStr).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatShortNewsDate(dateStr: string | null) {
  if (!dateStr) return "Date unavailable";

  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function displaySummary(article: BaseNewsArticle) {
  if (article.summary && article.summary.trim() && article.summary !== "No summary available.") {
    return article.summary;
  }

  if (article.impact_reason && article.impact_reason.trim()) {
    return article.impact_reason;
  }

  return "No full description is currently available for this article.";
}

export function getArticleImpactRating(article: BaseNewsArticle, stock: StockLike) {
  const ticker = String(stock.ticker ?? "").toUpperCase();
  const text = articleText(article);
  const title = titleText(article);
  const explicitTickers = normaliseTickers(article.affected_tickers);
  const company = stock.company ?? "";
  const sector = stock.sector ?? "";

  if (!ticker) {
    return {
      rating: 1,
      reason: "No stock match",
    };
  }

  if (explicitTickers.includes(ticker)) {
    return {
      rating: 10,
      reason: "Directly tagged to this stock",
    };
  }

  if (containsTerm(title, ticker)) {
    return {
      rating: 10,
      reason: "Ticker appears in headline",
    };
  }

  if (containsTerm(text, ticker)) {
    return {
      rating: 9,
      reason: "Ticker appears in article text",
    };
  }

  const terms = companyTerms(company);

  const phrase = terms[0];

  if (phrase && phrase.length >= 5 && title.includes(phrase)) {
    return {
      rating: 9,
      reason: "Company name appears in headline",
    };
  }

  const titleCompanyHits = terms.filter((term) => containsTerm(title, term));

  if (titleCompanyHits.length >= 1) {
    return {
      rating: 8,
      reason: "Company keyword appears in headline",
    };
  }

  const bodyCompanyHits = terms.filter((term) => containsTerm(text, term));

  if (bodyCompanyHits.length >= 1) {
    return {
      rating: 7,
      reason: "Company keyword appears in article",
    };
  }

  const sectorHits = sectorTerms(sector).filter((term) => containsTerm(text, term));
  const sectorTitleHits = sectorTerms(sector).filter((term) => containsTerm(title, term));

  if (sectorTitleHits.length > 0) {
    return {
      rating: 6,
      reason: `Headline is relevant to ${sector}`,
    };
  }

  if (sectorHits.length > 0) {
    return {
      rating: 4,
      reason: `Industry/sector read-through for ${sector}`,
    };
  }

  if (
    /\b(fed|federal reserve|rates|inflation|tariff|sanction|war|oil|recession|dollar|treasury|yields|geopolitical|white house|regulation)\b/i.test(
      text,
    )
  ) {
    return {
      rating: 2,
      reason: "Broad macro read-through",
    };
  }

  return {
    rating: 1,
    reason: "Low direct relevance",
  };
}

export function getScoreEffectText(
  article: BaseNewsArticle,
  stock: StockLike,
  rating: number,
) {
  const impact = inferImpact(article);
  const ticker = stock.ticker ?? "this stock";
  const score = Number(stock.score);
  const rank = Number(stock.rank);

  const scoreLabel = Number.isFinite(score)
    ? `current AI score ${Math.round(score).toLocaleString()}`
    : "current AI score unavailable";

  const rankLabel = Number.isFinite(rank) && rank > 0 ? `rank #${rank}` : "rank unavailable";

  const strength =
    rating >= 8
      ? "high-conviction catalyst"
      : rating >= 5
        ? "meaningful read-through"
        : rating >= 3
          ? "moderate watchlist item"
          : "low-level macro signal";

  if (impact === "positive") {
    return `${ticker}: ${strength}. Positive news may support the model through sentiment, momentum or earnings-expectation inputs. ${scoreLabel}; ${rankLabel}.`;
  }

  if (impact === "negative") {
    return `${ticker}: ${strength}. Negative news may pressure the model through sentiment, risk, momentum or estimate-revision inputs. ${scoreLabel}; ${rankLabel}.`;
  }

  return `${ticker}: ${strength}. Neutral/mixed story, so the score effect depends on whether the headline changes demand, margins, regulation, funding costs or market sentiment. ${scoreLabel}; ${rankLabel}.`;
}

export function getAffectedStockInsight(
  article: BaseNewsArticle,
  stock: StockLike,
): AffectedStockInsight | null {
  if (!stock.ticker) return null;

  const ratingData = getArticleImpactRating(article, stock);

  if (ratingData.rating < 2) return null;

  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    rank: stock.rank,
    score: stock.score,
    price: stock.price,
    impactRating: ratingData.rating,
    matchReason: ratingData.reason,
    scoreEffect: getScoreEffectText(article, stock, ratingData.rating),
  };
}

export function enrichArticleWithStockInsights(
  article: BaseNewsArticle,
  stocks: StockLike[],
  maxStocks = 8,
): EnrichedNewsArticle {
  const explicitTickers = normaliseTickers(article.affected_tickers);

  const insights = stocks
    .map((stock) => getAffectedStockInsight(article, stock))
    .filter((item): item is AffectedStockInsight => Boolean(item))
    .sort((a, b) => {
      const explicitA = explicitTickers.includes(a.ticker) ? 1 : 0;
      const explicitB = explicitTickers.includes(b.ticker) ? 1 : 0;

      if (explicitA !== explicitB) return explicitB - explicitA;
      if (b.impactRating !== a.impactRating) return b.impactRating - a.impactRating;

      const rankA = a.rank ?? 9999;
      const rankB = b.rank ?? 9999;

      return rankA - rankB;
    })
    .slice(0, maxStocks);

  return {
    id: String(article.id),
    title: article.title,
    summary: article.summary,
    source: article.source,
    url: article.url,
    image_url: article.image_url,
    impact: article.impact,
    impact_reason: article.impact_reason,
    published_at: article.published_at,
    affectedStocks: insights,
  };
}

export function selectRelevantNewsForStock(
  articles: BaseNewsArticle[],
  stock: StockLike,
  maxArticles = 8,
): EnrichedNewsArticle[] {
  return articles
    .map((article) => {
      const insight = getAffectedStockInsight(article, stock);

      if (!insight || insight.impactRating < 4) return null;

      return {
        id: String(article.id),
        title: article.title,
        summary: article.summary,
        source: article.source,
        url: article.url,
        image_url: article.image_url,
        impact: article.impact,
        impact_reason: article.impact_reason,
        published_at: article.published_at,
        affectedStocks: [insight],
      } satisfies EnrichedNewsArticle;
    })
    .filter((article): article is EnrichedNewsArticle => Boolean(article))
    .sort((a, b) => {
      const ratingA = a.affectedStocks[0]?.impactRating ?? 0;
      const ratingB = b.affectedStocks[0]?.impactRating ?? 0;

      if (ratingA !== ratingB) return ratingB - ratingA;

      return (
        new Date(b.published_at ?? 0).getTime() -
        new Date(a.published_at ?? 0).getTime()
      );
    })
    .slice(0, maxArticles);
}

export function getNewsInsight(article: EnrichedNewsArticle) {
  if (article.affectedStocks.length > 0) {
    const top = article.affectedStocks[0];
    return `${top.ticker} impact rating ${top.impactRating}/10 — ${top.scoreEffect}`;
  }

  if (article.impact_reason && article.impact_reason.trim()) {
    return article.impact_reason;
  }

  return "Market impact should be monitored through sector rotation, risk appetite, interest-rate expectations and earnings-expectation changes.";
}

export function getStockNewsSummary(ticker: string, articles: EnrichedNewsArticle[]) {
  if (articles.length === 0) {
    return `No recent direct company or industry news is currently linked to ${ticker}.`;
  }

  const ratings = articles
    .flatMap((article) => article.affectedStocks)
    .map((stock) => stock.impactRating);

  const maxRating = Math.max(...ratings, 1);
  const avgRating = Math.round(
    ratings.reduce((sum, rating) => sum + rating, 0) / Math.max(ratings.length, 1),
  );

  const positive = articles.filter((article) => inferImpact(article) === "positive").length;
  const negative = articles.filter((article) => inferImpact(article) === "negative").length;
  const neutral = articles.length - positive - negative;

  return `${articles.length} relevant item${articles.length === 1 ? "" : "s"} found for ${ticker}. Highest impact rating ${maxRating}/10, average ${avgRating}/10. Current mix: ${positive} positive, ${neutral} neutral, ${negative} negative.`;
}
