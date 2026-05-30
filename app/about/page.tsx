import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";


export const metadata: Metadata = {
  title: "About StockGPT | AI Stock Ranking Methodology",
  description:
    "Learn how StockGPT, LLC ranks stocks using technical, fundamental, risk and market intelligence indicators.",
};

const indicatorGroups = [
  {
    title: "Quality & Profitability",
    eyebrow: "Fundamental strength",
    description:
      "We evaluate whether a business can convert capital, revenue and operations into durable profitability over time.",
    indicators: [
      "Return on invested capital",
      "Return on equity",
      "Gross margin",
      "Operating margin",
      "Free-cash-flow margin",
      "Profitability consistency",
      "Balance-sheet efficiency",
    ],
  },
  {
    title: "Growth Engine",
    eyebrow: "Compounding potential",
    description:
      "The model assesses whether the company is continuing to expand through revenue, earnings and cash-flow progression.",
    indicators: [
      "Revenue growth",
      "EPS growth",
      "Free-cash-flow growth",
      "Sales acceleration",
      "Earnings durability",
      "Forward growth profile",
      "Growth versus sector peers",
    ],
  },
  {
    title: "Valuation Discipline",
    eyebrow: "Price versus fundamentals",
    description:
      "A strong company can still be unattractive at the wrong valuation. StockGPT compares valuation against market and sector context.",
    indicators: [
      "P/E relative value",
      "EV/EBITDA relative value",
      "Price-to-sales relative value",
      "Free-cash-flow yield",
      "Sector-adjusted valuation",
      "Value versus growth balance",
      "Multiple risk checks",
    ],
  },
  {
    title: "Technical Momentum",
    eyebrow: "Market confirmation",
    description:
      "The model incorporates price behaviour to identify when the market is confirming, weakening or rejecting the investment case.",
    indicators: [
      "12-month momentum excluding most recent month",
      "6-month momentum excluding most recent month",
      "Short-term trend behaviour",
      "Moving-average distance",
      "Moving-average slope",
      "Relative price strength",
      "Breakout and trend confirmation",
    ],
  },
  {
    title: "Risk & Drawdown Control",
    eyebrow: "Capital preservation",
    description:
      "StockGPT incorporates volatility, drawdown and balance-sheet risk so fragile companies do not appear artificially attractive.",
    indicators: [
      "Downside volatility",
      "Maximum drawdown",
      "Beta sensitivity",
      "Debt-to-equity pressure",
      "Volatility-adjusted trend",
      "Capital preservation checks",
      "Concentration risk signals",
    ],
  },
  {
    title: "Income & Shareholder Return",
    eyebrow: "Additional signal layer",
    description:
      "Dividend and cash-return measures add useful context when comparing mature, cash-generative companies.",
    indicators: [
      "Dividend yield",
      "Income contribution",
      "Cash return profile",
      "Yield sustainability context",
      "Maturity signal",
      "Sector-relative income check",
      "Shareholder-return quality",
    ],
  },
];

const processSteps = [
  "Collect live ranking data, prices, fundamentals, sector context and market information.",
  "Normalise each indicator so stocks can be compared fairly across sectors and market capitalisations.",
  "Score each company across quality, growth, value, momentum, risk and income factor groups.",
  "Apply risk controls so fragile, overextended or weak-ranked stocks are appropriately penalised.",
  "Rank the investment universe and refresh portfolio alerts, AI summaries, stop-loss plans and take-profit guidance.",
];

const stats = [
  { value: "50+", label: "technical, fundamental and risk signals" },
  { value: "500+", label: "large-cap US stocks ranked" },
  { value: "6", label: "core factor groups" },
  { value: "24h", label: "rank movement tracking" },
];

