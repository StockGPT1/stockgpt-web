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

export type ImpactDirection = "Positive" | "Negative" | "Neutral / mixed";

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
  impactDirection: ImpactDirection;
  impactType: string;
  causalChain: string;
  modelReadThrough: string;
  customerSummary: string;
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
  causalChain: string;
};

type CausalChannel = {
  id: string;
  label: string;
  terms: string[];
  positiveTerms: string[];
  negativeTerms: string[];
  factorInput: string;
  explanation: string;
  sectors?: string[];
};

type IndustryTheme = {
  id: string;
  name: string;
  terms: string[];
  tickers: string[];
  sectors?: string[];
  baseRating: number;
  reason: string;
};

type RelevanceDecision = {
  relevant: boolean;
  score: number;
  reason: string;
  directCompanyMatch: boolean;
  marketHits: number;
  catalystHits: number;
  softHits: number;
  channelHits: string[];
  industryHits: string[];
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

const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple"],
  MSFT: ["microsoft"],
  NVDA: ["nvidia"],
  AMZN: ["amazon", "aws"],
  GOOGL: ["alphabet", "google", "youtube"],
  GOOG: ["alphabet", "google", "youtube"],
  META: ["meta", "facebook", "instagram", "whatsapp"],
  TSLA: ["tesla"],
  WDC: ["western digital"],
  SNDK: ["sandisk", "san disk"],
  MU: ["micron"],
  STX: ["seagate"],
  JPM: ["jpmorgan", "jp morgan", "jpmorgan chase", "chase"],
  BAC: ["bank of america"],
  WFC: ["wells fargo"],
  C: ["citigroup", "citi"],
  GS: ["goldman sachs"],
  MS: ["morgan stanley"],
  V: ["visa"],
  MA: ["mastercard"],
  XOM: ["exxon", "exxonmobil", "exxon mobil"],
  CVX: ["chevron"],
  LLY: ["eli lilly", "lilly"],
  JNJ: ["johnson and johnson", "johnson & johnson"],
  MRK: ["merck"],
  PFE: ["pfizer"],
  UNH: ["unitedhealth", "united health"],
  NKE: ["nike"],
  LULU: ["lululemon"],
  TGT: ["target"],
  WMT: ["walmart", "wal-mart"],
  COST: ["costco"],
  HD: ["home depot"],
  LOW: ["lowe's", "lowes"],
  BA: ["boeing"],
  LMT: ["lockheed martin"],
  RTX: ["rtx", "raytheon"],
  DIS: ["disney", "walt disney"],
  NFLX: ["netflix"],
  CRM: ["salesforce"],
  ORCL: ["oracle"],
  ADBE: ["adobe"],
  INTC: ["intel"],
  AMD: ["advanced micro devices", "amd"],
  AVGO: ["broadcom"],
  QCOM: ["qualcomm"],
};

const HARD_MARKET_TERMS = [
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
  "wall street",
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
  "valuation",
  "multiple",
  "free cash flow",
  "cash flow",
];

const BUSINESS_CATALYST_TERMS = [
  "earnings",
  "revenue",
  "sales",
  "profit",
  "profits",
  "margin",
  "margins",
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
  "spin-off",
  "ipo",
  "layoffs",
  "job cuts",
  "cost cuts",
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
  "supply chain",
  "shipments",
  "deliveries",
  "orders",
  "demand",
  "pricing",
  "price hike",
  "price cuts",
];

const MACRO_MARKET_TERMS = [
  "fed",
  "federal reserve",
  "interest rate",
  "interest rates",
  "rate cut",
  "rate cuts",
  "rate hike",
  "rate hikes",
  "inflation",
  "cpi",
  "ppi",
  "jobs report",
  "payrolls",
  "unemployment",
  "recession",
  "gdp",
  "treasury",
  "treasuries",
  "yield",
  "yields",
  "dollar",
  "oil",
  "crude",
  "brent",
  "wti",
  "opec",
  "tariff",
  "tariffs",
  "sanction",
  "sanctions",
  "trade war",
  "geopolitical",
];

