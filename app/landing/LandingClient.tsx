"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";
import { LegalConsentLine } from "@/components/LegalConsentLine";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";

export type LandingTicker = {
  symbol: string;
  yahooSymbol: string;
  price: number;
  change: number;
  changePct: number;
};

type LandingMetrics = {
  totalStocks: number;
  bullishPct: number;
  sentiment: string;
  lastUpdatedLabel: string;
};

type LandingClientProps = {
  tickerTape: LandingTicker[];
  metrics: LandingMetrics;
};

const navLinks = [
  { label: "Preview", href: "#preview" },
  { label: "Product", href: "#product" },
  { label: "Method", href: "#method" },
  { label: "Pricing", href: "#pricing" },
];

const productFeatures = [
  {
    title: "Ranked market view",
    copy:
      "A live ranked table that helps you decide which stocks are worth researching first.",
  },
  {
    title: "Stock research pages",
    copy:
      "Open individual stock pages for ranking context, market data, relevant news and risk notes.",
  },
  {
    title: "Portfolio context",
    copy:
      "Add holdings manually or import a CSV to review exposure, weaker positions and concentration.",
  },
  {
    title: "Ask StockGPT",
    copy:
      "Ask plain-English questions about stocks, rankings, market context and investing concepts.",
  },
];

const methodSteps = [
  {
    title: "Collect",
    copy:
      "Prices, fundamentals, ranking inputs, sector context and market news are brought into one research layer.",
  },
  {
    title: "Score",
    copy:
      "Stocks are assessed across Quality, Growth, Value, Momentum, Risk and Income.",
  },
  {
    title: "Rank",
    copy:
      "The market is ordered into a clearer research list so users can prioritise attention.",
  },
  {
    title: "Review",
    copy:
      "Stock pages, portfolio context and news tools help users sense-check ideas before acting.",
  },
];

const pricingFeatures = [
  "Full ranked stock table",
  "Daily scores and rank movements",
  "Individual stock research pages",
  "World news and stock impact context",
  "Portfolio Builder and alerts",
  "Ask StockGPT research assistant",
  "Live market updates",
];

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMove(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#faf6f0]/45";
  if (value > 0) return "text-[#56d98a]";
  if (value < 0) return "text-red-300";
  return "text-[#faf6f0]/45";
}

function CheckoutButton({
  children = "Try free today",
  full = false,
  compact = false,
}: {
  children?: React.ReactNode;
  full?: boolean;
  compact?: boolean;
}) {
  return (
    <form
      action="/api/create-checkout-session"
      method="post"
      className={full ? "w-full" : "w-fit max-sm:w-full"}
    >
      <EndorselyReferralInput />

      <button
        type="submit"
        className={[
          "inline-flex items-center justify-center rounded-full border border-[#e3bc63] bg-[#ddb159] font-bold uppercase tracking-[0.12em] text-[#06180f] shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition-colors duration-200 hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f] active:bg-[#c99f49]",
          full ? "w-full" : "max-sm:w-full",
          compact ? "min-h-10 px-4 py-2 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
        ].join(" ")}
      >
        {children}
      </button>

      {!compact && (
        <LegalConsentLine className="mt-3 max-w-[390px] text-[#faf6f0]/45" />
      )}
    </form>
  );
}

