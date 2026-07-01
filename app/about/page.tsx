import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockIcon } from "@/components/StockIcon";

export const metadata: Metadata = {
  title: "About StockGPT | AI Stock Ranking Methodology",
  description:
    "Learn how StockGPT ranks stocks using technical, fundamental, risk and market intelligence indicators.",
};

const stats = [
  { value: "50+", label: "technical, fundamental and risk signals" },
  { value: "500+", label: "large-cap US stocks ranked" },
  { value: "6", label: "core factor groups" },
  { value: "Private", label: "account data separated by user" },
];

const trustPoints = [
  {
    title: "Private account data",
    body: "Portfolios, watchlists, alerts and chat history are separated by account so users only see their own data.",
  },
  {
    title: "Stripe-managed billing",
    body: "Payment details are handled through Stripe. StockGPT does not store card details inside the app.",
  },
  {
    title: "Research software",
    body: "StockGPT is designed as a research workflow for everyday investors, not as a broker or adviser.",
  },
];

const factorGroups = [
  {
    title: "Financial strength",
    detail:
      "Profitability, margins, return measures, balance-sheet pressure and cash generation.",
  },
  {
    title: "Growth potential",
    detail:
      "Revenue, earnings, cash-flow progression and growth compared with sector context.",
  },
  {
    title: "Price value",
    detail:
      "Valuation discipline, relative multiples and whether price looks stretched or reasonable.",
  },
  {
    title: "Market trend",
    detail:
      "Momentum, trend strength, relative performance and recent price confirmation.",
  },
  {
    title: "Risk level",
    detail:
      "Volatility, drawdown, balance-sheet risk and downside control checks.",
  },
  {
    title: "Dividend profile",
    detail:
      "Income contribution, cash returns and dividend context where relevant.",
  },
];

const processSteps = [
  "Collect ranking data, prices, fundamentals, sector context and news information.",
  "Normalise indicators so stocks can be compared fairly across the ranked universe.",
  "Score each company across the core factor groups and apply risk controls.",
  "Turn those scores into rankings, portfolio review prompts and plain-English context.",
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
              Structured stock research, built for ordinary investors.
            </h1>

            <p className="mt-5 max-w-2xl text-[15px] font-medium leading-relaxed text-[#faf6f0]/68 sm:text-[17px]">
              StockGPT ranks stocks using a multi-factor AI scoring system that
              blends fundamentals, market trend, valuation, risk and portfolio
              context. The goal is to help users research faster and monitor
              holdings more clearly.
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
                Build portfolio →
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
              <p className="text-[34px] font-black tracking-[-0.06em]">
                {stat.value}
              </p>
              <p className="mt-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#072116]/48">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-3">
          {trustPoints.map((point) => (
            <article
              key={point.title}
              className="rounded-[26px] border border-[#ddb159]/18 bg-[#04180f] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                Trust standard
              </p>
              <h2 className="mt-2 text-[22px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">
                {point.title}
              </h2>
              <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#faf6f0]/58">
                {point.body}
              </p>
            </article>
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
              StockGPT compares each company across measurable signals, then
              converts those signals into rankings, explanations and portfolio
              review prompts.
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
              Factor groups
            </p>
            <h2 className="mt-2 text-[30px] font-black leading-none tracking-[-0.05em]">
              The model evaluates the business, the trend and the risk profile together.
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {factorGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-[#072116]/10 bg-[#072116]/[0.035] p-4"
                >
                  <h3 className="text-[15px] font-black tracking-[-0.02em]">
                    {group.title}
                  </h3>
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[#072116]/62">
                    {group.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[32px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,#faf6f0,#efe2c6)] p-6 text-[#072116] shadow-[0_18px_44px_rgba(0,0,0,0.20)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#072116]/48">
                Research workflow
              </p>
              <h2 className="mt-2 text-[34px] font-black leading-none tracking-[-0.06em] sm:text-[46px]">
                Turn market information into a clearer research process.
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] font-semibold leading-relaxed text-[#072116]/66">
                StockGPT is designed to help users understand which stocks rank
                strongest, which holdings may need review and how portfolio
                context connects to market data.
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
                  "Risk and target planning",
                  "Sector exposure checks",
                  "Rank movement tracking",
                  "Ask StockGPT research assistant",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-[#ddb159] text-[10px] font-black text-[#072116]">
                      <StockIcon name="check" className="size-3.5" />
                    </span>
                    <span className="text-[13px] font-bold text-[#faf6f0]/78">
                      {item}
                    </span>
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