const SOFT_NEWS_TERMS = [
  "husband",
  "wife",
  "girlfriend",
  "boyfriend",
  "wedding",
  "bride",
  "groom",
  "celebrity",
  "actor",
  "actress",
  "singer",
  "movie",
  "film",
  "tv show",
  "football",
  "soccer",
  "nba",
  "nfl",
  "mlb",
  "recipe",
  "doughnut",
  "donut",
  "restaurant review",
  "holiday",
  "vacation",
  "travel guide",
  "tiktok",
  "viral",
  "reddit",
  "meme",
  "horoscope",
  "puzzle",
  "quiz",
  "photos",
  "fans react",
  "office prank",
  "landed a job",
  "job by bringing",
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
  "demand rises",
  "margin expansion",
  "cost savings",
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
  "margin pressure",
  "demand weakens",
];

const CAUSAL_CHANNELS: CausalChannel[] = [
  {
    id: "earnings",
    label: "earnings expectations",
    terms: [
      "earnings",
      "revenue",
      "profit",
      "guidance",
      "forecast",
      "outlook",
      "sales",
      "eps",
    ],
    positiveTerms: [
      "beats",
      "raises",
      "strong",
      "record",
      "growth",
      "profit",
      "outperform",
    ],
    negativeTerms: [
      "misses",
      "cuts",
      "weak",
      "warning",
      "loss",
      "decline",
      "downgrade",
    ],
    factorInput: "growth, quality, estimate revision and momentum inputs",
    explanation:
      "changes to results or guidance can affect analyst expectations, valuation and investor confidence",
  },
  {
    id: "demand",
    label: "demand",
    terms: [
      "demand",
      "orders",
      "shipments",
      "deliveries",
      "bookings",
      "traffic",
      "consumer spending",
      "sales",
    ],
    positiveTerms: [
      "strong demand",
      "orders rise",
      "sales rise",
      "deliveries rise",
      "bookings rise",
    ],
    negativeTerms: [
      "weak demand",
      "orders fall",
      "sales fall",
      "deliveries fall",
      "demand weakens",
    ],
    factorInput: "revenue growth, momentum and forward-demand inputs",
    explanation:
      "changes in demand can feed into future revenue expectations and relative stock strength",
  },
  {
    id: "margin",
    label: "margin / cost pressure",
    terms: [
      "margin",
      "margins",
      "cost",
      "costs",
      "pricing",
      "price cuts",
      "price hikes",
      "wages",
      "tariff",
      "tariffs",
      "input costs",
    ],
    positiveTerms: [
      "margin expansion",
      "cost savings",
      "pricing power",
      "price hikes",
    ],
    negativeTerms: [
      "margin pressure",
      "cost pressure",
      "price cuts",
      "tariff",
      "tariffs",
      "higher costs",
    ],
    factorInput: "profitability, quality and risk inputs",
    explanation:
      "pricing power or cost pressure can change profitability, risk and valuation",
  },
  {
    id: "rates",
    label: "interest-rate sensitivity",
    terms: [
      "fed",
      "federal reserve",
      "interest rates",
      "rate cut",
      "rate cuts",
      "rate hike",
      "rate hikes",
      "treasury",
      "yield",
      "yields",
    ],
    positiveTerms: ["rate cut", "rate cuts", "yields fall", "lower rates"],
    negativeTerms: ["rate hike", "rate hikes", "yields rise", "higher rates"],
    factorInput: "valuation, financing-cost and sector-rotation inputs",
    explanation:
      "rates can affect discount rates, borrowing costs and how investors rotate between sectors",
    sectors: [
      "Financials",
      "Real Estate",
      "Utilities",
      "Information Technology",
      "Consumer Discretionary",
    ],
  },
  {
    id: "commodity",
    label: "commodity / input prices",
    terms: [
      "oil",
      "crude",
      "brent",
      "wti",
      "opec",
      "gas",
      "lng",
      "copper",
      "gold",
      "lithium",
      "steel",
    ],
    positiveTerms: ["oil rises", "crude rises", "prices rise", "supply cut"],
    negativeTerms: ["oil falls", "crude falls", "prices fall", "oversupply"],
    factorInput: "margin, inflation and sector momentum inputs",
    explanation:
      "commodity moves can affect producers, transport costs, input costs and inflation expectations",
    sectors: ["Energy", "Materials", "Industrials", "Consumer Discretionary"],
  },
  {
    id: "regulation",
    label: "regulatory / legal risk",
    terms: [
      "regulation",
      "regulator",
      "antitrust",
      "lawsuit",
      "probe",
      "investigation",
      "sec",
      "doj",
      "fda",
      "approval",
      "ban",
      "sanction",
      "sanctions",
    ],
    positiveTerms: ["approval", "approved", "cleared", "settlement"],
    negativeTerms: [
      "lawsuit",
      "probe",
      "investigation",
      "ban",
      "sanction",
      "blocked",
      "fine",
    ],
    factorInput: "risk, sentiment and valuation inputs",
    explanation:
      "regulatory outcomes can change risk, addressable markets and valuation multiples",
  },
  {
    id: "supply-chain",
    label: "supply chain",
    terms: [
      "supply chain",
      "shortage",
      "inventory",
      "production",
      "factory",
      "manufacturing",
      "supplier",
      "exports",
      "export controls",
    ],
    positiveTerms: ["production rises", "supply improves", "inventory clears"],
    negativeTerms: [
      "shortage",
      "export controls",
      "supply disruption",
      "factory shutdown",
    ],
    factorInput: "revenue reliability, margin and risk inputs",
    explanation:
      "supply-chain changes can affect production volumes, revenue timing and margins",
  },
  {
    id: "capital-allocation",
    label: "capital allocation",
    terms: [
      "buyback",
      "dividend",
      "debt",
      "leverage",
      "credit rating",
      "cash flow",
      "free cash flow",
      "capex",
      "investment",
    ],
    positiveTerms: [
      "buyback",
      "dividend increase",
      "debt reduction",
      "free cash flow",
    ],
    negativeTerms: ["debt rises", "credit downgrade", "cash burn", "higher capex"],
    factorInput: "quality, income, balance-sheet and risk inputs",
    explanation:
      "capital allocation affects shareholder returns, financial resilience and quality scores",
  },
];

