export type DemoView =
  | "dashboard"
  | "rankings"
  | "stock"
  | "portfolio-build"
  | "portfolio-manage";

export type DemoScrollTarget =
  | "stock-overview"
  | "stock-news"
  | "stock-trade-plan"
  | "stock-numbers";

export type DemoStep = {
  view: DemoView;
  scrollTarget?: DemoScrollTarget;
  title: string;
  bullets: readonly string[];
  nextLabel: string;
};

export const demoSteps: readonly DemoStep[] = [
  {
    view: "dashboard",
    title: "Dashboard overview",
    bullets: [
      "See your portfolio summary at the top.",
      "Track market movement, top stocks and key updates.",
      "Use this as your starting point before researching individual companies.",
    ],
    nextLabel: "Next: Rankings",
  },
  {
    view: "rankings",
    title: "AI stock rankings",
    bullets: [
      "Browse ranked S&P 500 companies.",
      "Filter by sector and compare stocks quickly.",
      "Rankings are a research starting point, not a buy/sell signal.",
    ],
    nextLabel: "Next: Stock analysis",
  },
  {
    view: "stock",
    scrollTarget: "stock-overview",
    title: "Stock research page",
    bullets: [
      "See the company, score, key movement and research summary.",
      "Use this page to understand a stock before acting on hype.",
      "The goal is to pressure-test the idea, not blindly copy an answer.",
    ],
    nextLabel: "Next: News context",
  },
  {
    view: "stock",
    scrollTarget: "stock-news",
    title: "News context",
    bullets: [
      "See recent headlines linked to the company.",
      "Understand what may be moving the stock.",
      "Useful before reacting to social media, price moves or rumours.",
    ],
    nextLabel: "Next: Trade plan",
  },
  {
    view: "stock",
    scrollTarget: "stock-trade-plan",
    title: "Trade-plan analysis",
    bullets: [
      "Review possible scenarios before making your own decision.",
      "See risk, upside, downside and key things to watch.",
      "Educational research support, not financial advice.",
    ],
    nextLabel: "Next: The numbers",
  },
  {
    view: "stock",
    scrollTarget: "stock-numbers",
    title: "The numbers",
    bullets: [
      "Check valuation, financials, performance and key metrics.",
      "Compare the story against the actual data.",
      "Helps you avoid judging a stock only by hype or price movement.",
    ],
    nextLabel: "Next: Build portfolio",
  },
  {
    view: "portfolio-build",
    title: "Build a Portfolio Draft",
    bullets: [
      "Create a draft portfolio from your preferences.",
      "Review suggested allocations, sectors and risk.",
      "Treat it as a starting point to understand trade-offs.",
    ],
    nextLabel: "Next: Manage portfolio",
  },
  {
    view: "portfolio-manage",
    title: "Manage and review",
    bullets: [
      "Track holdings, allocation, gains/losses and portfolio changes.",
      "Review what has moved and where your risk is concentrated.",
      "Keep improving your process instead of guessing.",
    ],
    nextLabel: "Create account",
  },
] as const;
