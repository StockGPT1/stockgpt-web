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

export type NewsArticleDisplayLike = {
  id?: string | number;
  title: string | null;
  summary: string | null;
  source: string | null;
  url?: string | null;
  image_url?: string | null;
  affected_tickers?: string[] | string | null;
  affectedStocks?: AffectedStockInsight[];
  impact: string | null;
  impact_reason: string | null;
  published_at?: string | null;
};

type RatingResult = {
  rating: number;
  reason: string;
};

type IndustryTheme = {
  name: string;
  terms: string[];
  tickers: string[];
  rating: number;
  reason: string;
};

const COMPANY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "company",
  "co",
  "plc",
  "ltd",
  "limited",
  "class",
  "common",
  "stock",
  "holdings",
  "holding",
  "group",
  "ordinary",
  "shares",
  "systems",
  "services",
  "technologies",
  "technology",
  "international",
  "global",
  "industries",
]);

const GENERIC_COMPANY_TERMS = new Set([
  "american",
  "united",
  "first",
  "general",
  "new",
  "old",
  "public",
  "national",
  "international",
  "global",
  "capital",
  "financial",
  "energy",
  "digital",
  "data",
  "health",
  "medical",
  "consumer",
  "industrial",
  "materials",
  "resources",
  "realty",
]);

const AMBIGUOUS_TICKERS = new Set([
  "A",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "K",
  "L",
  "M",
  "O",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "ALL",
  "AN",
  "ARE",
  "AT",
  "BALL",
  "BE",
  "BEN",
  "BRO",
  "CAN",
  "CAT",
  "COO",
  "DAY",
  "DD",
  "EL",
  "FAST",
  "FOX",
  "HAS",
  "HE",
  "ICE",
  "IT",
  "KEY",
  "LOW",
  "MA",
  "MO",
  "NOW",
  "ON",
  "OR",
  "PARA",
  "PAYC",
  "PNR",
  "POOL",
  "SEE",
  "SO",
  "TAP",
  "TECH",
  "TEL",
  "TXT",
  "URI",
  "V",
  "WAT",
]);

const MARKET_RELEVANCE_TERMS = [
  "stock",
  "stocks",
  "share",
  "shares",
  "equity",
  "equities",
  "investor",
  "investors",
  "market",
  "markets",
  "nasdaq",
  "nyse",
  "dow",
  "s&p",
  "s&p 500",
  "sp500",
  "earnings",
  "revenue",
  "profit",
  "profits",
  "margin",
  "margins",
  "guidance",
  "forecast",
  "outlook",
  "analyst",
  "upgrade",
  "downgrade",
  "price target",
  "buy rating",
  "sell rating",
  "sec",
  "ipo",
  "dividend",
  "buyback",
  "merger",
  "acquisition",
  "acquires",
  "acquired",
  "deal",
  "antitrust",
  "lawsuit",
  "probe",
  "investigation",
  "regulator",
  "regulation",
  "fda",
  "approval",
  "recall",
  "tariff",
  "sanction",
  "fed",
  "federal reserve",
  "interest rate",
  "interest rates",
  "inflation",
  "treasury",
  "yield",
  "yields",
  "oil",
  "crude",
  "opec",
  "gold",
  "copper",
  "semiconductor",
  "chip",
  "chips",
  "ai chip",
  "data center",
  "cloud",
  "cybersecurity",
];

const BUSINESS_EVENT_TERMS = [
  "earnings",
  "revenue",
  "profit",
  "profits",
  "margin",
  "guidance",
  "forecast",
  "outlook",
  "upgrade",
  "downgrade",
  "price target",
  "merger",
  "acquisition",
  "acquires",
  "acquired",
  "deal",
  "sale",
  "sells",
  "selling",
  "spinoff",
  "ipo",
  "layoffs",
  "cuts",
  "recall",
  "lawsuit",
  "probe",
  "investigation",
  "approval",
  "ban",
  "tariff",
  "sanction",
  "regulation",
  "antitrust",
  "contract",
  "partnership",
  "launch",
  "expansion",
];

const POSITIVE_WORDS = [
  "beats",
  "beat",
  "raises",
  "raise",
  "upgrade",
  "upgraded",
  "surge",
  "surges",
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
  "approved",
  "launch",
  "partnership",
  "strong",
  "expands",
  "wins",
  "outperform",
];