const INDUSTRY_THEMES: IndustryTheme[] = [
  {
    id: "semiconductors",
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
      "foundry",
      "wafer",
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
    sectors: ["Information Technology"],
    baseRating: 6,
    reason: "semiconductor industry read-through",
  },
  {
    id: "cloud-software",
    name: "cloud, data centres and enterprise software",
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
    sectors: ["Information Technology", "Communication Services"],
    baseRating: 5,
    reason: "cloud/software infrastructure read-through",
  },
  {
    id: "memory-storage",
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
    sectors: ["Information Technology"],
    baseRating: 6,
    reason: "memory/storage industry read-through",
  },
  {
    id: "banks-credit",
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
    sectors: ["Financials"],
    baseRating: 5,
    reason: "banking/credit read-through",
  },
  {
    id: "energy",
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
    sectors: ["Energy"],
    baseRating: 5,
    reason: "energy commodity read-through",
  },
  {
    id: "healthcare",
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
    sectors: ["Health Care", "Healthcare"],
    baseRating: 5,
    reason: "healthcare/pharma read-through",
  },
  {
    id: "autos-ev",
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
    sectors: ["Consumer Discretionary"],
    baseRating: 5,
    reason: "auto/EV industry read-through",
  },
  {
    id: "retail-apparel",
    name: "apparel and listed retail",
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
    sectors: ["Consumer Discretionary", "Consumer Staples"],
    baseRating: 4,
    reason: "retail/apparel read-through",
  },
  {
    id: "travel-leisure",
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
    sectors: ["Industrials", "Consumer Discretionary"],
    baseRating: 4,
    reason: "travel/leisure read-through",
  },
  {
    id: "defence-aerospace",
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
    sectors: ["Industrials"],
    baseRating: 5,
    reason: "defence/aerospace read-through",
  },
  {
    id: "real-estate",
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
    sectors: ["Real Estate"],
    baseRating: 4,
    reason: "real estate/housing read-through",
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

function matchedTerms(text: string, terms: string[]) {
  return terms.filter((term) => containsTerm(text, term));
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
  return [
    article.title,
    article.summary,
    article.source,
    affectedStockText(article),
  ]
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

function companyTerms(stock: StockLike) {
  const ticker = String(stock.ticker ?? "").toUpperCase();
  const clean = cleanedCompanyName(stock.company);
  const aliases = COMPANY_ALIASES[ticker] ?? [];

  const words = clean
    .split(" ")
    .map((word) => word.trim().toLowerCase())
    .filter(
      (word) =>
        word.length >= 4 &&
        !COMPANY_STOP_WORDS.has(word) &&
        !GENERIC_COMPANY_TERMS.has(word),
    );

  const terms = [clean, ...aliases, ...words];

  if (clean.includes(" and ")) {
    terms.push(clean.replace(/\s+and\s+/g, " "));
  }

  return Array.from(new Set(terms))
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 4);
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

  return patterns.some((pattern) => new RegExp(pattern, "i").test(rawText));
}

function containsTickerAsWord(rawText: string, ticker: string) {
  if (ticker.length < 3 || AMBIGUOUS_TICKERS.has(ticker)) return false;

  return new RegExp(`(^|[^A-Z0-9])${escapeRegExp(ticker)}([^A-Z0-9]|$)`).test(
    rawText,
  );
}

function getArticleMainIssue(article: NewsArticleDisplayLike) {
  const text = articleCoreTextLower(article);

  const channel = getMatchedChannels(article).sort((a, b) => b.score - a.score)[0];

  if (channel) {
    return channel.channel.label;
  }

  if (containsTerm(text, "earnings") || containsTerm(text, "revenue")) {
    return "earnings expectations";
  }

  if (containsTerm(text, "lawsuit") || containsTerm(text, "investigation")) {
    return "legal / regulatory risk";
  }

  if (containsTerm(text, "demand") || containsTerm(text, "sales")) {
    return "demand";
  }

  if (containsTerm(text, "margin") || containsTerm(text, "cost")) {
    return "margins";
  }

  return "market expectations";
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
  const mainIssue = getArticleMainIssue(article);

  const directCompanyChain = `The article is directly connected to this company. The practical question is whether it changes ${mainIssue}, investor confidence, valuation, or the risk/reward setup for the stock.`;

  if (containsExplicitTickerSymbol(rawTitle, ticker)) {
    return {
      rating: 10,
      reason: `This looks like a company-specific catalyst focused on ${mainIssue}.`,
      causalChain: directCompanyChain,
    };
  }

  if (containsExplicitTickerSymbol(rawCore, ticker)) {
    return {
      rating: 9,
      reason: `This looks like a direct company update focused on ${mainIssue}.`,
      causalChain: directCompanyChain,
    };
  }

  const terms = companyTerms(stock);
  const primaryCompany = terms[0];

  if (primaryCompany && containsTerm(title, primaryCompany)) {
    return {
      rating: 10,
      reason: `This looks like a company-specific catalyst focused on ${mainIssue}.`,
      causalChain: directCompanyChain,
    };
  }

  if (primaryCompany && containsTerm(core, primaryCompany)) {
    return {
      rating: 8,
      reason: `This looks like a direct company update focused on ${mainIssue}.`,
      causalChain: directCompanyChain,
    };
  }

  const titleCompanyHits = terms.filter((term) => containsTerm(title, term));
  const bodyCompanyHits = terms.filter((term) => containsTerm(core, term));

  if (titleCompanyHits.length >= 2) {
    return {
      rating: 9,
      reason: `This looks like a high-confidence company update focused on ${mainIssue}.`,
      causalChain: directCompanyChain,
    };
  }

  if (bodyCompanyHits.length >= 2) {
    return {
      rating: 7,
      reason: `This looks like a direct company read-through focused on ${mainIssue}.`,
      causalChain:
        "The article appears to be connected to this company. The impact depends on whether investors treat it as material enough to shift price action, AI score, analyst expectations or risk perception.",
    };
  }

  if (containsTickerAsWord(rawTitle, ticker)) {
    return {
      rating: 9,
      reason: `This looks like a high-confidence stock-specific update focused on ${mainIssue}.`,
      causalChain: directCompanyChain,
    };
  }

  if (containsTickerAsWord(rawCore, ticker)) {
    return {
      rating: 7,
      reason: `This looks like a direct stock read-through focused on ${mainIssue}.`,
      causalChain:
        "The article appears connected to this stock. The impact depends on whether the story changes sentiment, expectations, risk, or technical momentum.",
    };
  }

  return null;
}

function getMatchedChannels(article: NewsArticleDisplayLike) {
  const text = articleCoreTextLower(article);

  return CAUSAL_CHANNELS.map((channel) => {
    const terms = matchedTerms(text, channel.terms);
    const positiveTerms = matchedTerms(text, channel.positiveTerms);
    const negativeTerms = matchedTerms(text, channel.negativeTerms);

    if (
      terms.length === 0 &&
      positiveTerms.length === 0 &&
      negativeTerms.length === 0
    ) {
      return null;
    }

    return {
      channel,
      terms,
      positiveTerms,
      negativeTerms,
      score:
        terms.length +
        positiveTerms.length * 1.5 +
        negativeTerms.length * 1.5,
    };
  }).filter(
    (
      item,
    ): item is {
      channel: CausalChannel;
      terms: string[];
      positiveTerms: string[];
      negativeTerms: string[];
      score: number;
    } => Boolean(item),
  );
}

function getPrimaryChannel(article: NewsArticleDisplayLike, stock?: StockLike) {
  const sector = stock?.sector ?? null;

  const channels = getMatchedChannels(article)
    .filter((item) => {
      if (!sector || !item.channel.sectors) return true;
      return item.channel.sectors.includes(sector);
    })
    .sort((a, b) => b.score - a.score);

  return (
    channels[0] ??
    getMatchedChannels(article).sort((a, b) => b.score - a.score)[0] ??
    null
  );
}

function themeMatchesArticle(theme: IndustryTheme, text: string) {
  return theme.terms.some((term) => containsTerm(text, term));
}

function getMatchedThemes(article: NewsArticleDisplayLike) {
  const text = articleCoreTextLower(article);

  return INDUSTRY_THEMES.filter((theme) => themeMatchesArticle(theme, text));
}

function hasPublicMarketBridge(article: NewsArticleDisplayLike) {
  const text = articleCoreTextLower(article);

  return (
    countTermHits(text, HARD_MARKET_TERMS) > 0 ||
    countTermHits(text, MACRO_MARKET_TERMS) > 0 ||
    /\b(publicly traded|listed|wall street|investors|shareholders|valuation|earnings|guidance|margins|revenue|profits)\b/i.test(
      text,
    )
  );
}

function hasAnyDirectStockMatch(
  article: NewsArticleDisplayLike,
  stocks: StockLike[],
) {
  return stocks.some((stock) => Boolean(getDirectStockMatch(article, stock)));
}

export function analyseArticleForMarketRelevance(
  article: NewsArticleDisplayLike,
  stocks: StockLike[] = [],
): RelevanceDecision {
  const text = articleCoreTextLower(article);

  if (!text || text.length < 40) {
    return {
      relevant: false,
      score: 0,
      reason: "Not enough article text to analyse reliably.",
      directCompanyMatch: false,
      marketHits: 0,
      catalystHits: 0,
      softHits: 0,
      channelHits: [],
      industryHits: [],
    };
  }

  const directCompanyMatch =
    stocks.length > 0 && hasAnyDirectStockMatch(article, stocks);
  const marketHits = countTermHits(text, HARD_MARKET_TERMS);
  const macroHits = countTermHits(text, MACRO_MARKET_TERMS);
  const catalystHits = countTermHits(text, BUSINESS_CATALYST_TERMS);
  const softHits = countTermHits(text, SOFT_NEWS_TERMS);
  const channels = getMatchedChannels(article);
  const themes = getMatchedThemes(article);
  const channelHits = channels.map((item) => item.channel.label);
  const industryHits = themes.map((theme) => theme.name);
  const bridge = hasPublicMarketBridge(article);

  let score = 0;

  if (directCompanyMatch) score += 8;
  score += Math.min(marketHits, 4) * 1.5;
  score += Math.min(macroHits, 3) * 1.5;
  score += Math.min(catalystHits, 4) * 1.25;
  score += Math.min(channels.length, 3) * 1.5;
  score += Math.min(themes.length, 2);
  if (bridge) score += 1.5;
  if (softHits > 0 && !directCompanyMatch) score -= softHits * 2.5;

  const clearlySoft =
    softHits >= 1 &&
    !directCompanyMatch &&
    marketHits === 0 &&
    macroHits === 0 &&
    catalystHits < 2 &&
    channels.length === 0;

  if (clearlySoft) {
    return {
      relevant: false,
      score,
      reason:
        "Rejected because it looks like lifestyle or soft news, not market-moving news.",
      directCompanyMatch,
      marketHits,
      catalystHits,
      softHits,
      channelHits,
      industryHits,
    };
  }

  if (directCompanyMatch) {
    return {
      relevant: true,
      score,
      reason: "Accepted because a listed company or ticker is directly named.",
      directCompanyMatch,
      marketHits,
      catalystHits,
      softHits,
      channelHits,
      industryHits,
    };
  }

  if (macroHits > 0 && (marketHits > 0 || channels.length > 0)) {
    return {
      relevant: true,
      score,
      reason:
        "Accepted because it has a clear macro channel that can affect stocks.",
      directCompanyMatch,
      marketHits,
      catalystHits,
      softHits,
      channelHits,
      industryHits,
    };
  }

  if (themes.length > 0 && channels.length > 0 && bridge) {
    return {
      relevant: true,
      score,
      reason:
        "Accepted because it links an investable industry to a real business catalyst.",
      directCompanyMatch,
      marketHits,
      catalystHits,
      softHits,
      channelHits,
      industryHits,
    };
  }

  if (marketHits >= 2 && catalystHits >= 1) {
    return {
      relevant: true,
      score,
      reason:
        "Accepted because it combines market language with a business catalyst.",
      directCompanyMatch,
      marketHits,
      catalystHits,
      softHits,
      channelHits,
      industryHits,
    };
  }

  return {
    relevant: false,
    score,
    reason:
      "Rejected because there is no clear stock, sector, macro or earnings link.",
    directCompanyMatch,
    marketHits,
    catalystHits,
    softHits,
    channelHits,
    industryHits,
  };
}

export function isMarketRelevantArticle(
  article: NewsArticleDisplayLike,
  stocks: StockLike[] = [],
) {
  return analyseArticleForMarketRelevance(article, stocks).relevant;
}

function getIndustryThemeMatch(
  article: NewsArticleDisplayLike,
  stock: StockLike,
): RatingResult | null {
  const ticker = String(stock.ticker ?? "").trim().toUpperCase();
  const sector = stock.sector ?? "";
  const text = articleCoreTextLower(article);

  if (!ticker || !text) return null;

  const theme = INDUSTRY_THEMES.find(
    (item) =>
      item.tickers.includes(ticker) &&
      themeMatchesArticle(item, text) &&
      (!item.sectors || item.sectors.includes(sector)),
  );

  if (!theme) return null;

  const channel = getPrimaryChannel(article, stock);
  const bridge = hasPublicMarketBridge(article);
  const catalystHits = countTermHits(text, BUSINESS_CATALYST_TERMS);

  if (!channel || (!bridge && catalystHits < 2)) return null;

  const rating = Math.min(
    7,
    theme.baseRating + (channel.score >= 2 ? 1 : 0) + (bridge ? 0 : -1),
  );

  return {
    rating,
    reason: `This is a ${theme.reason} driven by ${channel.channel.label}.`,
    causalChain: `${theme.name} theme → ${channel.channel.label} → possible effect on ${channel.channel.factorInput}.`,
  };
}

function getMacroSectorMatch(
  article: NewsArticleDisplayLike,
  stock: StockLike,
): RatingResult | null {
  const sector = stock.sector ?? "";
  const text = articleCoreTextLower(article);
  const channel = getPrimaryChannel(article, stock);

  if (!sector || !text || !channel) return null;

  if (!channel.channel.sectors || !channel.channel.sectors.includes(sector)) {
    return null;
  }

  if (
    !hasPublicMarketBridge(article) &&
    countTermHits(text, MACRO_MARKET_TERMS) < 2
  ) {
    return null;
  }

  return {
    rating: 4,
    reason: `This is a macro read-through for ${sector} through ${channel.channel.label}.`,
    causalChain: `${channel.channel.label} → ${channel.channel.explanation} → possible effect on ${channel.channel.factorInput}.`,
  };
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
  const channels = getMatchedChannels(article);

  const negativeHits =
    countTermHits(text, NEGATIVE_WORDS) +
    channels.reduce((sum, item) => sum + item.negativeTerms.length, 0);

  const positiveHits =
    countTermHits(text, POSITIVE_WORDS) +
    channels.reduce((sum, item) => sum + item.positiveTerms.length, 0);

  if (negativeHits > positiveHits) return "negative";
  if (positiveHits > negativeHits) return "positive";

  return "neutral";
}

function getImpactDirection(article: NewsArticleDisplayLike): ImpactDirection {
  const impact = inferImpact(article);

  if (impact === "positive") return "Positive";
  if (impact === "negative") return "Negative";
  return "Neutral / mixed";
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
      reason: "No valid stock link was detected.",
      causalChain: "No ticker or company data is available.",
    };
  }

  const direct = getDirectStockMatch(article, stock);

  if (direct) return direct;

  const articleDecision = analyseArticleForMarketRelevance(article);

  if (!articleDecision.relevant) {
    return {
      rating: 1,
      reason: "The article is not market-relevant enough.",
      causalChain: articleDecision.reason,
    };
  }

  const industry = getIndustryThemeMatch(article, stock);

  if (industry) return industry;

  const macro = getMacroSectorMatch(article, stock);

  if (macro) return macro;

  return {
    rating: 1,
    reason: "No valid stock-specific, sector-specific or macro path was detected.",
    causalChain:
      "The article may be relevant to markets generally, but no defensible path to this specific stock was detected.",
  };
}