function GhostButton({
  href,
  children,
  compact = false,
}: {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center justify-center rounded-full border border-[#ddb159]/45 bg-transparent font-bold uppercase tracking-[0.12em] text-[#faf6f0] transition-colors duration-200 hover:border-[#ddb159] hover:bg-[#ddb159]/8 hover:text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f] max-sm:w-full",
        compact ? "min-h-10 px-4 py-2 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex rounded-full border border-[#ddb159]/24 bg-[#ddb159]/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ddb159]">
      {children}
    </p>
  );
}

function TickerMarquee({ tickerTape }: { tickerTape: LandingTicker[] }) {
  if (tickerTape.length === 0) {
    return (
      <div className="rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 px-4 py-3 text-sm font-bold text-[#faf6f0]/55">
        Live market data is loading.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 py-2.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#061b12] to-transparent sm:w-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#061b12] to-transparent sm:w-16" />

      <div className="sg-marquee-track flex w-max items-center gap-2.5">
        {repeated.map((item, index) => (
          <Link
            key={`${item.yahooSymbol}-${index}`}
            href={
              item.yahooSymbol.startsWith("^")
                ? "/"
                : `/stocks/${encodeURIComponent(item.yahooSymbol)}`
            }
            className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#04180f]/85 px-3 py-2 text-xs font-bold text-[#faf6f0] transition-colors hover:border-[#ddb159]/40 hover:bg-[#ddb159]/8 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f]"
          >
            <span className="sg-data text-[#faf6f0]">{item.symbol}</span>
            <span className="sg-data text-[#faf6f0]/45">
              {formatMoney(item.price)}
            </span>
            <span className={["sg-data", toneClass(item.changePct)].join(" ")}>
              {formatMove(item.changePct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProductMockup({ metrics }: { metrics: LandingMetrics }) {
  const rows = Array.from({ length: 6 });

  return (
    <div
      id="preview"
      className="scroll-mt-28 rounded-[1.6rem] border border-[#ddb159]/22 bg-[#06180f]/92 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:rounded-[2rem] sm:p-3"
    >
      <div className="overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#04180f]/96 sm:rounded-[1.55rem]">
        <div className="flex flex-col gap-4 border-b border-[#ddb159]/14 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                Product preview
              </p>
              <h2 className="sg-heading mt-1 text-2xl font-medium text-[#faf6f0] sm:text-3xl">
                StockGPT dashboard
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#56d98a]/28 bg-[#56d98a]/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#56d98a]">
                Member view
              </span>
              <span className="rounded-full border border-[#ddb159]/20 bg-[#ddb159]/8 px-3 py-1.5 text-[10px] font-bold text-[#ddb159]">
                Updated {metrics.lastUpdatedLabel}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#faf6f0]/42">
                Market read
              </p>
              <p className="mt-1 text-sm font-bold text-[#56d98a]">
                {metrics.sentiment}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#faf6f0]/42">
                Bullish share
              </p>
              <p className="sg-data mt-1 text-sm font-bold text-[#faf6f0]">
                {metrics.bullishPct}%
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#faf6f0]/42">
                Workflow
              </p>
              <p className="mt-1 text-sm font-bold text-[#ddb159]">Ranked</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[42px_minmax(0,1fr)_70px] border-b border-white/[0.08] px-3 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#faf6f0]/45 sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_86px_86px] md:text-[10px]">
          <span>#</span>
          <span>Research target</span>
          <span className="hidden md:block">Context</span>
          <span className="hidden md:block">Move</span>
          <span className="text-right md:text-left">Score</span>
        </div>

        {rows.map((_, index) => (
          <div
            key={`locked-${index}`}
            className="grid grid-cols-[42px_minmax(0,1fr)_70px] items-center border-b border-white/[0.06] px-3 py-3 sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_86px_86px]"
          >
            <span className="sg-data text-sm font-bold text-[#ddb159]">
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#faf6f0]">
                Ranked stock hidden
              </span>
              <span className="block truncate text-[10px] font-medium text-[#faf6f0]/42">
                Ticker, sector and reasoning available inside
              </span>
            </span>

            <span className="hidden truncate text-sm font-medium text-[#faf6f0]/45 md:block">
              Research context included
            </span>

            <span className="sg-data hidden text-sm font-medium text-[#faf6f0]/42 md:block">
              Daily
            </span>

            <span className="sg-data text-right text-xs font-bold uppercase tracking-[0.08em] text-[#56d98a] md:text-left">
              Locked
            </span>
          </div>
        ))}

        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
          <div>
            <p className="text-sm font-bold text-[#faf6f0]">
              See the full ranked list during your free trial.
            </p>
            <p className="mt-1 text-sm leading-6 text-[#faf6f0]/52">
              Unlock tickers, scores, rank movement, stock pages and portfolio tools.
            </p>
          </div>
          <CheckoutButton compact>Try free today</CheckoutButton>
        </div>
      </div>
    </div>
  );
}

function MobileBottomCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#ddb159]/20 bg-[#04180f]/95 px-3 py-3 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[#faf6f0]">
            Try StockGPT free
          </p>
          <p className="truncate text-[11px] font-medium text-[#faf6f0]/45">
            Then £18.99/month. Cancel anytime.
          </p>
        </div>
        <CheckoutButton compact>Try free</CheckoutButton>
      </div>
    </div>
  );
}

export function LandingClient({ tickerTape, metrics }: LandingClientProps) {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 24);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const stockCountLabel =
    metrics.totalStocks > 0
      ? metrics.totalStocks.toLocaleString("en-GB")
      : "500+";

  return (
    <main className="sg-landing min-h-screen overflow-x-hidden bg-[#072116] text-[#faf6f0]">
      <style>{`
        .sg-landing {
          --sg-bg: #072116;
          --sg-bg-deep: #03140c;
          --sg-green: #56d98a;
          --sg-heading: #faf6f0;
          --sg-body: rgba(250,246,240,0.62);
          --sg-gold: #ddb159;
          --sg-gold-bright: #e8c36b;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          scroll-behavior: smooth;
        }

        .sg-heading {
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: -0.028em;
        }

        .sg-data {
          font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }

        .sg-page-bg {
          background:
            radial-gradient(circle at 18% 0%, rgba(221,177,89,0.10), transparent 30%),
            radial-gradient(circle at 88% 10%, rgba(86,217,138,0.08), transparent 28%),
            linear-gradient(180deg, #072116 0%, #051b12 44%, #03140c 100%);
        }

        .sg-nav {
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          transition: border-color 220ms ease, background-color 220ms ease, box-shadow 220ms ease;
        }

        .sg-nav-scrolled {
          border-bottom-color: rgba(221,177,89,0.34);
          background: rgba(4,24,15,0.96);
          box-shadow: 0 12px 34px rgba(0,0,0,0.34);
        }

        .sg-panel {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(4,24,15,0.72);
          box-shadow: 0 24px 70px rgba(0,0,0,0.24);
        }

        .sg-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.035);
          box-shadow: 0 18px 54px rgba(0,0,0,0.16);
          transition: border-color 180ms ease, background-color 180ms ease;
        }

        @media (hover: hover) {
          .sg-card:hover {
            border-color: rgba(221,177,89,0.32);
            background: rgba(221,177,89,0.045);
          }
        }

        .sg-marquee-track {
          animation: sgMarquee 34s linear infinite;
        }

        .sg-marquee-track:hover {
          animation-play-state: paused;
        }

        @keyframes sgMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @media (max-width: 760px) {
          .sg-marquee-track {
            animation-duration: 24s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-landing {
            scroll-behavior: auto;
          }

          .sg-marquee-track {
            animation: none !important;
          }
        }
      `}</style>

      <div className="sg-page-bg relative min-h-screen pb-24 sm:pb-0">
        <nav
          className={[
            "sg-nav fixed left-0 right-0 top-0 z-50 border-b border-[#ddb159]/16 bg-[#04180f]/88",
            navScrolled ? "sg-nav-scrolled" : "",
          ].join(" ")}
        >
          <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-4 sm:h-[76px] sm:px-6 lg:px-8">
            <Link
              href="/landing"
              className="relative h-10 w-[132px] shrink-0 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f] sm:h-12 sm:w-[170px]"
              aria-label="StockGPT home"
            >
              <Image
                src="/logo.png"
                alt="StockGPT"
                fill
                priority
                className="object-contain object-left"
                sizes="(max-width: 640px) 132px, 170px"
              />
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-[#faf6f0]/62 transition-colors hover:bg-[#ddb159]/8 hover:text-[#faf6f0] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/affiliate"
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#faf6f0]/62 transition-colors hover:bg-[#ddb159]/8 hover:text-[#faf6f0] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
              >
                Affiliate
              </Link>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <GhostButton href="/login" compact>
                Log in
              </GhostButton>
              <CheckoutButton compact>Try free today</CheckoutButton>
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              <Link
                href="/login"
                className="rounded-full border border-[#ddb159]/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
              >
                Login
              </Link>
            </div>
          </div>
        </nav>

        <section className="relative px-4 pt-[88px] sm:px-6 sm:pt-[116px] lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-[#ddb159]/28 bg-[#ddb159]/8 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ddb159] sm:text-[11px]">
                  Stock research platform
                </div>

                <h1 className="sg-heading mt-5 text-[42px] font-medium leading-[0.98] text-[#faf6f0] sm:mt-6 sm:text-[64px] lg:text-[76px]">
                  Start your stock research with structure, not noise.
                </h1>

                <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#faf6f0]/64 sm:mt-6 sm:text-lg sm:leading-8">
                  StockGPT scans{" "}
                  <span className="sg-data font-bold text-[#ddb159]">
                    {stockCountLabel}
                  </span>{" "}
                  US stocks, ranks opportunities by research priority and gives
                  investors a clearer workflow for deciding what deserves attention.
                </p>

                <div className="mt-6 rounded-2xl border border-[#56d98a]/18 bg-[#56d98a]/7 p-4">
                  <p className="text-sm font-bold text-[#faf6f0]">
                    Try the full product free today.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#faf6f0]/52">
                    Explore the ranked table, stock pages, portfolio tools and market
                    news before your paid subscription begins.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <CheckoutButton>Try free today</CheckoutButton>
                  <GhostButton href="/login">Log in</GhostButton>
                </div>

                <p className="mt-4 max-w-lg text-xs leading-6 text-[#faf6f0]/42">
                  Research tool only. Not financial advice. Subscription continues at
                  £18.99/month after the trial unless cancelled.
                </p>
              </div>

              <div className="grid gap-3">
                <ProductMockup metrics={metrics} />
                <TickerMarquee tickerTape={tickerTape} />
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [`${stockCountLabel}`, "US stocks scanned"],
                ["Daily", "ranking updates"],
                ["6 factors", "quality, growth, value, momentum, risk, income"],
                ["One workflow", "rankings, news, portfolio and research"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
                >
                  <p className="sg-data text-2xl font-bold text-[#ddb159]">
                    {value}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#faf6f0]/48">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="relative px-4 py-12 sm:px-6 lg:px-8">
          <div className="sg-panel mx-auto max-w-7xl rounded-3xl p-5 sm:p-8">
            <div className="max-w-3xl">
              <SectionLabel>Product</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                A clearer way to move from market noise to a focused research list.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[#faf6f0]/58">
                StockGPT is designed to give users a useful preview of the market
                without pretending to replace judgement. Start ranked, then research
                deeper.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {productFeatures.map((feature) => (
                <article key={feature.title} className="sg-card rounded-3xl p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ddb159]">
                    Inside StockGPT
                  </p>
                  <h3 className="sg-heading mt-4 text-3xl font-medium text-[#faf6f0]">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[#faf6f0]/55">
                    {feature.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="method" className="relative px-4 pb-12 sm:px-6 lg:px-8">
          <div className="sg-panel mx-auto max-w-7xl rounded-3xl p-5 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div>
                <SectionLabel>Methodology</SectionLabel>
                <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                  Built for research, not blind signals.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-[#faf6f0]/55">
                  StockGPT uses a multi-factor ranking process to create a clearer
                  starting point. It is designed to support judgement, not replace it.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {["Quality", "Growth", "Value", "Momentum", "Risk", "Income"].map(
                    (factor) => (
                      <div
                        key={factor}
                        className="rounded-2xl border border-[#ddb159]/16 bg-[#ddb159]/7 px-4 py-3 text-sm font-bold text-[#faf6f0]"
                      >
                        {factor}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {methodSteps.map((step, index) => (
                  <article
                    key={step.title}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"
                  >
                    <div className="sg-data mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#ddb159]/36 bg-[#ddb159]/10 text-sm font-bold text-[#ddb159]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="sg-heading text-2xl font-medium text-[#faf6f0]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#faf6f0]/52">
                      {step.copy}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-3xl border border-[#ddb159]/18 bg-[#061b12]/64 p-5 shadow-[0_24px_76px_rgba(0,0,0,0.22)] sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionLabel>Trust first</SectionLabel>
                <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                  Serious research copy, not trading hype.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-[#faf6f0]/55">
                  StockGPT should feel premium because it is clear, useful and
                  responsible. The product gives structure, context and research tools —
                  not guaranteed outcomes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "No fake testimonials",
                    "The product preview and methodology do the trust-building.",
                  ],
                  [
                    "No blind signals",
                    "Rankings are a starting point for research, not instructions to trade.",
                  ],
                  [
                    "No overpromising",
                    "Trial access, legal copy and clear pricing reduce friction.",
                  ],
                ].map(([title, copy]) => (
                  <article key={title} className="sg-card rounded-2xl p-5">
                    <p className="text-sm font-bold text-[#ddb159]">{title}</p>
                    <p className="mt-3 text-sm leading-7 text-[#faf6f0]/52">
                      {copy}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="relative px-4 pb-12 sm:px-6 lg:px-8"
        >
          <div className="sg-panel mx-auto max-w-7xl rounded-3xl p-5 sm:p-8">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <SectionLabel>Free trial</SectionLabel>
                <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                  Try the full research workflow before paying.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#faf6f0]/55">
                  Open the ranked table, explore stock pages, add portfolio context
                  and test the research assistant. Continue with Core if it earns a
                  place in your workflow.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <CheckoutButton>Try free today</CheckoutButton>
                  <GhostButton href="/login">Log in</GhostButton>
                </div>
              </div>

              <div className="sg-card rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="w-fit rounded-full border border-[#ddb159]/30 bg-[#ddb159]/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ddb159]">
                    Core access
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#faf6f0]/45">
                    Free trial available
                  </p>
                </div>

                <div className="mt-7">
                  <p className="text-sm font-semibold text-[#56d98a]">
                    Try free today
                  </p>
                  <div className="mt-2 flex items-end gap-3">
                    <p className="sg-data text-5xl font-bold text-[#faf6f0] sm:text-6xl">
                      £18.99
                    </p>
                    <p className="pb-2 text-base font-semibold text-[#faf6f0]/48">
                      / month after trial
                    </p>
                  </div>
                </div>

                <ul className="mt-7 space-y-3.5 text-base font-semibold text-[#faf6f0]">
                  {pricingFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#56d98a]/34 bg-[#56d98a]/10 text-[11px] text-[#56d98a]">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <CheckoutButton full>Try free today</CheckoutButton>
                </div>

                <p className="mt-4 text-xs leading-6 text-[#faf6f0]/42">
                  Subscription continues at £18.99/month after the trial unless
                  cancelled. Informational research only. Not financial advice.
                </p>

                <form
                  action="/api/premium-waitlist"
                  method="post"
                  className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
                >
                  <p className="text-sm font-semibold text-[#faf6f0]/52">
                    Executive tier coming soon — join the waitlist.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <label className="sr-only" htmlFor="executive-email">
                      Email address
                    </label>
                    <input
                      id="executive-email"
                      name="email"
                      type="email"
                      required
                      placeholder="Email address"
                      className="min-h-11 flex-1 rounded-full border border-white/[0.1] bg-[#03140c] px-4 text-sm font-semibold text-[#faf6f0] outline-none transition-colors placeholder:text-[#faf6f0]/34 focus:border-[#ddb159]/60 focus:ring-2 focus:ring-[#ddb159]/35"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-[#ddb159]/40 px-5 py-3 text-sm font-bold text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f]"
                    >
                      Join
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section id="affiliate" className="relative px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-3xl border border-[#ddb159]/18 bg-[#061b12]/62 p-6 shadow-[0_24px_76px_rgba(0,0,0,0.22)] sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-[#ddb159]/24 bg-[#ddb159]/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ddb159]">
                Affiliate program
              </p>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                Earn with StockGPT.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#faf6f0]/55">
                Apply to partner with StockGPT and earn commission on approved
                subscriber referrals. Built for investors, creators and finance
                communities.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ddb159]">
                Creator partner route
              </p>
              <p className="mt-3 text-sm leading-7 text-[#faf6f0]/52">
                The dedicated affiliate page collects applications directly.
              </p>
              <Link
                href="/affiliate"
                className="mt-6 inline-flex w-full justify-center rounded-full border border-[#ddb159]/55 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f] sm:w-auto"
              >
                Become an affiliate
              </Link>
            </div>
          </div>
        </section>

        <footer className="relative px-4 pb-5 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-3xl border border-white/[0.08] bg-[#04180f]/72 p-7 md:grid-cols-[1.15fr_1fr_1fr]">
            <div>
              <div className="relative h-12 w-[170px]">
                <Image
                  src="/logo.png"
                  alt="StockGPT"
                  fill
                  className="object-contain object-left"
                  sizes="170px"
                />
              </div>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#faf6f0]/50">
                Stock rankings, portfolio tools and market intelligence for investors
                who want a clearer research process.
              </p>
            </div>

            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#ddb159]">
                Platform
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-[#faf6f0]/52">
                <Link href="/dashboard" className="transition-colors hover:text-[#ddb159]">
                  Dashboard
                </Link>
                <Link href="/rankings" className="transition-colors hover:text-[#ddb159]">
                  Rankings
                </Link>
                <Link href="/portfolio" className="transition-colors hover:text-[#ddb159]">
                  Portfolio
                </Link>
                <Link href="/world-news" className="transition-colors hover:text-[#ddb159]">
                  News
                </Link>
                <Link href="/pricing" className="transition-colors hover:text-[#ddb159]">
                  Pricing
                </Link>
                <Link href="/affiliate" className="transition-colors hover:text-[#ddb159]">
                  Affiliate
                </Link>
                <Link href="/about" className="transition-colors hover:text-[#ddb159]">
                  About
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#ddb159]">
                Access
              </p>
              <div className="space-y-3 text-sm font-semibold text-[#faf6f0]/52">
                <Link href="/login" className="block transition-colors hover:text-[#ddb159]">
                  Log in
                </Link>
                <Link href="/affiliate" className="block transition-colors hover:text-[#ddb159]">
                  Apply as affiliate
                </Link>
                <Link href="/pricing" className="block transition-colors hover:text-[#ddb159]">
                  Subscription
                </Link>
              </div>
              <div className="mt-5">
                <LegalFooterLinks className="text-[#faf6f0]/50" />
              </div>
            </div>

            <div className="border-t border-white/[0.08] pt-5 md:col-span-3">
              <p className="text-[11px] leading-6 text-[#6d8678]">
                StockGPT is a research and ranking tool. All content is for
                informational and educational purposes only. Nothing on this platform
                constitutes financial advice, investment advice, or a recommendation
                to buy or sell any security. Always conduct your own research and
                consult a qualified financial professional before making investment
                decisions. Past performance of rankings or examples is not indicative
                of future results.
              </p>
            </div>
          </div>
        </footer>

        <MobileBottomCta />
      </div>
    </main>
  );
}
