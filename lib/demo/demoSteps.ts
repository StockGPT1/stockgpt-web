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
      "See portfolio health, market movement and top-ranked stocks.",
      "Start here, then open a company for deeper research.",
    ],
    nextLabel: "Next: Rankings",
  },
  {
    view: "rankings",
    title: "AI stock rankings",
    bullets: [
      "Filter ranked S&P 500 companies and compare scores.",
      "Rankings support research; they are not buy or sell signals.",
    ],
    nextLabel: "Next: Stock analysis",
  },
  {
    view: "stock",
    scrollTarget: "stock-overview",
    title: "Stock research page",
    bullets: [
      "Review the company, score, movement and research summary.",
      "Pressure-test an idea before reacting to market hype.",
    ],
    nextLabel: "Next: News context",
  },
  {
    view: "stock",
    scrollTarget: "stock-news",
    title: "News context",
    bullets: [
      "Connect recent headlines to the company and its sector.",
      "Check context before reacting to price moves or rumours.",
    ],
    nextLabel: "Next: Trade plan",
  },
  {
    view: "stock",
    scrollTarget: "stock-trade-plan",
    title: "Trade-plan analysis",
    bullets: [
      "Compare risk, upside, downside and key watch points.",
      "Scenario research supports your decision; it is not advice.",
    ],
    nextLabel: "Next: The numbers",
  },
  {
    view: "stock",
    scrollTarget: "stock-numbers",
    title: "The numbers",
    bullets: [
      "Check valuation, financials, performance and key metrics.",
      "Compare the market story with the underlying data.",
    ],
    nextLabel: "Next: Build portfolio",
  },
  {
    view: "portfolio-build",
    title: "Build a Portfolio Draft",
    bullets: [
      "Create a Portfolio Draft from your preferences.",
      "Review allocation, sectors, risk and trade-offs.",
    ],
    nextLabel: "Next: Manage portfolio",
  },
  {
    view: "portfolio-manage",
    title: "Manage and review",
    bullets: [
      "Track holdings, allocation, gains, losses and changes.",
      "Review movement and concentration before adjusting the draft.",
    ],
    nextLabel: "Create account",
  },
] as const;
