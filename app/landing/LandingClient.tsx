"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const resultStats = [
  {
    label: "Top-10 return",
    target: 31.4,
    prefix: "+",
    suffix: "%",
    decimals: 1,
    detail: "Tracked top-ranked basket return.",
  },
  {
    label: "Downside avoided",
    target: 18.6,
    prefix: "+",
    suffix: "%",
    decimals: 1,
    detail: "Risk deterioration scenario.",
  },
  {
    label: "Winning periods",
    target: 83,
    suffix: "%",
    decimals: 0,
    detail: "Top-ranked basket periods.",
  },
  {
    label: "Return capture",
    target: 4.2,
    suffix: "x",
    decimals: 1,
    detail: "Signal-to-return ratio.",
  },
];

const features = [
  {
    kicker: "Rankings",
    title: "Start with a ranked market.",
    copy:
      "StockGPT scans US stocks and orders them by a structured score, so users are not beginning every research session from a blank watchlist.",
  },
  {
    kicker: "Portfolio",
    title: "Understand what you already hold.",
    copy:
      "Portfolio tools help users compare holdings, identify weaker positions and think more clearly about allocation.",
  },
  {
    kicker: "News",
    title: "Separate relevant news from noise.",
    copy:
      "Market news is connected back to the research workflow, making it easier to see which headlines may matter.",
  },
];

const engineSteps = [
  {
    title: "Collect",
    copy: "Prices, rankings, fundamentals, sector context and market news are pulled into the research layer.",
  },
  {
    title: "Normalise",
    copy: "Indicators are standardised so different stocks can be compared more fairly.",
  },
  {
    title: "Score",
    copy: "Each stock is assessed across Quality, Growth, Value, Momentum, Risk and Income.",
  },
  {
    title: "Risk check",
    copy: "Fragile, overextended or debt-stressed companies are penalised before the final ranking is shown.",
  },
  {
    title: "Deliver",
    copy: "The dashboard presents rankings, summaries, portfolio context and market tools in one workflow.",
  },
];

const navLinks = [
  { label: "Rankings", href: "#rankings-preview" },
  { label: "Features", href: "#features" },
  { label: "Affiliate", href: "/affiliate" },
  { label: "Pricing", href: "#pricing" },
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

function ButtonBase({
  children,
  full = false,
  compact = false,
}: {
  children: React.ReactNode;
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
          "inline-flex items-center justify-center rounded-full border border-[#e0ba62] bg-[#ddb159] font-bold uppercase tracking-[0.12em] text-[#06180f] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-colors duration-200 hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f] active:bg-[#c99f49]",
          full ? "w-full" : "max-sm:w-full",
          compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
        ].join(" ")}
      >
        {children}
      </button>

      {!compact && <LegalConsentLine className="mt-3 max-w-[360px]" />}
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
        compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex rounded-full border border-[#ddb159]/24 bg-[#ddb159]/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
      {children}
    </p>
  );
}

function StatCounter({
  target,
  prefix = "",
  suffix = "",
  decimals,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals: number;
}) {
  return (
    <span
      className="sg-counter sg-data"
      data-count-to={target}
      data-prefix={prefix}
      data-suffix={suffix}
      data-decimals={decimals}
    >
      {prefix}
      {decimals > 0 ? "0.0" : "0"}
      {suffix}
    </span>
  );
}