export default function AboutPage() {
  return (
    <AppShell activePath="/about">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <section className="relative overflow-hidden rounded-[32px] border border-[#ddb159]/20 bg-[radial-gradient(circle_at_82%_0%,rgba(221,177,89,0.18),transparent_34%),linear-gradient(135deg,rgba(250,246,240,0.075),rgba(250,246,240,0.025)_48%,rgba(5,26,16,0.86))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-emerald-400/8 blur-3xl" />

          <div className="relative max-w-4xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ddb159]/25 bg-[#072116]/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              <span className="size-1.5 rounded-full bg-[#ddb159] shadow-[0_0_12px_rgba(221,177,89,0.8)]" />
              The StockGPT Engine
            </div>

            <h1 className="max-w-3xl text-[38px] font-black leading-[0.92] tracking-[-0.065em] text-[#faf6f0] sm:text-[58px] lg:text-[72px]">
              Institutional-style stock intelligence, built for ordinary investors.
            </h1>

            <p className="mt-5 max-w-2xl text-[15px] font-medium leading-relaxed text-[#faf6f0]/68 sm:text-[17px]">
              StockGPT ranks stocks using a multi-factor AI scoring system that blends fundamentals, technical momentum, valuation, risk and portfolio context. The goal is to help users identify relative strength, emerging weakness and positions that may require action.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/rankings"
                className="rounded-full bg-[#ddb159] px-5 py-3 text-[12px] font-black text-[#072116] shadow-[0_14px_30px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                View rankings →
              </Link>
              <Link
                href="/portfolio"
                className="rounded-full border border-[#ddb159]/35 bg-[#faf6f0]/[0.04] px-5 py-3 text-[12px] font-black text-[#ddb159] transition hover:-translate-y-0.5 hover:bg-[#ddb159]/10"
              >
                Build AI portfolio →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-[#ddb159]/16 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
            >
              <p className="text-[34px] font-black tracking-[-0.06em]">{stat.value}</p>
              <p className="mt-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#072116]/48">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-[#ddb159]/18 bg-[#04180f] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22)] sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Methodology
            </p>
            <h2 className="mt-2 text-[30px] font-black leading-none tracking-[-0.05em] text-[#faf6f0]">
              A structured multi-factor ranking framework.
            </h2>
            <p className="mt-4 text-[14px] font-medium leading-relaxed text-[#faf6f0]/62">
              StockGPT compares each company across a broad matrix of measurable signals, then converts those signals into rankings, portfolio alerts and practical trade-plan guidance.
            </p>

            <div className="mt-6 grid gap-3">
              {processSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-3"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ddb159] text-[12px] font-black text-[#072116]">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-[13px] font-semibold leading-relaxed text-[#faf6f0]/72">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#ddb159]/18 bg-[#faf6f0] p-5 text-[#072116] shadow-[0_18px_44px_rgba(0,0,0,0.18)] sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#072116]/45">
              Differentiation
            </p>
            <h2 className="mt-2 text-[30px] font-black leading-none tracking-[-0.05em]">
              The model evaluates the business, the chart and the risk profile together.
            </h2>

            <div className="mt-5 grid gap-3">
              {[
                ["Fundamental depth", "Quality, growth, value and balance-sheet indicators help distinguish durable businesses from temporary market enthusiasm."],
                ["Technical confirmation", "Momentum and trend signals help identify whether the market is confirming or weakening the investment case."],
                ["Risk-aware ranking", "Volatility, drawdown and debt checks help prevent fragile companies from ranking artificially well."],
                ["Portfolio intelligence", "The same framework supports alerts, AI summaries, sell/trim guidance, review dates and Ask StockGPT."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-[#072116]/10 bg-[#072116]/[0.035] p-4">
                  <h3 className="text-[15px] font-black tracking-[-0.02em]">{title}</h3>
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[#072116]/62">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                Indicator library
              </p>
              <h2 className="text-[32px] font-black tracking-[-0.055em] text-[#faf6f0]">
                Technical and fundamental indicators, integrated into one ranking system.
              </h2>
            </div>
            <p className="max-w-[460px] text-[12px] font-semibold leading-relaxed text-[#faf6f0]/52">
              Exact weights are proprietary, but the signal categories below are the foundation of the StockGPT ranking engine.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {indicatorGroups.map((group) => (
              <article
                key={group.title}
                className="rounded-[28px] border border-[#ddb159]/16 bg-[#04180f] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-[#ddb159]/35"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  {group.eyebrow}
                </p>
                <h3 className="mt-2 text-[23px] font-black leading-none tracking-[-0.045em] text-[#faf6f0]">
                  {group.title}
                </h3>
                <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#faf6f0]/58">
                  {group.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {group.indicators.map((indicator) => (
                    <span
                      key={indicator}
                      className="rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.035] px-3 py-1.5 text-[11px] font-bold text-[#faf6f0]/72"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[32px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,#faf6f0,#efe2c6)] p-6 text-[#072116] shadow-[0_18px_44px_rgba(0,0,0,0.20)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#072116]/48">
                Decision support
              </p>
              <h2 className="mt-2 text-[34px] font-black leading-none tracking-[-0.06em] sm:text-[46px]">
                StockGPT is designed to convert market information into ranked, actionable insight.
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] font-semibold leading-relaxed text-[#072116]/66">
                The system is designed to answer the practical questions investors care about: which stocks rank strongest, which positions are weakening, which holdings need review, and where capital may be better allocated.
              </p>
            </div>

            <div className="rounded-[26px] border border-[#072116]/10 bg-[#072116] p-5 text-[#faf6f0]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                Built-in outputs
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  "AI stock rankings",
                  "Portfolio alerts",
                  "Stop-loss and take-profit planning",
                  "Sector exposure checks",
                  "Rank movement tracking",
                  "Ask StockGPT portfolio assistant",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-[#ddb159] text-[10px] font-black text-[#072116]">✓</span>
                    <span className="text-[13px] font-bold text-[#faf6f0]/78">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