function getImpactType(rating: number) {
  if (rating >= 9) return "Major company-specific catalyst";
  if (rating >= 7) return "Direct company read-through";
  if (rating >= 5) return "Sector read-through";
  return "Market context signal";
}

function getPlainEnglishImpactType(rating: number) {
  if (rating >= 9) return "major company-specific update";
  if (rating >= 7) return "direct company update";
  if (rating >= 5) return "sector read-through";
  return "market context signal";
}

function getInvestorActionFrame(direction: ImpactDirection, rating: number) {
  if (rating >= 8) {
    if (direction === "Positive") {
      return "For you, this is worth watching as a potential positive catalyst. It does not automatically mean buy, but it may strengthen the thesis if price action, volume, analyst revisions, or the AI score begin confirming it.";
    }

    if (direction === "Negative") {
      return "For you, this is a risk signal to monitor. It does not automatically mean sell, but it may weaken the thesis if the AI score falls, momentum breaks down, or follow-up news confirms the risk.";
    }

    return "For you, this is a high-relevance update, but the direction is not clear yet. The sensible move is to monitor follow-up news, price reaction, volume, and any change in the AI score.";
  }

  if (rating >= 5) {
    if (direction === "Positive") {
      return "For you, this is a sector-level positive read-through. It matters if the theme starts lifting similar stocks, improving sentiment, or supporting the company’s growth outlook.";
    }

    if (direction === "Negative") {
      return "For you, this is a sector-level risk. It matters if the pressure spreads across peers, affects margins, or starts dragging on the company’s relative strength.";
    }

    return "For you, this is a sector-level watch item. It is not stock-specific enough to act on alone, but it may become important if the theme continues.";
  }

  if (direction === "Positive") {
    return "For you, this is a lower-confidence positive read-through. Treat it as background context unless the stock itself starts reacting.";
  }

  if (direction === "Negative") {
    return "For you, this is a lower-confidence risk read-through. Monitor it, but do not treat it as a direct reason to change position unless stronger confirmation appears.";
  }

  return "For you, this is useful context rather than a direct signal. The main value is knowing which market theme could become relevant later.";
}