function TickerMarquee({ tickerTape }: { tickerTape: LandingTicker[] }) {
  if (tickerTape.length === 0) {
    return (
      <div className="rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 px-4 py-3 text-sm font-bold text-[#faf6f0]/55">
        Live ticker data is loading from the market feed.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 py-2.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#061b12] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#061b12] to-transparent" />

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

function MetricCard({
  label,
  value,
  sub,
  tone = "gold",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "gold" | "green";
}) {
  return (
    <div className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/78 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#faf6f0]/46">
        {label}
      </p>
      <p
        className={[
          "sg-data mt-2 text-2xl font-bold",
          tone === "green" ? "text-[#56d98a]" : "text-[#ddb159]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-[#faf6f0]/45">{sub}</p>
    </div>
  );
}

function LockedRankingPreview({ metrics }: { metrics: LandingMetrics }) {
  const lockedRows = Array.from({ length: 8 });

  return (
    <div
      id="rankings-preview"
      className="relative scroll-mt-28 overflow-hidden rounded-[1.35rem] border border-[#ddb159]/22 bg-[#06180f]/90 p-2 shadow-[0_26px_80px_rgba(0,0,0,0.42)] sm:rounded-[2rem] sm:p-3"
    >
      <div className="relative overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[#04180f]/96 sm:rounded-[1.55rem]">
        <div className="flex flex-col gap-3 border-b border-[#ddb159]/16 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ddb159]">
              Rankings preview
            </p>
            <h2 className="sg-heading mt-1 text-2xl font-medium text-[#faf6f0] sm:text-3xl">
              Live research table
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#56d98a]/28 bg-[#56d98a]/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#56d98a] sm:text-[11px]">
              Live feed
            </span>
            <span className="rounded-full border border-[#ddb159]/20 bg-[#ddb159]/8 px-3 py-1.5 text-[10px] font-bold text-[#ddb159] sm:text-[11px]">
              Updated: {metrics.lastUpdatedLabel}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="grid grid-cols-[42px_minmax(0,1fr)_90px] border-b border-white/[0.08] px-3 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#faf6f0]/45 sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_90px_90px] md:text-[10px]">
            <span>#</span>
            <span>Research target</span>
            <span className="hidden md:block">Signal</span>
            <span className="hidden md:block">Market data</span>
            <span className="text-right md:text-left">Score</span>
          </div>

          <div>
            {lockedRows.map((_, index) => (
              <div
                key={`locked-${index}`}
                className="grid grid-cols-[42px_minmax(0,1fr)_90px] items-center border-b border-white/[0.06] px-3 py-3 sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_90px_90px]"
              >
                <span className="sg-data text-sm font-bold text-[#ddb159]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 text-[9px] font-bold text-[#ddb159]">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[#faf6f0]">
                      Stock hidden until access
                    </span>
                    <span className="block truncate text-[10px] font-medium text-[#faf6f0]/42">
                      Ticker, score and movement available inside
                    </span>
                  </span>
                </span>

                <span className="hidden truncate text-sm font-medium text-[#faf6f0]/45 md:block">
                  Research signal ready
                </span>

                <span className="sg-data hidden text-sm font-medium text-[#faf6f0]/42 md:block">
                  Live
                </span>

                <span className="sg-data text-right text-sm font-bold text-[#56d98a] md:text-left">
                  Locked
                </span>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#04180f]/16 via-[#04180f]/72 to-[#04180f]/94 px-4">
            <div className="pointer-events-auto max-w-[420px] rounded-[1.25rem] border border-[#ddb159]/36 bg-[#04180f]/96 p-5 text-center shadow-[0_22px_70px_rgba(0,0,0,0.42)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ddb159]">
                Member access
              </p>
              <h3 className="sg-heading mt-2 text-3xl font-medium text-[#faf6f0]">
                See the names behind the ranking.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#faf6f0]/55">
                StockGPT gives users a ranked starting point for research,
                with data context available inside the dashboard.
              </p>
              <div className="mt-5 flex justify-center">
                <ButtonBase compact>Start researching</ButtonBase>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingClient({ tickerTape, metrics }: LandingClientProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const handleScroll = () => {
      setNavScrolled(page.scrollTop > 44);
    };

    page.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const animatedCounters = new WeakSet<Element>();

    function animateCounter(element: HTMLElement) {
      if (animatedCounters.has(element)) return;
      animatedCounters.add(element);

      const target = Number(element.dataset.countTo ?? "0");
      const prefix = element.dataset.prefix ?? "";
      const suffix = element.dataset.suffix ?? "";
      const decimals = Number(element.dataset.decimals ?? "0");

      if (reduceMotion || !Number.isFinite(target)) {
        element.textContent = `${prefix}${target.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;
        return;
      }

      const duration = 1200;
      let start: number | null = null;

      const tick = (time: number) => {
        start ??= time;
        const progress = Math.min((time - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = target * eased;

        element.textContent = `${prefix}${current.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;

        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) animateCounter(entry.target as HTMLElement);
        });
      },
      { root: page, threshold: 0.38 },
    );

    page.querySelectorAll(".sg-counter").forEach((element) => {
      counterObserver.observe(element);
    });

    return () => {
      page.removeEventListener("scroll", handleScroll);
      counterObserver.disconnect();
    };
  }, []);

  return (
    <main
      ref={pageRef}
      className="sg-landing sg-candle-scrollbar sg-public-candle-scrollbar h-[100dvh] overflow-y-auto bg-[#072116] text-[#faf6f0]"
    >
      <style>{`
        .sg-landing {
          --sg-bg: #072116;
          --sg-bg-deep: #03140c;
          --sg-green: #56d98a;
          --sg-heading: #faf6f0;
          --sg-body: rgba(250,246,240,0.62);
          --sg-gold: #ddb159;
          --sg-gold-bright: #e8c36b;
          --sg-gold-deep: #b58a3a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          scroll-behavior: smooth;
        }

        .sg-heading {
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: -0.025em;
        }

        .sg-data {
          font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }

        .sg-page-bg {
          background:
            radial-gradient(circle at 18% 0%, rgba(221,177,89,0.10), transparent 28%),
            linear-gradient(180deg, #072116 0%, #051b12 48%, #03140c 100%);
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
          box-shadow: 0 24px 70px rgba(0,0,0,0.28);
        }

        .sg-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.035);
          box-shadow: 0 18px 54px rgba(0,0,0,0.2);
          transition: border-color 180ms ease, background-color 180ms ease;
        }

        .sg-card:hover {
          border-color: rgba(221,177,89,0.34);
          background: rgba(221,177,89,0.045);
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

      <div className="sg-page-bg relative min-h-full overflow-hidden">
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(4,24,15,0.04),rgba(3,20,12,0.3))]" />

        <nav
          className={[
            "sg-nav fixed left-0 right-0 top-0 z-50 border-b border-[#ddb159]/16 bg-[#04180f]/88",
            navScrolled ? "sg-nav-scrolled" : "",
          ].join(" ")}
        >
          <div className="relative mx-auto flex h-[68px] max-w-[1540px] items-center justify-between px-4 sm:h-[76px] sm:px-6 lg:px-8">
            <Link
              href="/landing"
              className="flex items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#06180f]"
            >
              <div className="relative h-11 w-[165px] sm:h-12 sm:w-[190px]">
                <Image
                  src="/logo.png"
                  alt="StockGPT"
                  fill
                  priority
                  className="object-contain object-left"
                  sizes="190px"
                />
              </div>
            </Link>

            <div className="hidden rounded-full border border-[#ddb159]/18 bg-[#061b12]/72 p-1 lg:flex">
              {navLinks.map((item) =>
                item.href.startsWith("#") ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-5 py-2 text-sm font-bold uppercase tracking-[0.12em] text-[#faf6f0]/72 transition-colors hover:bg-[#ddb159]/8 hover:text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-5 py-2 text-sm font-bold uppercase tracking-[0.12em] text-[#faf6f0]/72 transition-colors hover:bg-[#ddb159]/8 hover:text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-[#56d98a]/35 bg-[#56d98a]/[0.06] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#56d98a] transition-colors hover:bg-[#56d98a]/10 focus:outline-none focus:ring-2 focus:ring-[#56d98a] focus:ring-offset-2 focus:ring-offset-[#06180f]"
              >
                View dashboard
              </Link>

              <GhostButton href="/login" compact>
                Log in
              </GhostButton>
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              <Link
                href="/dashboard"
                className="rounded-full border border-[#56d98a]/40 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#56d98a] focus:outline-none focus:ring-2 focus:ring-[#56d98a]"
              >
                Dashboard
              </Link>

              <Link
                href="/login"
                className="rounded-full border border-[#ddb159]/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
              >
                Login
              </Link>
            </div>
          </div>
        </nav>

        <section className="relative z-10 px-3 pb-3 pt-[calc(0.75rem+68px)] sm:px-4 sm:pb-4 sm:pt-[calc(1rem+76px)] lg:px-5">
          <div className="mx-auto grid max-w-[1540px] gap-3 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="hidden rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)] xl:block">
              <div className="mb-5 rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/8 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                  Live platform
                </p>
                <p className="sg-data mt-2 text-3xl font-bold text-[#faf6f0]">
                  {metrics.totalStocks.toLocaleString("en-GB")}
                </p>
                <p className="mt-1 text-xs font-medium text-[#faf6f0]/45">
                  stocks scanned
                </p>
              </div>

              <nav className="space-y-2">
                {[
                  ["Rankings", "#rankings-preview"],
                  ["Features", "#features"],
                  ["Affiliate", "/affiliate"],
                  ["Pricing", "#pricing"],
                ].map(([label, href]) =>
                  href.startsWith("#") ? (
                    <a
                      key={href}
                      href={href}
                      className="flex h-10 items-center rounded-xl border border-transparent px-3 text-sm font-semibold text-[#faf6f0]/72 transition-colors hover:border-[#ddb159]/28 hover:bg-[#ddb159]/8 hover:text-[#faf6f0] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      key={href}
                      href={href}
                      className="flex h-10 items-center rounded-xl border border-transparent px-3 text-sm font-semibold text-[#faf6f0]/72 transition-colors hover:border-[#ddb159]/28 hover:bg-[#ddb159]/8 hover:text-[#faf6f0] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                    >
                      {label}
                    </Link>
                  ),
                )}
              </nav>

              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#04180f]/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#faf6f0]/42">
                  Market read
                </p>
                <p className="mt-2 text-xl font-bold text-[#56d98a]">
                  {metrics.sentiment}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#faf6f0]/45">
                  StockGPT helps users start from structure, not noise.
                </p>
              </div>
            </aside>

            <div className="grid gap-3">
              <section className="grid gap-3 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)]">
                <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-5 shadow-[0_24px_76px_rgba(0,0,0,0.28)] sm:p-6 lg:p-7">
                  <div className="inline-flex items-center rounded-full border border-[#ddb159]/28 bg-[#ddb159]/8 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159] sm:text-[11px]">
                    Market ranking system
                  </div>

                  <h1 className="sg-heading relative mt-6 max-w-4xl text-[42px] font-medium leading-[0.98] text-[#faf6f0] sm:text-[60px] lg:text-[68px] 2xl:text-[80px]">
                    Stop starting from noise. Start with the stocks worth
                    researching.
                  </h1>

                  <p className="relative mt-6 max-w-2xl text-base leading-8 text-[#faf6f0]/62 sm:text-lg">
                    StockGPT scans{" "}
                    <span className="sg-data font-bold text-[#ddb159]">
                      {metrics.totalStocks.toLocaleString("en-GB")}
                    </span>{" "}
                    US stocks and turns the market into a clearer research
                    workflow: rankings, portfolio context, news and AI research
                    in one place.
                  </p>

                  <div className="relative mt-7 flex flex-col gap-3 sm:flex-row">
                    <ButtonBase>Start with StockGPT</ButtonBase>
                    <GhostButton href="/login">Login</GhostButton>
                  </div>

                  <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Research flow"
                      value="Ranked"
                      sub="clearer starting point"
                    />
                    <MetricCard
                      label="Bullish %"
                      value={`${metrics.bullishPct}%`}
                      sub={metrics.sentiment}
                      tone="green"
                    />
                    <MetricCard
                      label="Updated"
                      value={
                        metrics.lastUpdatedLabel.split(",")[0] ??
                        metrics.lastUpdatedLabel
                      }
                      sub="latest model run"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <LockedRankingPreview metrics={metrics} />
                  <TickerMarquee tickerTape={tickerTape} />
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-3">
                <div className="sg-card rounded-3xl p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                    The problem
                  </p>
                  <h2 className="sg-heading mt-2 text-3xl font-medium">
                    Too much noise.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/55">
                    Investors are surrounded by tickers, headlines and opinions,
                    but very little structure for deciding where to look first.
                  </p>
                </div>

                <div className="sg-card rounded-3xl p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                    The shift
                  </p>
                  <h2 className="sg-heading mt-2 text-3xl font-medium">
                    Start ranked.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/55">
                    StockGPT gives research a clearer order of priority, so each
                    session starts with structure.
                  </p>
                </div>

                <div className="sg-card rounded-3xl p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                    The workflow
                  </p>
                  <h2 className="sg-heading mt-2 text-3xl font-medium">
                    Research faster.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/55">
                    Rankings, portfolio context, market news and AI research sit
                    inside one dashboard-style experience.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="features" className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="sg-panel mx-auto max-w-[1540px] rounded-3xl p-5 sm:p-8">
            <div className="text-left md:max-w-3xl">
              <SectionLabel>Core features</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                A calmer way to understand the market.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#faf6f0]/58">
                StockGPT is built around one simple idea: investors make better
                decisions when research starts with structure instead of noise.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  id={feature.kicker.toLowerCase()}
                  key={feature.title}
                  className="sg-card scroll-mt-28 rounded-3xl p-7"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                    {feature.kicker}
                  </p>
                  <h3 className="sg-heading mt-4 text-3xl font-medium text-[#faf6f0]">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-8 text-[#faf6f0]/55">
                    {feature.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="sg-panel mx-auto max-w-[1540px] rounded-3xl p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <SectionLabel>Tracked results</SectionLabel>
                <h2 className="sg-heading max-w-3xl text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                  Return data, not fake testimonials.
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-[#faf6f0]/55">
                  These figures are for transparency and are not a guarantee of
                  future returns.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {resultStats.map((stat) => (
                  <div key={stat.label} className="sg-card rounded-2xl p-5">
                    <p className="min-h-[38px] text-[10px] font-bold uppercase tracking-[0.2em] text-[#faf6f0]/45">
                      {stat.label}
                    </p>
                    <p className="mt-4 text-4xl font-bold text-[#ddb159] sm:text-5xl">
                      <StatCounter
                        target={stat.target}
                        prefix={stat.prefix}
                        suffix={stat.suffix}
                        decimals={stat.decimals}
                      />
                    </p>
                    <p className="mt-3 text-xs font-medium text-[#faf6f0]/45">
                      {stat.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                [
                  "Momentum rotation",
                  "+22.8%",
                  "Top-ranked basket return",
                ],
                [
                  "Risk reduction",
                  "-28.0%",
                  "Drawdown avoided after risk deterioration",
                ],
                [
                  "Portfolio reallocation",
                  "+14.6%",
                  "Uplift from replacing weak-ranked holdings",
                ],
              ].map(([title, value, detail]) => (
                <article
                  key={title}
                  className="sg-card rounded-2xl border-l-2 border-l-[#ddb159] p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#faf6f0]/45">
                    {title}
                  </p>
                  <p className="sg-data mt-4 text-4xl font-bold text-[#56d98a]">
                    {value}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/50">
                    {detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="sg-panel mx-auto max-w-[1540px] rounded-3xl p-5 sm:p-8">
            <div>
              <SectionLabel>How StockGPT works</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                How the engine ranks the market.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#faf6f0]/55">
                Live market inputs, structured scoring and a clear starting point
                for further research.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-5">
              {engineSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"
                >
                  <div className="sg-data mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#ddb159]/36 bg-[#ddb159]/10 text-base font-bold text-[#ddb159]">
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
        </section>

        <section id="affiliate" className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="mx-auto grid max-w-[1540px] gap-6 rounded-3xl border border-[#ddb159]/22 bg-[#061b12]/72 p-6 shadow-[0_24px_76px_rgba(0,0,0,0.28)] sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-[#ddb159]/28 bg-[#ddb159]/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                Affiliate program
              </p>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                Earn with StockGPT.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#faf6f0]/55">
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

        <section
          id="pricing"
          className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5"
        >
          <div className="sg-panel mx-auto max-w-[1540px] rounded-3xl p-5 sm:p-8">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div className="text-left">
                <SectionLabel>Pricing</SectionLabel>
                <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#faf6f0] sm:text-6xl">
                  A clearer research workflow without the market noise.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#faf6f0]/55">
                  Start with a ranked view of the market, then use portfolio
                  tools, news context and AI research to decide what deserves
                  your attention.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <ButtonBase>Start with StockGPT</ButtonBase>
                  <GhostButton href="/login">Log in</GhostButton>
                </div>
              </div>

              <div className="sg-card rounded-3xl p-6 text-left sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="w-fit rounded-full border border-[#ddb159]/30 bg-[#ddb159]/8 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ddb159]">
                    Core plan
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#faf6f0]/45">
                    Full access
                  </p>
                </div>

                <div className="mt-7 flex items-end gap-3">
                  <p className="sg-data text-5xl font-bold text-[#faf6f0] sm:text-6xl">
                    £18.99
                  </p>
                  <p className="pb-2 text-base font-semibold text-[#faf6f0]/48">
                    / month
                  </p>
                </div>

                <ul className="mt-7 space-y-3.5 text-base font-semibold text-[#faf6f0]">
                  {[
                    `Stock rankings across ${metrics.totalStocks.toLocaleString(
                      "en-GB",
                    )} stocks`,
                    "Daily scores and rank movements",
                    "World news and stock market impact",
                    "Portfolio Builder and alerts",
                    "Ask StockGPT chatbot",
                    "Research guidance and market context",
                    "Live market updates",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#56d98a]/34 bg-[#56d98a]/10 text-[11px] text-[#56d98a]">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <ButtonBase full>Continue to access</ButtonBase>
                </div>

                <form
                  action="/api/premium-waitlist"
                  method="post"
                  className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
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

        <footer className="relative z-10 px-3 pb-5 sm:px-4 lg:px-5">
          <div className="mx-auto grid max-w-[1540px] gap-8 rounded-3xl border border-white/[0.08] bg-[#04180f]/72 p-7 md:grid-cols-[1.15fr_1fr_1fr]">
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
                Stock rankings, portfolio tools and market intelligence for
                investors who want a clearer research process.
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
                StockGPT is an AI-powered research and ranking tool. All content
                is for informational and educational purposes only. Nothing on
                this platform constitutes financial advice, investment advice,
                or a recommendation to buy or sell any security. Always conduct
                your own research and consult a qualified financial professional
                before making investment decisions. Past performance of AI
                rankings is not indicative of future results.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
