export const demoRankings = [
  {
    rank: 1,
    ticker: "NVDA",
    company: "NVIDIA",
    sector: "Technology",
    price: "$173.42",
    move: "+1.8%",
    score: "8,742",
  },
  {
    rank: 2,
    ticker: "MSFT",
    company: "Microsoft",
    sector: "Technology",
    price: "$498.16",
    move: "+0.6%",
    score: "8,516",
  },
  {
    rank: 3,
    ticker: "LLY",
    company: "Eli Lilly",
    sector: "Healthcare",
    price: "$812.34",
    move: "-0.3%",
    score: "8,304",
  },
  {
    rank: 4,
    ticker: "V",
    company: "Visa",
    sector: "Financials",
    price: "$356.08",
    move: "+0.4%",
    score: "8,188",
  },
  {
    rank: 5,
    ticker: "COST",
    company: "Costco Wholesale",
    sector: "Consumer",
    price: "$1,004.21",
    move: "+0.2%",
    score: "8,021",
  },
  {
    rank: 6,
    ticker: "META",
    company: "Meta Platforms",
    sector: "Communication",
    price: "$721.60",
    move: "-0.5%",
    score: "7,946",
  },
] as const;

export const demoHoldings = [
  {
    ticker: "NVDA",
    company: "NVIDIA",
    value: "£2,184",
    allocation: "27.3%",
    pnl: "+£284",
    score: "8,742",
  },
  {
    ticker: "MSFT",
    company: "Microsoft",
    value: "£1,760",
    allocation: "22.0%",
    pnl: "+£112",
    score: "8,516",
  },
  {
    ticker: "LLY",
    company: "Eli Lilly",
    value: "£1,420",
    allocation: "17.8%",
    pnl: "-£36",
    score: "8,304",
  },
  {
    ticker: "V",
    company: "Visa",
    value: "£1,188",
    allocation: "14.9%",
    pnl: "+£74",
    score: "8,188",
  },
] as const;

export const demoOpportunities = [
  {
    ticker: "MSFT",
    company: "Microsoft",
    sector: "Technology",
    category: "Add-more candidate",
    score: 8516,
    rank: 2,
    recentMovePct: 0.6,
    updatedAt: "2026-07-10T09:30:00Z",
    reason: "Already held, still high conviction and below its draft target.",
    risk: "Technology exposure is meaningful, so any add should stay measured.",
  },
  {
    ticker: "LLY",
    company: "Eli Lilly",
    sector: "Healthcare",
    category: "Review existing holding",
    score: 8304,
    rank: 3,
    recentMovePct: -0.3,
    updatedAt: "2026-07-10T09:30:00Z",
    reason:
      "Already held and down slightly; review the latest thesis before changing size.",
    risk: "Healthcare exposure is useful, but valuation risk still matters.",
  },
  {
    ticker: "V",
    company: "Visa",
    sector: "Financials",
    category: "High-conviction fit",
    score: 8188,
    rank: 4,
    recentMovePct: 0.4,
    updatedAt: "2026-07-10T09:30:00Z",
    reason:
      "Strong rank and a different business driver from the largest technology holdings.",
    risk: "Payment volume and consumer spending should still be monitored.",
  },
  {
    ticker: "COST",
    company: "Costco Wholesale",
    sector: "Consumer",
    category: "Diversification fit",
    score: 8021,
    rank: 5,
    recentMovePct: 0.2,
    updatedAt: "2026-07-10T09:30:00Z",
    reason:
      "Adds consumer exposure without increasing the existing technology concentration.",
    risk: "A high-quality business can still be expensive if expectations are stretched.",
  },
] as const;

export const demoNews = [
  {
    source: "Demo Market Brief",
    title: "Chip demand outlook strengthens as data-centre investment expands",
    summary:
      "The update supports the growth narrative, but valuation and execution risk still matter.",
    relevance: "9/10 relevance",
  },
  {
    source: "Demo Company Update",
    title: "New product cycle puts margins and supply capacity in focus",
    summary:
      "Investors may watch whether revenue growth converts into durable free cash flow.",
    relevance: "8/10 relevance",
  },
] as const;

export const demoTickerTape = [
  ["S&P 500", "6,214.18", "+0.42%"],
  ["NASDAQ", "20,118.47", "+0.71%"],
  ["NVDA", "173.42", "+1.81%"],
  ["MSFT", "498.16", "+0.63%"],
  ["VIX", "16.84", "-2.12%"],
] as const;