function getWatchListText(direction: ImpactDirection, rating: number) {
  if (rating >= 8) {
    if (direction === "Positive") {
      return "Watch for upward AI score movement, stronger price momentum, analyst upgrades, rising volume, and positive follow-up headlines.";
    }

    if (direction === "Negative") {
      return "Watch for a falling AI score, rank deterioration, broken support levels, negative follow-up headlines, or analyst downgrades.";
    }

    return "Watch whether the market starts treating this as positive or negative through price movement, volume, analyst commentary, and AI score changes.";
  }

  if (rating >= 5) {
    return "Watch whether the wider sector starts moving, whether peer stocks react, and whether this theme appears in more headlines.";
  }

  return "Watch for confirmation. On its own, this is not enough to change a thesis.";
}

function getModelReadThrough(
  direction: ImpactDirection,
  causalChain: string,
  rating = 1,
) {
  const modelDirection =
    direction === "Positive"
      ? "support"
      : direction === "Negative"
        ? "pressure"
        : "influence";

  const userFrame = getInvestorActionFrame(direction, rating);
  const watchText = getWatchListText(direction, rating);

  return `${causalChain} This could ${modelDirection} the StockGPT model if it starts affecting sentiment, momentum, margins, estimate revisions, valuation, or risk. ${userFrame} ${watchText}`;
}