const NEGATIVE_WORDS = [
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
  "downgraded",
  "weak",
  "loss",
  "losses",
  "layoff",
  "layoffs",
  "strike",
  "risk",
  "pressure",
  "decline",
  "declines",
];

const INDUSTRY_THEMES: IndustryTheme[] = [
  {
    name: "AI chips and semiconductors",
    terms: [
      "semiconductor",
      "semiconductors",
      "chip",
      "chips",
      "gpu",
      "ai chip",
      "ai chips",
      "accelerator",
      "accelerators",
      "foundry",
      "wafer",
      "memory chip",
      "hbm",
      "data center chip",
    ],
    tickers: [
      "NVDA",
      "AMD",
      "AVGO",
      "QCOM",
      "INTC",
      "MU",
      "MRVL",
      "ON",
      "TXN",
      "ADI",
      "MCHP",
      "AMAT",
      "LRCX",
      "KLAC",
      "TER",
      "MPWR",
      "NXPI",
      "SWKS",
      "QRVO",
    ],
    rating: 6,
    reason: "Semiconductor industry read-through",
  },
  {
    name: "data centers, cloud and enterprise software",
    terms: [
      "cloud",
      "data center",
      "data centres",
      "data centers",
      "enterprise software",
      "cybersecurity",
      "saas",
      "server",
      "servers",
      "ai infrastructure",
    ],
    tickers: [
      "MSFT",
      "AMZN",
      "GOOGL",
      "META",
      "ORCL",
      "CRM",
      "NOW",
      "ADBE",
      "PANW",
      "CRWD",
      "ANET",
      "DELL",
      "HPE",
      "IBM",
    ],
    rating: 5,
    reason: "Cloud/software infrastructure read-through",
  },
  {
    name: "memory and storage",
    terms: [
      "memory",
      "dram",
      "nand",
      "flash storage",
      "hard drive",
      "hard drives",
      "ssd",
      "storage",
      "data storage",
    ],
    tickers: ["MU", "WDC", "STX", "SNDK"],
    rating: 6,
    reason: "Memory/storage industry read-through",
  },
  {
    name: "banks, rates and credit",
    terms: [
      "bank",
      "banks",
      "banking",
      "loan",
      "loans",
      "credit",
      "deposit",
      "deposits",
      "net interest income",
      "interest rates",
      "fed",
      "federal reserve",
      "yield curve",
      "capital markets",
    ],
    tickers: [
      "JPM",
      "BAC",
      "WFC",
      "C",
      "GS",
      "MS",
      "PNC",
      "USB",
      "TFC",
      "COF",
      "AXP",
      "BK",
      "STT",
    ],
    rating: 5,
    reason: "Banking/credit read-through",
  },
  {
    name: "energy and oil",
    terms: [
      "oil",
      "crude",
      "brent",
      "wti",
      "opec",
      "gas",
      "lng",
      "pipeline",
      "refinery",
      "refining",
      "drilling",
    ],
    tickers: [
      "XOM",
      "CVX",
      "COP",
      "EOG",
      "SLB",
      "MPC",
      "PSX",
      "VLO",
      "KMI",
      "OKE",
      "WMB",
    ],
    rating: 5,
    reason: "Energy commodity read-through",
  },
  {
    name: "healthcare, pharma and biotech",
    terms: [
      "fda",
      "drug",
      "drugs",
      "medicine",
      "pharma",
      "biotech",
      "clinical trial",
      "medicare",
      "hospital",
      "healthcare",
      "health care",
      "vaccine",
      "therapy",
    ],
    tickers: [
      "LLY",
      "JNJ",
      "MRK",
      "ABBV",
      "PFE",
      "BMY",
      "AMGN",
      "GILD",
      "REGN",
      "VRTX",
      "ISRG",
      "MDT",
      "SYK",
      "TMO",
      "DHR",
      "ABT",
      "UNH",
      "HUM",
      "CI",
      "CVS",
    ],
    rating: 5,
    reason: "Healthcare/pharma read-through",
  },
  {
    name: "autos and electric vehicles",
    terms: [
      "auto",
      "autos",
      "automaker",
      "automakers",
      "vehicle",
      "vehicles",
      "car",
      "cars",
      "ev",
      "electric vehicle",
      "electric vehicles",
      "battery",
      "batteries",
      "charging",
      "deliveries",
    ],
    tickers: ["TSLA", "GM", "F"],
    rating: 5,
    reason: "Auto/EV industry read-through",
  },
  {
    name: "apparel and specialist retail",
    terms: [
      "fashion",
      "apparel",
      "clothing",
      "retail",
      "retailer",
      "retailers",
      "luxury",
      "sportswear",
      "sneakers",
      "footwear",
      "fast fashion",
      "department store",
    ],
    tickers: [
      "NKE",
      "LULU",
      "TJX",
      "ROST",
      "TPR",
      "RL",
      "VFC",
      "BBY",
      "TGT",
      "WMT",
      "COST",
      "HD",
      "LOW",
    ],
    rating: 4,
    reason: "Retail/apparel read-through",
  },
  {
    name: "travel, airlines and leisure",
    terms: [
      "airline",
      "airlines",
      "travel",
      "hotel",
      "hotels",
      "cruise",
      "booking",
      "tourism",
      "leisure",
    ],
    tickers: ["DAL", "UAL", "AAL", "LUV", "MAR", "HLT", "BKNG", "RCL", "CCL"],
    rating: 4,
    reason: "Travel/leisure read-through",
  },
  {
    name: "defence and aerospace",
    terms: [
      "defense",
      "defence",
      "aerospace",
      "missile",
      "military",
      "pentagon",
      "war",
      "weapons",
      "aircraft",
      "jet",
      "jets",
    ],
    tickers: ["LMT", "RTX", "NOC", "GD", "BA", "TXT", "HWM"],
    rating: 5,
    reason: "Defence/aerospace read-through",
  },
  {
    name: "housing, mortgages and real estate",
    terms: [
      "housing",
      "mortgage",
      "mortgages",
      "homebuilder",
      "homebuilders",
      "commercial real estate",
      "office property",
      "reit",
      "property",
      "rents",
    ],
    tickers: [
      "PLD",
      "AMT",
      "EQIX",
      "SPG",
      "O",
      "DLR",
      "WELL",
      "PSA",
      "AVB",
      "EQR",
      "DHI",
      "LEN",
      "PHM",
    ],
    rating: 4,
    reason: "Real estate/housing read-through",
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normaliseText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function articleCoreText(article: NewsArticleDisplayLike) {
  return [article.title, article.summary].filter(Boolean).join(" ");
}

function articleCoreTextLower(article: NewsArticleDisplayLike) {
  return normaliseText(articleCoreText(article));
}

function articleTitleLower(article: NewsArticleDisplayLike) {
  return normaliseText(article.title);
}

function containsTerm(text: string, term: string) {
  const cleaned = normaliseText(term);

  if (!cleaned) return false;

  if (cleaned.includes(" ")) {
    const pattern = cleaned
      .split(/\s+/)
      .map((part) => escapeRegExp(part))
      .join("\\s+");

    return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, "i").test(
      text,
    );
  }

  return new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(cleaned)}([^a-z0-9]|$)`,
    "i",
  ).test(text);
}

function countTermHits(text: string, terms: string[]) {
  return terms.filter((term) => containsTerm(text, term)).length;
}

export function normaliseTickers(
  value: BaseNewsArticle["affected_tickers"] | undefined,
) {
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

function affectedStockText(article: NewsArticleDisplayLike) {
  if (!article.affectedStocks || article.affectedStocks.length === 0) {
    return "";
  }

  return article.affectedStocks
    .map((stock) =>
      [
        stock.ticker,
        stock.company,
        stock.sector,
        stock.matchReason,
        stock.scoreEffect,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

export function articleText(article: NewsArticleDisplayLike) {
  return [article.title, article.summary, article.source, affectedStockText(article)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function cleanedCompanyName(company: string | null) {
  if (!company) return "";

  return company
    .replace(/&/g, " and ")
    .replace(/[(),.]/g, " ")
    .replace(
      /\b(incorporated|inc|corp|corporation|company|co|plc|ltd|limited|class|common|stock|holdings|holding|group|ordinary|shares|systems|services|technologies|technology|international|global|industries)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function companyTerms(company: string | null) {
  const clean = cleanedCompanyName(company);

  if (!clean) return [];

  const words = clean
    .split(" ")
    .map((word) => word.trim().toLowerCase())
    .filter(
      (word) =>
        word.length >= 4 &&
        !COMPANY_STOP_WORDS.has(word) &&
        !GENERIC_COMPANY_TERMS.has(word),
    );

  const terms = [clean, ...words];

  if (clean.includes(" and ")) {
    terms.push(clean.replace(/\s+and\s+/g, " "));
  }

  return Array.from(new Set(terms)).filter((term) => term.length >= 4);
}

function containsExplicitTickerSymbol(rawText: string, ticker: string) {
  const t = escapeRegExp(ticker);
  const patterns = [
    `\\$${t}\\b`,
    `\\b(?:NASDAQ|NYSE|AMEX|NYSEARCA|OTC|OTCMKTS):\\s*${t}\\b`,
    `\\b${t}\\.(?:O|N|K|L)\\b`,
  ];

  if (ticker.length >= 3 && !AMBIGUOUS_TICKERS.has(ticker)) {
    patterns.push(`\\(${t}\\)`);
  }

  return patterns.some((pattern) =>
    new RegExp(pattern, "i").test(rawText),
  );
}

function containsTickerAsWord(rawText: string, ticker: string) {
  if (ticker.length < 3 || AMBIGUOUS_TICKERS.has(ticker)) return false;

  return new RegExp(`(^|[^A-Z0-9])${escapeRegExp(ticker)}([^A-Z0-9]|$)`).test(
    rawText,
  );
}

function getDirectStockMatch(
  article: NewsArticleDisplayLike,
  stock: StockLike,
): RatingResult | null {
  const ticker = String(stock.ticker ?? "").trim().toUpperCase();

  if (!ticker) return null;

  const rawTitle = String(article.title ?? "");
  const rawCore = articleCoreText(article);
  const title = articleTitleLower(article);
  const core = articleCoreTextLower(article);

  if (containsExplicitTickerSymbol(rawTitle, ticker)) {
    return {
      rating: 10,
      reason: "Ticker symbol appears explicitly in headline",
    };
  }

  if (containsExplicitTickerSymbol(rawCore, ticker)) {
    return {
      rating: 9,
      reason: "Ticker symbol appears explicitly in article text",
    };
  }

  const terms = companyTerms(stock.company);
  const primaryCompany = terms[0];

  if (primaryCompany && containsTerm(title, primaryCompany)) {
    return {
      rating: 10,
      reason: "Company name appears in headline",
    };
  }

  if (primaryCompany && containsTerm(core, primaryCompany)) {
    return {
      rating: 8,
      reason: "Company name appears in article text",
    };
  }

  const titleCompanyHits = terms.filter((term) => containsTerm(title, term));
  const bodyCompanyHits = terms.filter((term) => containsTerm(core, term));

  if (titleCompanyHits.length >= 2) {
    return {
      rating: 9,
      reason: "Multiple company identifiers appear in headline",
    };
  }

  if (bodyCompanyHits.length >= 2) {
    return {
      rating: 7,
      reason: "Multiple company identifiers appear in article text",
    };
  }

  if (containsTickerAsWord(rawTitle, ticker)) {
    return {
      rating: 9,
      reason: "Ticker appears in headline",
    };
  }

  if (containsTickerAsWord(rawCore, ticker)) {
    return {
      rating: 7,
      reason: "Ticker appears in article text",
    };
  }

  return null;
}

function themeMatchesArticle(theme: IndustryTheme, text: string) {
  return theme.terms.some((term) => containsTerm(text, term));
}

function getIndustryThemeMatch(
  article: NewsArticleDisplayLike,
  stock: StockLike,
): RatingResult | null {
  const ticker = String(stock.ticker ?? "").trim().toUpperCase();
  const text = articleCoreTextLower(article);

  if (!ticker || !text) return null;

  const theme = INDUSTRY_THEMES.find(
    (item) => item.tickers.includes(ticker) && themeMatchesArticle(item, text),
  );

  if (!theme) return null;

  const businessHits = countTermHits(text, BUSINESS_EVENT_TERMS);
  const marketHits = countTermHits(text, MARKET_RELEVANCE_TERMS);

  if (businessHits === 0 && marketHits === 0) return null;

  return {
    rating: theme.rating,
    reason: theme.reason,
  };
}

function getMacroSectorMatch(
  article: NewsArticleDisplayLike,
  stock: StockLike,
): RatingResult | null {
  const sector = stock.sector ?? "";
  const text = articleCoreTextLower(article);

  if (!sector || !text) return null;

  if (
    sector === "Financials" &&
    /\b(fed|federal reserve|interest rates|yield curve|credit|banking|loan|loans|deposits)\b/i.test(
      text,
    )
  ) {
    return {
      rating: 4,
      reason: "Macro read-through for financial stocks",
    };
  }

  if (
    sector === "Energy" &&
    /\b(oil|crude|brent|wti|opec|gas|lng|pipeline|refining)\b/i.test(text)
  ) {
    return {
      rating: 4,
      reason: "Commodity read-through for energy stocks",
    };
  }

  if (
    sector === "Real Estate" &&
    /\b(mortgage|mortgages|interest rates|commercial real estate|housing|reit|property)\b/i.test(
      text,
    )
  ) {
    return {
      rating: 4,
      reason: "Rates/property read-through for real estate stocks",
    };
  }

  if (
    sector === "Utilities" &&
    /\b(interest rates|electricity|power grid|grid|renewable energy|natural gas)\b/i.test(
      text,
    )
  ) {
    return {
      rating: 4,
      reason: "Rates/energy read-through for utilities",
    };
  }

  return null;
}

function hasAnyDirectStockMatch(article: NewsArticleDisplayLike, stocks: StockLike[]) {
  return stocks.some((stock) => Boolean(getDirectStockMatch(article, stock)));
}

export function isMarketRelevantArticle(
  article: NewsArticleDisplayLike,
  stocks: StockLike[] = [],
) {
  const text = articleCoreTextLower(article);

  if (!text || text.length < 20) return false;

  if (stocks.length > 0 && hasAnyDirectStockMatch(article, stocks)) {
    return true;
  }

  const marketHits = countTermHits(text, MARKET_RELEVANCE_TERMS);

  if (marketHits > 0) return true;

  const businessHits = countTermHits(text, BUSINESS_EVENT_TERMS);
  const themeHits = INDUSTRY_THEMES.filter((theme) =>
    themeMatchesArticle(theme, text),
  ).length;

  return businessHits > 0 && themeHits > 0;
}

export function inferImpact(article: NewsArticleDisplayLike) {
  const explicit = (article.impact ?? "").toLowerCase().trim();

  if (
    explicit === "positive" ||
    explicit === "negative" ||
    explicit === "neutral"
  ) {
    return explicit;
  }

  const text = articleCoreTextLower(article);

  const negativeHits = countTermHits(text, NEGATIVE_WORDS);
  const positiveHits = countTermHits(text, POSITIVE_WORDS);

  if (negativeHits > positiveHits) return "negative";
  if (positiveHits > negativeHits) return "positive";

  return "neutral";
}

export function impactStyle(impact: string | null) {
  const s = inferImpact({
    title: null,
    summary: null,
    source: null,
    impact,
    impact_reason: null,
  });

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

export function formatNewsDate(dateStr: string | null | undefined) {
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

export function formatShortNewsDate(dateStr: string | null | undefined) {
  if (!dateStr) return "Date unavailable";

  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function displaySummary(article: NewsArticleDisplayLike) {
  if (
    article.summary &&
    article.summary.trim() &&
    article.summary !== "No summary available."
  ) {
    return article.summary;
  }

  return "No full description is currently available for this article.";
}

export function getArticleImpactRating(
  article: NewsArticleDisplayLike,
  stock: StockLike,
): RatingResult {
  const ticker = String(stock.ticker ?? "").trim().toUpperCase();

  if (!ticker) {
    return {
      rating: 1,
      reason: "No stock match",
    };
  }

  const direct = getDirectStockMatch(article, stock);

  if (direct) return direct;

  if (!isMarketRelevantArticle(article)) {
    return {
      rating: 1,
      reason: "Article is not market-relevant enough",
    };
  }

  const industry = getIndustryThemeMatch(article, stock);

  if (industry) return industry;

  const macro = getMacroSectorMatch(article, stock);

  if (macro) return macro;

  return {
    rating: 1,
    reason: "No valid stock-specific or sector-specific link",
  };
}

export function getScoreEffectText(
  article: NewsArticleDisplayLike,
  stock: StockLike,
  rating: number,
  reason: string,
) {
  const impact = inferImpact(article);
  const ticker = stock.ticker ?? "this stock";
  const score = Number(stock.score);
  const rank = Number(stock.rank);

  const scoreLabel = Number.isFinite(score)
    ? `current AI score ${Math.round(score).toLocaleString()}`
    : "current AI score unavailable";

  const rankLabel =
    Number.isFinite(rank) && rank > 0 ? `rank #${rank}` : "rank unavailable";

  const relationship =
    rating >= 9
      ? "direct company catalyst"
      : rating >= 7
        ? "direct company reference"
        : rating >= 5
          ? "sector/industry read-through"
          : "low-confidence macro read-through";

  const direction =
    impact === "positive"
      ? "Positive"
      : impact === "negative"
        ? "Negative"
        : "Neutral/mixed";

  return `${ticker}: ${relationship}. ${direction} article. Link reason: ${reason}. This may influence sentiment, momentum, estimate-revision or risk inputs only if the story is confirmed as material. ${scoreLabel}; ${rankLabel}.`;
}

