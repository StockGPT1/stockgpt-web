"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import {
  AskStockGPTVisual,
  NewsVisual,
  PortfolioVisual,
  RankingVisual,
  ResearchPlanVisual,
  TiltingIphoneDashboard,
} from "./LandingVisuals";

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
  { label: "Rankings", target: "rankings" },
  { label: "Research", target: "research" },
  { label: "Portfolio", target: "portfolio" },
  { label: "Method", target: "method" },
  { label: "Pricing", target: "pricing" },
];

const pricingFeatures = [
  "Full ranked stock table",
  "Daily scores and rank movements",
  "Individual stock research pages",
  "Research plan previews",
  "World news and stock impact context",
  "Portfolio Builder and alerts",
  "Ask StockGPT research assistant",
];

const socialLinks = [
  {
    label: "X",
    href: "#",
  },
  {
    label: "TikTok",
    href: "#",
  },
  {
    label: "Instagram",
    href: "#",
  },
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

function tickerToneClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "text-[#7a857e]";
  if (value > 0) return "text-[#0f9f5d]";
  if (value < 0) return "text-[#c84646]";
  return "text-[#7a857e]";
}

function scrollToSection(target: string) {
  const element = document.getElementById(target);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SignupButton({
  children = "Create account",
  full = false,
  compact = false,
  variant = "gold",
}: {
  children?: ReactNode;
  full?: boolean;
  compact?: boolean;
  variant?: "gold" | "green" | "white";
}) {
  const variantClasses = {
    gold:
      "border-[#ddb159] bg-[#ddb159] !text-[#061b12] hover:bg-[#e8c36b] focus:ring-[#ddb159] focus:ring-offset-white",
    green:
      "border-[#0a2d1d] bg-[#0a2d1d] !text-white hover:bg-[#123d2a] focus:ring-[#0a2d1d] focus:ring-offset-white",
    white:
      "border-white bg-white !text-[#061b12] hover:bg-[#f6f2e8] focus:ring-white focus:ring-offset-[#04180f]",
  };

  return (
    <Link
      href="/signup"
      className={[
        "inline-flex items-center justify-center rounded-full border font-black uppercase tracking-[0.16em] no-underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
        full ? "w-full" : "w-fit max-sm:w-full",
        compact ? "h-11 px-5 text-[11px]" : "h-14 px-8 text-sm",
        variantClasses[variant],
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 inline-flex rounded-full border border-[#ddb159]/26 bg-[#fff8e6] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
      {children}
    </p>
  );
}

function SocialIcon({ label }: { label: string }) {
  if (label === "X") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M18.244 2H21.5l-7.11 8.126L22.75 22h-6.54l-5.12-6.684L5.234 22H1.976l7.604-8.692L1.56 2h6.706l4.628 6.112L18.244 2Zm-1.142 17.91h1.804L7.28 3.98H5.344L17.102 19.91Z" />
      </svg>
    );
  }

  if (label === "TikTok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M16.6 2c.25 2.26 1.55 3.7 3.76 3.85v3.26a7.2 7.2 0 0 1-3.7-1.12v6.72c0 3.4-2.08 6.05-5.78 6.05-3.15 0-5.63-2.07-5.63-5.22 0-3.58 3.1-5.8 6.55-5.04v3.44c-1.55-.48-3.17.22-3.17 1.72 0 1.02.82 1.72 1.95 1.72 1.35 0 2.22-.8 2.22-2.52V2h3.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5Zm8.75 2.05a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9ZM12 7.25A4.75 4.75 0 1 1 12 16.75 4.75 4.75 0 0 1 12 7.25Zm0 2A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z" />
    </svg>
  );
}

function StartupBaseBadge() {
  return (
    <a
      href="https://startupbase.io/products/stockgpt?utm_source=startupbase&utm_medium=badge&utm_campaign=launch-badge-neutral"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View StockGPT on StartupBase"
      className="inline-flex w-fit max-w-full items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-3 py-2 transition-colors hover:border-[#ddb159]/45 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#061b12]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://statics.startupbase.io/site/badges/launched-on-sb-neutral.svg"
        alt="Launched on StartupBase"
        height={55}
        className="h-[44px] w-auto max-w-full sm:h-[55px]"
      />
    </a>
  );
}

function TickerMarquee({ tickerTape }: { tickerTape: LandingTicker[] }) {
  if (tickerTape.length === 0) {
    return (
      <div className="rounded-3xl border border-[#dfe5dc] bg-white px-4 py-3 text-sm font-bold text-[#647267]">
        Live market data is loading.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#dfe5dc] bg-white py-2.5 shadow-[0_14px_40px_rgba(7,27,17,0.06)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-16" />

      <div className="sg-marquee-track flex w-max items-center gap-2.5">
        {repeated.map((item, index) => (
          <Link
            key={`${item.yahooSymbol}-${index}`}
            href={
              item.yahooSymbol.startsWith("^")
                ? "/"
                : `/stocks/${encodeURIComponent(item.yahooSymbol)}`
            }
            className="flex items-center gap-2 rounded-full border border-[#edf0ea] bg-[#fbfaf6] px-3 py-2 text-xs font-bold !text-[#0a2d1d] no-underline transition-colors hover:border-[#ddb159]/45 hover:bg-[#fff8e6] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-white"
          >
            <span className="sg-data text-[#0a2d1d]">{item.symbol}</span>
            <span className="sg-data text-[#738076]">{formatMoney(item.price)}</span>
            <span className={["sg-data", tickerToneClass(item.changePct)].join(" ")}>
              {formatMove(item.changePct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TrustStrip({ stockCountLabel }: { stockCountLabel: string }) {
  const items = [
    `${stockCountLabel} US stocks scanned`,
    "Research tool, not financial advice",
    "Account first, subscribe inside",
    "Cancel anytime",
  ];

  return (
    <div className="mx-auto mt-6 grid max-w-7xl gap-2 px-4 sm:mt-8 sm:grid-cols-4 sm:px-6 lg:px-8">
      {items.map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-[#dfe5dc] bg-white/86 px-4 py-3 text-center text-[12px] font-black uppercase tracking-[0.08em] text-[#0a2d1d] shadow-[0_10px_30px_rgba(7,27,17,0.045)]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function MobileDemoGroup({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="px-4 py-6 sm:hidden">
      <div className="mx-auto max-w-md">
        <p className="mb-3 inline-flex rounded-full border border-[#ddb159]/26 bg-[#fff8e6] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">
          {label}
        </p>
        <h2 className="sg-heading mb-5 text-[34px] font-medium leading-[1.02] text-[#071b11]">
          {title}
        </h2>
        <div className="grid gap-5">{children}</div>
      </div>
    </section>
  );
}

function MethodAndTrustSection() {
  const method = [
    {
      title: "Collect",
      detail: "Market data, ranking inputs and news context are pulled into one workflow.",
    },
    {
      title: "Score",
      detail: "Stocks are scored across quality, growth, value, momentum, risk and income.",
    },
    {
      title: "Research",
      detail: "The output is a starting point for research, not a buy or sell instruction.",
    },
  ];

  return (
    <section id="method" className="scroll-mt-32 px-4 pb-12 sm:px-6 sm:pb-14 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-stretch">
        <div className="rounded-[2rem] border border-[#dfe5dc] bg-white p-6 shadow-[0_24px_70px_rgba(7,27,17,0.06)] sm:p-7">
          <SectionLabel>Method</SectionLabel>
          <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-5xl">
            A ranking system for structured research.
          </h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {method.map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-4"
              >
                <p className="sg-data text-xs font-black text-[#ddb159]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-base font-black text-[#072116]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#66746b]">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#dfe5dc] bg-[#061b12] p-6 text-white shadow-[0_24px_70px_rgba(7,27,17,0.10)] sm:p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ddb159]">
            Built responsibly
          </p>
          <h3 className="sg-heading mt-3 text-4xl font-medium leading-[1.05]">
            A UK-built research platform.
          </h3>
          <p className="mt-4 text-sm leading-7 text-white/62">
            StockGPT is built for individual investors who want a cleaner way to
            research US stocks. It is informational software, not an adviser or
            signal service.
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">
                Support
              </p>
              <p className="mt-1 text-sm font-black text-white">
                sales@stockgpt.pro
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">
                Risk standard
              </p>
              <p className="mt-1 text-sm font-black text-white">
                Research only. No financial advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingClient({ tickerTape, metrics }: LandingClientProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const handleScroll = () => {
      setNavScrolled(page.scrollTop > 18);
    };

    page.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      page.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const stockCountLabel =
    metrics.totalStocks > 0
      ? metrics.totalStocks.toLocaleString("en-GB")
      : "500+";

  return (
    <main
      ref={pageRef}
      className="sg-landing h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#fbfaf6] text-[#0a2d1d]"
    >
      <style>{`
        .sg-landing {
          --sg-green: #072116;
          --sg-green-dark: #04180f;
          --sg-soft: #fbfaf6;
          --sg-gold: #ddb159;
          --sg-muted: #66746b;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: #ddb159 #04180f;
          scrollbar-gutter: stable;
          overscroll-behavior: contain;
        }

        .sg-landing::-webkit-scrollbar {
          width: 13px;
        }

        .sg-landing::-webkit-scrollbar-track {
          background: linear-gradient(180deg, #04180f 0%, #072116 50%, #04180f 100%);
          border-left: 1px solid rgba(221,177,89,0.24);
        }

        .sg-landing::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #f0cf7a 0%, #ddb159 42%, #a7792f 100%);
          border: 3px solid #04180f;
          border-radius: 999px;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.32),
            0 0 14px rgba(221,177,89,0.28);
        }

        .sg-heading {
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: -0.035em;
        }

        .sg-data {
          font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
        }

        .sg-page-soft {
          background:
            radial-gradient(circle at 88% 14%, rgba(221,177,89,0.12), transparent 26%),
            radial-gradient(circle at 12% 18%, rgba(7,33,22,0.07), transparent 24%),
            linear-gradient(180deg, #fbfaf6 0%, #ffffff 46%, #f7f5ef 100%);
        }

        .sg-nav {
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: box-shadow 220ms ease;
        }

        .sg-nav-scrolled {
          box-shadow: 0 14px 34px rgba(7,27,17,0.18);
        }

        .sg-phone-scroll {
          transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .group:hover .sg-phone-scroll {
          transform: translateY(-175px);
        }

        .sg-rank-row {
          animation: sgRankSweep 6s ease-in-out infinite;
        }

        .sg-chat-bubble {
          opacity: 0;
          transform: translateY(10px);
          animation-duration: 9.5s;
          animation-iteration-count: infinite;
          animation-timing-function: ease;
        }

        .sg-chat-a { animation-name: sgChatA; }
        .sg-chat-b { animation-name: sgChatB; }
        .sg-chat-c { animation-name: sgChatC; }
        .sg-chat-d { animation-name: sgChatD; }

        .sg-real-chart {
          background:
            linear-gradient(135deg, transparent 8%, rgba(15,159,93,0.18) 8%, transparent 9%),
            linear-gradient(160deg, transparent 14%, rgba(15,159,93,0.28) 14%, transparent 15%),
            linear-gradient(145deg, transparent 28%, rgba(15,159,93,0.36) 28%, transparent 29%),
            linear-gradient(155deg, transparent 45%, rgba(15,159,93,0.50) 45%, transparent 46%),
            linear-gradient(145deg, transparent 62%, rgba(15,159,93,0.60) 62%, transparent 63%);
          border: 1px solid rgba(15,159,93,0.10);
        }

        .sg-marquee-track {
          animation: sgMarquee 34s linear infinite;
        }

        .sg-marquee-track:hover {
          animation-play-state: paused;
        }

        @keyframes sgRankSweep {
          0%, 100% { background: rgba(255,255,255,0); }
          45% { background: rgba(221,177,89,0.06); }
        }

        @keyframes sgChatA {
          0%, 8% { opacity: 0; transform: translateY(10px); }
          12%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgChatB {
          0%, 22% { opacity: 0; transform: translateY(10px); }
          27%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgChatC {
          0%, 43% { opacity: 0; transform: translateY(10px); }
          48%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgChatD {
          0%, 61% { opacity: 0; transform: translateY(10px); }
          66%, 86% { opacity: 1; transform: translateY(0); }
          92%, 100% { opacity: 0; transform: translateY(0); }
        }

        @keyframes sgMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @media (hover: none) {
          .sg-phone-scroll {
            animation: sgPhoneMobilePeek 8s ease-in-out infinite;
          }

          @keyframes sgPhoneMobilePeek {
            0%, 18% { transform: translateY(0); }
            45%, 68% { transform: translateY(-150px); }
            82%, 100% { transform: translateY(0); }
          }
        }

        @media (max-width: 760px) {
          .sg-marquee-track {
            animation-duration: 24s;
          }

          .sg-landing {
            scrollbar-width: none;
          }

          .sg-landing::-webkit-scrollbar {
            width: 0;
            height: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-landing {
            scroll-behavior: auto;
          }

          .sg-phone-scroll,
          .sg-rank-row,
          .sg-chat-a,
          .sg-chat-b,
          .sg-chat-c,
          .sg-chat-d,
          .sg-marquee-track {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="sg-page-soft min-h-full">
        <header
          className={[
            "sg-nav fixed left-0 right-0 top-0 z-50 border-b border-[#ddb159]/18 bg-[#04180f]/96 text-white",
            navScrolled ? "sg-nav-scrolled" : "",
          ].join(" ")}
        >
          {showDisclaimer && (
            <div className="border-b border-white/10 bg-[#eef0ea] px-4 py-2 text-[#3f4c44]">
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
                <p className="text-center text-[11px] font-semibold leading-5 sm:text-xs">
                  StockGPT is a research and ranking tool. It does not provide financial
                  advice. Investing involves risk and you are responsible for your own
                  decisions.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDisclaimer(false)}
                  aria-label="Dismiss investment risk notice"
                  className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#3f4c44]/70 transition-colors hover:bg-[#dfe4dc] hover:text-[#0a2d1d] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d]"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-8">
            <Link
              href="/landing"
              className="relative h-10 w-[132px] shrink-0 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#04180f] sm:h-12 sm:w-[170px]"
              aria-label="StockGPT home"
            >
              <Image
                src="/logo.png"
                alt="StockGPT"
                fill
                priority
                className="object-contain object-left drop-shadow-[0_6px_14px_rgba(221,177,89,0.12)]"
                sizes="(max-width: 640px) 132px, 170px"
              />
            </Link>

            <nav className="hidden items-center gap-1 xl:flex">
              {navLinks.map((link) => (
                <button
                  key={link.target}
                  type="button"
                  onClick={() => scrollToSection(link.target)}
                  className="rounded-full px-4 py-2 text-sm font-bold !text-white/70 transition-colors hover:bg-white/[0.06] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                >
                  {link.label}
                </button>
              ))}

              <Link
                href="/affiliate"
                className="rounded-full px-4 py-2 text-sm font-bold !text-white/70 no-underline transition-colors hover:bg-white/[0.06] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
              >
                Affiliate
              </Link>
            </nav>

            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/login"
                className="inline-flex h-11 min-w-[96px] items-center justify-center rounded-full border border-white/18 bg-white px-5 text-[11px] font-black uppercase tracking-[0.16em] !text-[#04180f] no-underline transition-colors hover:bg-[#f6f2e8] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#04180f]"
              >
                Log in
              </Link>
              <SignupButton compact variant="gold">
                Create account
              </SignupButton>
            </div>

            <div className="sm:hidden">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#ddb159] bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.16em] !text-[#061b12] no-underline transition-colors hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#04180f]"
              >
                Log in
              </Link>
            </div>
          </div>
        </header>

        <section
          className={[
            "px-4 sm:px-6 lg:px-8",
            showDisclaimer ? "pt-[128px] sm:pt-[150px]" : "pt-[88px] sm:pt-[110px]",
          ].join(" ")}
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-[#ddb159]/28 bg-[#fff8e6] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828] sm:text-[11px]">
                  Stock research platform
                </div>

                <h1 className="sg-heading mt-5 text-[43px] font-medium leading-[0.96] text-[#071b11] sm:mt-6 sm:text-[68px] lg:text-[82px]">
                  Start your stock research with structure.
                </h1>

                <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#4f5f55] sm:mt-6 sm:text-lg sm:leading-8">
                  StockGPT scans{" "}
                  <span className="sg-data font-black text-[#0a2d1d]">
                    {stockCountLabel}
                  </span>{" "}
                  US stocks, ranks opportunities by research priority, connects news
                  to tickers and gives your portfolio a clearer research workflow.
                </p>

                <div className="mt-7 hidden flex-col gap-3 sm:flex sm:flex-row sm:items-start">
                  <SignupButton variant="green">Create free account</SignupButton>
                </div>

                <p className="mt-4 hidden max-w-lg text-xs leading-6 text-[#66746b] sm:block">
                  Create an account first. Explore the dashboard, then subscribe from
                  inside when you are ready. Informational research only.
                </p>
              </div>

              <TiltingIphoneDashboard metrics={metrics} />
            </div>
          </div>
        </section>

        <TrustStrip stockCountLabel={stockCountLabel} />

        <div className="mt-8 hidden sm:block">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <TickerMarquee tickerTape={tickerTape} />
          </div>
        </div>

        <div className="sm:hidden">
          <MobileDemoGroup label="Rankings" title="Rank the market first.">
            <RankingVisual />
          </MobileDemoGroup>

          <MobileDemoGroup label="Research tools" title="Plan, question, then decide.">
            <ResearchPlanVisual />
            <AskStockGPTVisual />
          </MobileDemoGroup>

          <MobileDemoGroup label="Portfolio and news" title="Connect holdings to market context.">
            <PortfolioVisual />
            <NewsVisual />
          </MobileDemoGroup>
        </div>

        <section id="rankings" className="hidden scroll-mt-32 px-4 py-12 sm:block sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div>
              <SectionLabel>Rankings</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Rank the market before you research.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                Start with a ranked research list instead of opening ten tabs and
                guessing where to begin. Create an account to explore the dashboard;
                deeper data remains locked until subscription.
              </p>
            </div>

            <RankingVisual />
          </div>
        </section>

        <section id="research" className="hidden scroll-mt-32 px-4 pb-12 sm:block sm:px-6 sm:pb-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <SectionLabel>Research tools</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Scenario planning and plain-English context.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#66746b]">
                Use the research plan to understand levels and risks, then use Ask
                StockGPT to question the thesis before making your own decision.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-stretch">
              <ResearchPlanVisual />
              <AskStockGPTVisual />
            </div>
          </div>
        </section>

        <section id="portfolio" className="hidden scroll-mt-32 px-4 pb-12 sm:block sm:px-6 sm:pb-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <SectionLabel>Portfolio and news</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Connect holdings to market context.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#66746b]">
                Add holdings, review exposure, import CSVs and connect market news
                back to relevant stocks and sectors.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-stretch">
              <PortfolioVisual />
              <NewsVisual />
            </div>
          </div>
        </section>

        <MethodAndTrustSection />

        <section id="pricing" className="scroll-mt-32 px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 rounded-[2rem] border border-[#dfe5dc] bg-white p-6 shadow-[0_24px_70px_rgba(7,27,17,0.06)] sm:p-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div>
                <SectionLabel>Access</SectionLabel>
                <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                  Create your account. Subscribe only when ready.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#66746b]">
                  Create an account first and explore the dashboard. Locked data and
                  premium research prompts the subscription inside the app.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-[#dfe5dc] bg-[#fbfaf6] p-5 sm:p-6">
                <div className="rounded-[1.4rem] border border-[#ddb159]/22 bg-white p-5 shadow-[0_18px_50px_rgba(7,27,17,0.06)] sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
                        Core access
                      </p>
                      <h3 className="sg-heading mt-2 text-4xl font-medium text-[#071b11]">
                        £18.99
                      </h3>
                      <p className="mt-1 text-sm font-bold text-[#66746b]">
                        per month after account creation
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-[#e8f7ee] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                      Free account first
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {pricingFeatures.map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-emerald-500/28 bg-emerald-500/10 text-[11px] text-emerald-700">
                          ✓
                        </span>
                        <span className="text-sm font-bold leading-6 text-[#0a2d1d]">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7">
                    <SignupButton full variant="green">
                      Create free account
                    </SignupButton>
                  </div>

                  <p className="mt-4 text-xs leading-6 text-[#66746b]">
                    Account creation does not send you to Stripe. Subscription is
                    prompted inside the app for locked premium data. Informational
                    research only. Not financial advice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-[#ddb159]/18 bg-[#fff8e6] p-6 sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <SectionLabel>Affiliate program</SectionLabel>
              <h2 className="sg-heading text-4xl font-medium leading-[1.05] text-[#071b11] sm:text-6xl">
                Earn with StockGPT.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#66746b]">
                Apply to partner with StockGPT and earn commission on approved
                subscriber referrals. Built for investors, creators and finance
                communities.
              </p>
            </div>

            <div className="rounded-3xl border border-[#ddb159]/24 bg-white p-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a6828]">
                Creator partner route
              </p>
              <p className="mt-3 text-sm leading-7 text-[#66746b]">
                The dedicated affiliate page collects applications directly.
              </p>
              <Link
                href="/affiliate"
                className="mt-6 inline-flex w-full justify-center rounded-full border border-[#0a2d1d]/20 bg-[#0a2d1d] px-6 py-3 text-sm font-black uppercase tracking-[0.14em] !text-white no-underline transition-colors hover:bg-[#0f3a27] focus:outline-none focus:ring-2 focus:ring-[#0a2d1d] focus:ring-offset-2 focus:ring-offset-white sm:w-auto"
              >
                Become an affiliate
              </Link>
            </div>
          </div>
        </section>

        <footer className="bg-[#061b12] px-4 py-10 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.15fr_1fr_1fr]">
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

              <p className="mt-5 max-w-sm text-sm leading-7 text-white/52">
                Stock rankings, portfolio tools and market intelligence for investors
                who want a clearer research process.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href === "#" ? undefined : "_blank"}
                    rel={link.href === "#" ? undefined : "noreferrer"}
                    aria-label={link.label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 !text-white/70 transition-colors hover:border-[#ddb159]/60 hover:!text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#061b12]"
                  >
                    <SocialIcon label={link.label} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#ddb159]">
                Platform
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-white/55">
                <Link href="/dashboard" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Dashboard
                </Link>
                <Link href="/rankings" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Rankings
                </Link>
                <Link href="/portfolio" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Portfolio
                </Link>
                <Link href="/world-news" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  News
                </Link>
                <Link href="/pricing" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Pricing
                </Link>
                <Link href="/affiliate" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Affiliate
                </Link>
                <Link href="/about" className="!text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  About
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#ddb159]">
                Access
              </p>
              <div className="space-y-3 text-sm font-semibold text-white/55">
                <Link href="/login" className="block !text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Log in
                </Link>
                <Link href="/signup" className="block !text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Create account
                </Link>
                <Link href="/affiliate" className="block !text-white/55 no-underline transition-colors hover:!text-[#ddb159]">
                  Apply as affiliate
                </Link>
              </div>

              <div className="mt-5">
                <LegalFooterLinks className="text-white/50" />
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/32">
                  Launch badge
                </p>
                <StartupBaseBadge />
              </div>
            </div>

            <div className="border-t border-white/[0.08] pt-5 md:col-span-3">
              <p className="text-[11px] leading-6 text-white/42">
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
      </div>
    </main>
  );
}