export function getScoreEffectText(
  stock: StockLike,
  direction: ImpactDirection,
  impactType: string,
  reason: string,
  causalChain: string,
  modelReadThrough: string,
) {
  const ticker = stock.ticker ?? "This stock";
  const score = Number(stock.score);
  const rank = Number(stock.rank);

  const scoreLabel = Number.isFinite(score)
    ? `AI score ${Math.round(score).toLocaleString()}`
    : "AI score unavailable";

  const rankLabel =
    Number.isFinite(rank) && rank > 0 ? `rank #${rank}` : "rank unavailable";

  return `${ticker}: ${impactType}. ${direction}. ${reason} ${causalChain} ${modelReadThrough} ${scoreLabel}; ${rankLabel}.`;
}

function getCustomerSummary(
  stock: StockLike,
  direction: ImpactDirection,
  rating = 1,
) {
  const ticker = stock.ticker ?? "This stock";
  const company = stock.company ?? ticker;
  const plainType = getPlainEnglishImpactType(rating);

  if (direction === "Positive") {
    return `${ticker} is linked because this looks like a ${plainType} for ${company}. The current read is supportive, meaning it could strengthen the investment case if the market starts pricing in better growth, margins, sentiment, or lower risk. This is not a standalone buy signal, but it is something to monitor closely.`;
  }

  if (direction === "Negative") {
    return `${ticker} is linked because this looks like a ${plainType} for ${company}. The current read is a risk factor, meaning it could weaken the investment case if it pressures sentiment, margins, demand, earnings expectations, or valuation. This is not a standalone sell signal, but it is a clear watch item.`;
  }

  return `${ticker} is linked because this looks like a ${plainType} for ${company}. The direction is not clear yet, so the useful takeaway is not to act immediately, but to watch whether price action, AI score, analyst commentary, or follow-up headlines confirm a positive or negative trend.`;
}