export function getAffectedStockInsight(
  article: BaseNewsArticle,
  stock: StockLike,
): AffectedStockInsight | null {
  if (!stock.ticker) return null;

  const ratingData = getArticleImpactRating(article, stock);

  if (ratingData.rating < 4) return null;

  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    rank: stock.rank,
    score: stock.score,
    price: stock.price,
    impactRating: ratingData.rating,
    matchReason: ratingData.reason,
    scoreEffect: getScoreEffectText(
      article,
      stock,
      ratingData.rating,
      ratingData.reason,
    ),
  };
}

export function getDirectlyConfirmedAffectedTickers(
  article: BaseNewsArticle,
  stocks: StockLike[],
) {
  return stocks
    .map((stock) => {
      const direct = getDirectStockMatch(article, stock);

      if (!direct || direct.rating < 8 || !stock.ticker) return null;

      return stock.ticker.toUpperCase();
    })
    .filter((ticker): ticker is string => Boolean(ticker));
}

export function enrichArticleWithStockInsights(
  article: BaseNewsArticle,
  stocks: StockLike[],
  maxStocks = 8,
): EnrichedNewsArticle {
  const insights = stocks
    .map((stock) => getAffectedStockInsight(article, stock))
    .filter((item): item is AffectedStockInsight => Boolean(item))
    .sort((a, b) => {
      if (b.impactRating !== a.impactRating) {
        return b.impactRating - a.impactRating;
      }

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
      if (!isMarketRelevantArticle(article)) return null;

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

  return "No high-confidence S&P 500 stock link has been detected. Treat this as broad context only, not a stock-specific catalyst.";
}

export function getStockNewsSummary(
  ticker: string,
  articles: EnrichedNewsArticle[],
) {
  if (articles.length === 0) {
    return `No recent direct company, sector or high-confidence industry news is currently linked to ${ticker}.`;
  }

  const ratings = articles
    .flatMap((article) => article.affectedStocks)
    .map((stock) => stock.impactRating);

  const maxRating = Math.max(...ratings, 1);
  const avgRating = Math.round(
    ratings.reduce((sum, rating) => sum + rating, 0) /
      Math.max(ratings.length, 1),
  );

  const positive = articles.filter(
    (article) => inferImpact(article) === "positive",
  ).length;

  const negative = articles.filter(
    (article) => inferImpact(article) === "negative",
  ).length;

  const neutral = articles.length - positive - negative;

  return `${articles.length} relevant item${
    articles.length === 1 ? "" : "s"
  } found for ${ticker}. Highest impact rating ${maxRating}/10, average ${avgRating}/10. Current mix: ${positive} positive, ${neutral} neutral, ${negative} negative.`;
}
