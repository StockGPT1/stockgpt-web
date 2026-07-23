export type DemoView =
  "dashboard" | "rankings" | "stock" | "portfolio-build" | "portfolio-manage";

export type DemoScrollTarget =
  "stock-overview" | "stock-news" | "stock-trade-plan" | "stock-numbers";

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
      "Start with portfolio health, ranked stocks, market overview and what changed today.",
      "The dashboard is a research workspace, not a list of buy or sell instructions.",
    ],
    nextLabel: "Next: Opportunities",
  },
  {
    view: "dashboard",
    title: "Portfolio-fit opportunities",
    bullets: [
      "StockGPT highlights ideas only when they fit the selected portfolio context.",
      "Already-held names are reviewed as add-more or review ideas, not diversification.",
      "The card list scrolls in tight dashboard space while the header stays visible.",
    ],
    nextLabel: "Next: Rankings",
  },
  {
    view: "rankings",
    title: "AI stock rankings",
    bullets: [
      "Compare rank, movement, score and sector context across the research list.",
      "Rankings help prioritise research; they are not direct trading signals.",
    ],
    nextLabel: "Next: Stock research",
  },
  {
    view: "stock",
    scrollTarget: "stock-overview",
    title: "Stock research page",
    bullets: [
      "Review the company, AI score/rank, recent movement and research summary.",
      "Use the page to pressure-test an idea before reacting to market hype.",
    ],
    nextLabel: "Next: News context",
  },
  {
    view: "stock",
    scrollTarget: "stock-news",
    title: "News and market context",
    bullets: [
      "Connect recent headlines to the company, sector and broader market story.",
      "Check context before reacting to price moves or rumours.",
    ],
    nextLabel: "Next: Research plan",
  },
  {
    view: "stock",
    scrollTarget: "stock-trade-plan",
    title: "Research plan analysis",
    bullets: [
      "Compare possible levels, upside/downside scenarios and key watch points.",
      "Scenario planning supports research. It is not financial advice.",
    ],
    nextLabel: "Next: Portfolio Draft",
  },
  {
    view: "portfolio-build",
    title: "Build a Portfolio Draft",
    bullets: [
      "Create an illustrative draft from objective, risk preference and time horizon.",
      "Review allocation, sector exposure and trade-offs before making decisions.",
    ],
    nextLabel: "Next: Portfolio health",
  },
  {
    view: "portfolio-manage",
    title: "Portfolio overview and health",
    bullets: [
      "Review chart state, holdings, cash drag, health drivers and selected-portfolio opportunities.",
      "Real chart history appears only when enough valid stored points exist.",
    ],
    nextLabel: "Next: Manage holding",
  },
  {
    view: "portfolio-manage",
    title: "Manage holding actions",
    bullets: [
      "The decision panel explains recent movement, AI view, StockGPT view, evidence and risks.",
      "Trim and Buy More use any two of value, order price and shares, then validate server-side.",
    ],
    nextLabel: "Next: Add/import",
  },
  {
    view: "portfolio-manage",
    title: "Add, import and preferences",
    bullets: [
      "Add cash, log holdings, buy with cash or external funds, or import a Trading 212 CSV.",
      "Objective, risk and time horizon guide portfolio health and opportunity context.",
    ],
    nextLabel: "Next: Create account",
  },
  {
    view: "portfolio-manage",
    title: "Create account when ready",
    bullets: [
      "The demo uses illustrative data so you can understand the workflow first.",
      "Create an account when you are ready to use StockGPT with your own research setup.",
    ],
    nextLabel: "Create account",
  },
] as const;