export function getAffectedStockInsight(
  article: BaseNewsArticle,
  stock: StockLike,
): AffectedStockInsight | null {
  if (!stock.ticker) return null;

  const ratingData = getArticleImpactRating(article, stock);

  if (ratingData.rating < 4) return null;

  const impactDirection = getImpactDirection(article);
  const impactType = getImpactType(ratingData.rating);

  const customerSummary = getCustomerSummary(
    stock,
    impactDirection,
    ratingData.rating,
  );

  const modelReadThrough = getModelReadThrough(
    impactDirection,
    ratingData.causalChain,
    ratingData.rating,
  );

  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    rank: stock.rank,
    score: stock.score,
    price: stock.price,
    impactRating: ratingData.rating,
    matchReason: ratingData.reason,
    impactDirection,
    impactType,
    causalChain: ratingData.causalChain,
    modelReadThrough,
    customerSummary,
    scoreEffect: getScoreEffectText(
      stock,
      impactDirection,
      impactType,
      ratingData.reason,
      ratingData.causalChain,
      modelReadThrough,
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
      if (!isMarketRelevantArticle(article, [stock])) return null;

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

    return `${top.ticker}: ${top.impactDirection}. ${top.impactType}. ${top.impactRating}/10 relevance.`;
  }

  return "No high-confidence S&P 500 stock link has been detected. Treat this as broad context only.";
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
