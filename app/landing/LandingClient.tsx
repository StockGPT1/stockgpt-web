"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";

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
    label: "Illustrative top-10 return",
    target: 31.4,
    prefix: "+",
    suffix: "%",
    decimals: 1,
    detail: "example return spread vs benchmark",
  },
  {
    label: "Illustrative downside avoided",
    target: 18.6,
    prefix: "+",
    suffix: "%",
    decimals: 1,
    detail: "example protected capital scenario",
  },
  {
    label: "Illustrative winning periods",
    target: 83,
    suffix: "%",
    decimals: 0,
    detail: "example top-ranked basket periods",
  },
  {
    label: "Illustrative return capture",
    target: 4.2,
    suffix: "x",
    decimals: 1,
    detail: "example signal-to-return ratio",
  },
];

const features = [
  {
    id: "rankings",
    icon: "♛",
    title: "AI Rankings",
    copy:
      "Most investors start with too much information and no clear order of priority. StockGPT turns a noisy market into a ranked starting point, helping you focus on the stocks most worth researching first.",
  },
  {
    id: "portfolio",
    icon: "✦",
    title: "Portfolio Builder",
    copy:
      "A good portfolio is not just a list of stocks. StockGPT helps you compare holdings, spot weakening positions, and think more clearly about where capital may be better allocated.",
  },
  {
    id: "news",
    icon: "◈",
    title: "Market Context",
    copy:
      "News moves quickly, but not every headline matters. StockGPT brings rankings, market movement and news context together so you can understand what may actually affect your decisions.",
  },
];

const engineSteps = [
  {
    title: "Collect",
    copy: "Prices, rankings, fundamentals, sector context and market news are pulled into the StockGPT research layer.",
  },
  {
    title: "Normalise",
    copy: "Indicators are standardised so different stocks can be compared more fairly across sectors and market caps.",
  },
  {
    title: "Score",
    copy: "Each stock is assessed across Quality, Growth, Value, Momentum, Risk and Income.",
  },
  {
    title: "Risk-filter",
    copy: "Fragile, overextended or debt-stressed companies are penalised before the final ranking is shown.",
  },
  {
    title: "Rank & Deliver",
    copy: "The dashboard gives users a clearer place to begin research, with rankings, summaries, portfolio context and market tools in one place.",
  },
];

const navLinks = [
  { label: "Rankings", href: "#rankings-preview" },
  { label: "Features", href: "#features" },
  { label: "Affiliate", href: "/affiliate" },
  { label: "Pricing", href: "#pricing" },
];

const sparkStyles = [
  { left: "6%", top: "18%", delay: "0s", duration: "11s" },
  { left: "14%", top: "62%", delay: "1.8s", duration: "13s" },
  { left: "26%", top: "12%", delay: "0.7s", duration: "10s" },
  { left: "38%", top: "72%", delay: "2.4s", duration: "12s" },
  { left: "46%", top: "28%", delay: "1.1s", duration: "9.5s" },
  { left: "58%", top: "58%", delay: "3.2s", duration: "13s" },
  { left: "66%", top: "16%", delay: "2s", duration: "11.8s" },
  { left: "74%", top: "76%", delay: "4s", duration: "14s" },
  { left: "82%", top: "32%", delay: "0.5s", duration: "10.5s" },
  { left: "92%", top: "66%", delay: "2.6s", duration: "12.5s" },
];

const candleStyles = [
  { left: "8%", top: "25%", height: "44px", delay: "0.2s" },
  { left: "20%", top: "13%", height: "68px", delay: "1.5s" },
  { left: "32%", top: "42%", height: "52px", delay: "0.8s" },
  { left: "48%", top: "22%", height: "74px", delay: "2.1s" },
  { left: "62%", top: "52%", height: "46px", delay: "1.1s" },
  { left: "78%", top: "20%", height: "64px", delay: "2.8s" },
  { left: "88%", top: "44%", height: "58px", delay: "3.4s" },
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
  if (value == null || !Number.isFinite(value)) return "text-[#faf6f0]/48";
  if (value > 0) return "text-[#00ff88]";
  if (value < 0) return "text-red-300";
  return "text-[#faf6f0]/48";
}

function CheckoutButton({
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
          "sg-magnetic group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#ecc874] via-[#ddb159] to-[#b58a3a] font-black uppercase tracking-[0.16em] text-[#06180f] shadow-[0_18px_52px_rgba(221,177,89,0.32),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(221,177,89,0.5),inset_0_1px_0_rgba(255,255,255,0.5)] active:translate-y-0",
          full ? "w-full" : "max-sm:w-full",
          compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
        ].join(" ")}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-[#fff3cc] opacity-0 transition-opacity duration-500 group-hover:opacity-30" />
        <span className="relative z-10 flex items-center gap-2">
          {children}
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </button>
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
        "sg-magnetic group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[#ddb159]/50 bg-[#ddb159]/[0.03] font-black uppercase tracking-[0.16em] text-[#faf6f0] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[#ddb159] hover:bg-[#ddb159]/10 hover:text-[#ddb159] hover:shadow-[0_18px_50px_rgba(221,177,89,0.18)] max-sm:w-full",
        compact ? "px-4 py-2.5 text-[11px]" : "min-h-12 px-7 py-3 text-sm",
      ].join(" ")}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#ddb159]/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="sg-section-label mb-5 inline-flex items-center gap-2 rounded-full border border-[#ddb159]/30 bg-gradient-to-r from-[#ddb159]/12 via-[#ddb159]/8 to-[#ddb159]/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#ddb159] shadow-[0_0_32px_rgba(221,177,89,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.9)]" />
      <span className="sg-label-text">{children}</span>
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
      <div className="rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 px-4 py-3 text-sm font-bold text-[#faf6f0]/50 backdrop-blur">
        Live ticker data is loading from the market feed.
      </div>
    );
  }

  const repeated = [...tickerTape, ...tickerTape];

  return (
    <div className="sg-marquee-wrap relative overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/78 py-2.5 shadow-[0_20px_80px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
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
            className="group flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#04180f]/85 px-3 py-2 text-xs font-black text-[#faf6f0] transition-all duration-300 hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10 hover:shadow-[0_0_24px_rgba(221,177,89,0.18)]"
          >
            <span className="sg-data text-[#faf6f0]">{item.symbol}</span>
            <span className="sg-data text-[#faf6f0]/45">
              {formatMoney(item.price)}
            </span>
            <span className={["sg-data", toneClass(item.changePct)].join(" ")}>
              {item.changePct > 0 ? "▲" : item.changePct < 0 ? "▼" : "■"}{" "}
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
    <div className="sg-metric-card group relative overflow-hidden rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/82 p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[#ddb159]/45 hover:bg-[#ddb159]/[0.055] hover:shadow-[0_24px_60px_rgba(0,0,0,0.32),0_0_36px_rgba(221,177,89,0.16)]">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ddb159]/0 via-[#ddb159]/0 to-[#ddb159]/0 transition-all duration-500 group-hover:from-[#ddb159]/8 group-hover:via-transparent group-hover:to-[#00ff88]/4" />
      <p className="relative text-[10px] font-black uppercase tracking-[0.22em] text-[#faf6f0]/42">
        {label}
      </p>
      <p
        className={[
          "sg-data relative mt-2 text-2xl font-black",
          tone === "green" ? "text-[#00ff88]" : "text-[#ddb159]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="relative mt-1 truncate text-xs font-bold text-[#faf6f0]/42">
        {sub}
      </p>
    </div>
  );
}

function LockedRankingPreview({ metrics }: { metrics: LandingMetrics }) {
  const lockedRows = Array.from({ length: 8 });

  return (
    <div
      id="rankings-preview"
      className="sg-monitor sg-reveal relative scroll-mt-28 overflow-hidden rounded-[1.35rem] border border-[#ddb159]/24 bg-[#06180f]/86 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_40px_130px_rgba(0,0,0,0.58),0_0_90px_rgba(221,177,89,0.16)] backdrop-blur-xl sm:rounded-[2rem] sm:p-3"
    >
      <div className="sg-scanline pointer-events-none absolute inset-0 z-20 rounded-[1.35rem] sm:rounded-[2rem]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(221,177,89,0.18),transparent_30%),radial-gradient(circle_at_18%_8%,rgba(0,255,136,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]" />

      <div className="relative overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[#04180f]/94 sm:rounded-[1.55rem]">
        <div className="flex items-center gap-2 border-b border-[#ddb159]/10 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]/70" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]/70" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]/70" />
          <span className="sg-data ml-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#faf6f0]/35">
            stockgpt.terminal / live
          </span>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#ddb159]/16 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#ddb159] sm:text-[10px]">
              ✦ Market Intelligence
            </p>
            <h2 className="sg-heading mt-1 text-2xl font-light text-[#faf6f0] sm:text-3xl">
              Ranking Engine Active
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-[#00ff88]/25 bg-[#00ff88]/8 px-3 py-1.5 text-[10px] font-black text-[#00ff88] sm:text-[11px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
              </span>
              Live scan
            </span>
            <span className="rounded-full border border-[#ddb159]/20 bg-[#ddb159]/8 px-3 py-1.5 text-[10px] font-bold text-[#ddb159] sm:text-[11px]">
              Updated: {metrics.lastUpdatedLabel}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="grid grid-cols-[42px_minmax(0,1fr)_90px] border-b border-white/[0.08] px-3 py-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#faf6f0]/45 sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_90px_90px] md:text-[10px]">
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
                className="sg-row-shimmer grid grid-cols-[42px_minmax(0,1fr)_90px] items-center border-b border-white/[0.06] px-3 py-3 transition-colors hover:bg-[#ddb159]/[0.03] sm:px-4 md:grid-cols-[52px_minmax(140px,1fr)_minmax(150px,1fr)_90px_90px]"
                style={{ "--row-delay": `${index * 90}ms` } as CSSProperties}
              >
                <span className="sg-data text-sm font-black text-[#ddb159]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 text-[9px] font-black text-[#ddb159]">
                    ◆
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#faf6f0]">
                      High-priority stock identified
                    </span>
                    <span className="block truncate text-[10px] font-bold text-[#faf6f0]/38">
                      Ticker, score and rank movement available inside
                    </span>
                  </span>
                </span>

                <span className="hidden truncate text-sm font-bold text-[#faf6f0]/42 md:block">
                  AI signal ready
                </span>

                <span className="sg-data hidden text-sm font-bold text-[#faf6f0]/38 md:block">
                  Live
                </span>

                <span className="sg-data text-right text-sm font-black text-[#00ff88] md:text-left">
                  ••••
                </span>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#04180f]/18 via-[#04180f]/68 to-[#04180f]/92 px-4">
            <div className="sg-unlock-card pointer-events-auto max-w-[420px] rounded-[1.4rem] border border-[#ddb159]/40 bg-[#04180f]/94 p-5 text-center shadow-[0_0_46px_rgba(221,177,89,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ddb159]">
                Clarity starts here
              </p>
              <h3 className="sg-heading mt-2 text-3xl font-light text-[#faf6f0]">
                See the names behind the signals.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#faf6f0]/52">
                StockGPT gives you a ranked starting point, so you are not
                beginning every research session from a blank screen.
              </p>
              <div className="mt-5 flex justify-center">
                <CheckoutButton compact>Start Researching</CheckoutButton>
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

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { root: page, threshold: 0.14 },
    );

    page.querySelectorAll(".sg-reveal").forEach((element) => {
      revealObserver.observe(element);
    });

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

      const duration = 1600;
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

    const interactionCleanup: Array<() => void> = [];

    if (!reduceMotion) {
      page.querySelectorAll<HTMLElement>(".sg-tilt").forEach((el) => {
        const handleMove = (event: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          el.style.setProperty("--tx", `${x * 6}deg`);
          el.style.setProperty("--ty", `${-y * 6}deg`);
          el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
          el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
        };

        const handleLeave = () => {
          el.style.setProperty("--tx", "0deg");
          el.style.setProperty("--ty", "0deg");
        };

        el.addEventListener("mousemove", handleMove);
        el.addEventListener("mouseleave", handleLeave);
        interactionCleanup.push(() => {
          el.removeEventListener("mousemove", handleMove);
          el.removeEventListener("mouseleave", handleLeave);
        });
      });

      page.querySelectorAll<HTMLElement>(".sg-magnetic").forEach((el) => {
        const handleMove = (event: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = (event.clientX - rect.left - rect.width / 2) * 0.15;
          const y = (event.clientY - rect.top - rect.height / 2) * 0.15;
          el.style.transform = `translate(${x}px, ${y}px)`;
        };

        const handleLeave = () => {
          el.style.transform = "";
        };

        el.addEventListener("mousemove", handleMove);
        el.addEventListener("mouseleave", handleLeave);
        interactionCleanup.push(() => {
          el.removeEventListener("mousemove", handleMove);
          el.removeEventListener("mouseleave", handleLeave);
        });
      });
    }

    return () => {
      page.removeEventListener("scroll", handleScroll);
      revealObserver.disconnect();
      counterObserver.disconnect();
      interactionCleanup.forEach((fn) => fn());
    };
  }, []);

  return (
    <main
      ref={pageRef}
      className="sg-landing h-[100dvh] overflow-y-auto bg-[#072116] text-[#faf6f0]"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500;700;900&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');

        .sg-landing {
          --sg-bg: #072116;
          --sg-bg-deep: #03140c;
          --sg-green: #00ff88;
          --sg-heading: #faf6f0;
          --sg-body: rgba(250,246,240,0.58);
          --sg-gold: #ddb159;
          --sg-gold-bright: #f0c867;
          --sg-gold-deep: #b58a3a;
          font-family: "DM Sans", Inter, Arial, sans-serif;
          scrollbar-width: thin;
          scrollbar-color: rgba(221,177,89,0.42) rgba(255,255,255,0.04);
          scroll-behavior: smooth;
        }

        .sg-landing::-webkit-scrollbar { width: 8px; }
        .sg-landing::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .sg-landing::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(221,177,89,0.5), rgba(221,177,89,0.2));
          border-radius: 999px;
        }

        .sg-heading {
          font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif;
          letter-spacing: -0.02em;
          font-feature-settings: "liga", "dlig";
        }

        .sg-data {
          font-family: "IBM Plex Mono", "Courier New", monospace;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }

        .sg-section-label .sg-label-text {
          background: linear-gradient(90deg, #ddb159 0%, #f0c867 50%, #ddb159 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: sgGoldShimmer 4s linear infinite;
        }

        @keyframes sgGoldShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        .sg-nav {
          backdrop-filter: blur(24px) saturate(140%);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
          transition: border-color 320ms ease, background-color 320ms ease, box-shadow 320ms ease;
        }

        .sg-nav::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, transparent, rgba(221,177,89,0.1), transparent),
            radial-gradient(circle at 50% 0%, rgba(221,177,89,0.12), transparent 50%);
          opacity: 0.8;
        }

        .sg-nav-scrolled {
          border-bottom-color: rgba(221,177,89,0.4);
          background: rgba(4,24,15,0.96);
          box-shadow: 0 16px 50px rgba(0,0,0,0.4), 0 0 80px rgba(221,177,89,0.06);
        }

        .sg-nav-pill { position: relative; overflow: hidden; }
        .sg-nav-pill::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-110%);
          background: linear-gradient(90deg, transparent, rgba(221,177,89,0.24), transparent);
          transition: transform 700ms ease;
        }
        .sg-nav-pill:hover::after { transform: translateX(110%); }

        .sg-page-bg {
          background:
            radial-gradient(circle at 18% 8%, rgba(221,177,89,0.13), transparent 24%),
            radial-gradient(circle at 82% 18%, rgba(0,255,136,0.07), transparent 28%),
            linear-gradient(180deg, #072116 0%, #051a11 44%, #03140c 100%);
        }

        .sg-aurora {
          position: fixed;
          inset: -20%;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 60% 40% at 20% 30%, rgba(221,177,89,0.10), transparent 60%),
            radial-gradient(ellipse 50% 35% at 80% 60%, rgba(0,255,136,0.06), transparent 60%),
            radial-gradient(ellipse 40% 30% at 50% 80%, rgba(221,177,89,0.06), transparent 60%);
          filter: blur(40px);
          animation: sgAurora 24s ease-in-out infinite;
          opacity: 0.85;
        }

        @keyframes sgAurora {
          0%, 100% { transform: translate(0%, 0%) rotate(0deg) scale(1); }
          33% { transform: translate(2%, -3%) rotate(2deg) scale(1.04); }
          66% { transform: translate(-2%, 2%) rotate(-1deg) scale(0.98); }
        }

        .sg-grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.04;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
        }

        .sg-hero-grid {
          background-image:
            linear-gradient(rgba(221,177,89,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.035) 1px, transparent 1px);
          background-size: 74px 74px;
          animation: sgGridMove 24s linear infinite;
          mask-image: radial-gradient(circle at 50% 18%, black 0%, transparent 76%);
        }

        .sg-hero-glow { animation: sgPulseGlow 5s ease-in-out infinite; }

        .sg-word {
          display: inline-block;
          opacity: 0;
          transform: translateY(28px);
          filter: blur(8px);
          animation: sgWordIn 1100ms cubic-bezier(.2,.72,.16,1) forwards;
          animation-delay: var(--delay);
        }

        @keyframes sgWordIn {
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        .sg-italic-accent {
          font-style: italic;
          font-weight: 500;
          background: linear-gradient(135deg, #f0c867 0%, #ddb159 50%, #b58a3a 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .sg-marquee-track { animation: sgMarquee 34s linear infinite; }
        .sg-marquee-track:hover { animation-play-state: paused; }

        .sg-spark {
          position: absolute;
          height: 3px;
          width: 3px;
          border-radius: 999px;
          background: var(--sg-gold);
          box-shadow: 0 0 20px rgba(221,177,89,1), 0 0 6px rgba(221,177,89,1);
          opacity: 0;
          animation: sgSparkFloat var(--spark-duration) ease-in-out infinite;
          animation-delay: var(--spark-delay);
          z-index: 2;
        }

        .sg-candle {
          position: absolute;
          width: 1px;
          height: var(--candle-height);
          background: linear-gradient(180deg, transparent, rgba(221,177,89,0.45), transparent);
          opacity: 0.4;
          animation: sgCandlePulse 4.6s ease-in-out infinite;
          animation-delay: var(--candle-delay);
          z-index: 2;
        }

        .sg-candle::after {
          content: "";
          position: absolute;
          left: -4px;
          top: 35%;
          height: 18px;
          width: 8px;
          border: 1px solid rgba(221,177,89,0.4);
          background: linear-gradient(180deg, rgba(221,177,89,0.18), rgba(221,177,89,0.04));
          border-radius: 2px;
        }

        .sg-reveal {
          opacity: 0;
          transform: translateY(32px);
          filter: blur(6px);
          transition:
            opacity 900ms cubic-bezier(.2,.72,.16,1),
            transform 900ms cubic-bezier(.2,.72,.16,1),
            filter 900ms cubic-bezier(.2,.72,.16,1);
        }

        .sg-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }

        .sg-card {
          position: relative;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04);
          transition:
            transform 500ms cubic-bezier(.2,.72,.16,1),
            border-color 400ms ease,
            box-shadow 500ms ease,
            background 400ms ease;
          overflow: hidden;
        }

        .sg-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle 200px at var(--mx, 50%) var(--my, 50%), rgba(221,177,89,0.10), transparent 60%);
          opacity: 0;
          transition: opacity 400ms ease;
        }

        .sg-card:hover::before { opacity: 1; }
        .sg-card:hover {
          transform: translateY(-6px);
          border-color: rgba(221,177,89,0.48);
          background: rgba(221,177,89,0.06);
          box-shadow: 0 36px 110px rgba(0,0,0,0.4), 0 0 60px rgba(221,177,89,0.18), inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .sg-tilt {
          transform-style: preserve-3d;
          transform: perspective(900px) rotateY(var(--tx, 0deg)) rotateX(var(--ty, 0deg));
          transition: transform 400ms cubic-bezier(.2,.72,.16,1);
        }

        .sg-engine-line {
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 1500ms cubic-bezier(.2,.72,.16,1);
        }
        .engine-flow.is-visible .sg-engine-line { transform: scaleX(1); }

        .sg-engine-num { position: relative; }
        .sg-engine-num::before {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 1px solid rgba(221,177,89,0.4);
          opacity: 0;
          animation: sgRingPulse 3s ease-in-out infinite;
        }

        @keyframes sgRingPulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }

        .sg-scanline {
          background: linear-gradient(180deg, transparent 0%, rgba(0,255,136,0.05) 48%, rgba(0,255,136,0.18) 50%, rgba(0,255,136,0.05) 52%, transparent 100%);
          animation: sgScan 6s linear infinite;
        }

        @keyframes sgScan {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }

        .sg-row-shimmer {
          opacity: 0;
          animation: sgRowIn 700ms cubic-bezier(.2,.72,.16,1) forwards;
          animation-delay: var(--row-delay);
        }

        @keyframes sgRowIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .sg-unlock-card { animation: sgUnlockGlow 4s ease-in-out infinite; }

        @keyframes sgUnlockGlow {
          0%, 100% { box-shadow: 0 0 46px rgba(221,177,89,0.20), inset 0 1px 0 rgba(255,255,255,0.06); }
          50% { box-shadow: 0 0 72px rgba(221,177,89,0.36), inset 0 1px 0 rgba(255,255,255,0.08); }
        }

        .sg-stat-card { position: relative; overflow: hidden; }
        .sg-stat-card::after {
          content: "";
          position: absolute;
          top: -50%;
          right: -30%;
          width: 200px;
          height: 200px;
          background: conic-gradient(from 0deg, transparent, rgba(221,177,89,0.16), transparent 40%);
          animation: sgRotate 12s linear infinite;
          pointer-events: none;
          opacity: 0;
          transition: opacity 600ms ease;
        }
        .sg-stat-card:hover::after { opacity: 1; }
        @keyframes sgRotate { to { transform: rotate(360deg); } }

        .sg-pricing-card { position: relative; }
        .sg-pricing-card::before {
          content: "";
          position: absolute;
          inset: -1px;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(221,177,89,0.6), rgba(255,255,255,0.06) 30%, rgba(0,255,136,0.3) 60%, rgba(221,177,89,0.6));
          background-size: 300% 300%;
          animation: sgBorderFlow 8s linear infinite;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        @keyframes sgBorderFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }

        .sg-check-anim {
          display: inline-flex;
          width: 18px;
          height: 18px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(0,255,136,0.12);
          color: #00ff88;
          font-size: 11px;
          box-shadow: 0 0 14px rgba(0,255,136,0.18);
          flex-shrink: 0;
        }

        @keyframes sgGridMove {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-74px,74px,0); }
        }

        @keyframes sgPulseGlow {
          0%, 100% { opacity: 0.32; transform: scale(0.98); }
          50% { opacity: 0.64; transform: scale(1.05); }
        }

        @keyframes sgMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes sgSparkFloat {
          0% { opacity: 0; transform: translate3d(0, 16px, 0); }
          20% { opacity: 0.85; }
          70% { opacity: 0.32; }
          100% { opacity: 0; transform: translate3d(36px, -56px, 0); }
        }

        @keyframes sgCandlePulse {
          0%, 100% { opacity: 0.18; transform: translateY(0); }
          50% { opacity: 0.55; transform: translateY(-8px); }
        }

        @media (max-width: 760px) {
          .sg-marquee-track { animation-duration: 24s; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-landing,
          .sg-hero-grid,
          .sg-hero-glow,
          .sg-aurora,
          .sg-word,
          .sg-marquee-track,
          .sg-spark,
          .sg-candle,
          .sg-scanline,
          .sg-row-shimmer,
          .sg-unlock-card,
          .sg-stat-card::after,
          .sg-pricing-card::before,
          .sg-section-label .sg-label-text {
            animation: none !important;
          }

          .sg-word,
          .sg-reveal,
          .sg-row-shimmer {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }

          .sg-engine-line { transform: scaleX(1) !important; }
        }
      `}</style>

      <div className="sg-page-bg relative min-h-full overflow-hidden">
        <div className="sg-aurora" />
        <div className="sg-grain" />
        <div className="sg-hero-grid pointer-events-none fixed inset-0 opacity-50" />
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(4,24,15,0.18),rgba(4,24,15,0.02)_30%,rgba(3,20,12,0.36))]" />
        <div className="sg-hero-glow pointer-events-none fixed left-1/2 top-[6%] h-[340px] w-[760px] -translate-x-1/2 rounded-full bg-[#ddb159]/14 blur-3xl" />

        {sparkStyles.map((spark, index) => (
          <span
            key={`spark-${index}`}
            className="sg-spark"
            style={
              {
                left: spark.left,
                top: spark.top,
                "--spark-delay": spark.delay,
                "--spark-duration": spark.duration,
              } as CSSProperties
            }
          />
        ))}

        {candleStyles.map((candle, index) => (
          <span
            key={`candle-${index}`}
            className="sg-candle"
            style={
              {
                left: candle.left,
                top: candle.top,
                "--candle-height": candle.height,
                "--candle-delay": candle.delay,
              } as CSSProperties
            }
          />
        ))}

        <nav
          className={[
            "sg-nav sticky top-0 z-50 border-b border-[#ddb159]/16 bg-[#04180f]/88",
            navScrolled ? "sg-nav-scrolled" : "",
          ].join(" ")}
        >
          <div className="relative mx-auto flex h-[68px] max-w-[1540px] items-center justify-between px-4 sm:h-[76px] sm:px-6 lg:px-8">
            <Link href="/landing" className="flex items-center gap-3">
              <div className="relative h-11 w-[165px] sm:h-12 sm:w-[190px]">
                <Image
                  src="/logo.png"
                  alt="StockGPT"
                  fill
                  priority
                  className="object-contain object-left drop-shadow-[0_0_20px_rgba(221,177,89,0.22)]"
                  sizes="190px"
                />
              </div>
              <span className="hidden text-sm font-black text-[#ddb159] lg:inline">
                ✦
              </span>
            </Link>

            <div className="hidden rounded-full border border-[#ddb159]/18 bg-[#061b12]/72 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_40px_rgba(0,0,0,0.20)] lg:flex">
              {navLinks.map((item) =>
                item.href.startsWith("#") ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className="sg-nav-pill rounded-full px-5 py-2 text-sm font-black uppercase tracking-[0.14em] text-[#faf6f0]/72 transition hover:bg-[#ddb159]/10 hover:text-[#ddb159]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="sg-nav-pill rounded-full px-5 py-2 text-sm font-black uppercase tracking-[0.14em] text-[#faf6f0]/72 transition hover:bg-[#ddb159]/10 hover:text-[#ddb159]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>

            <div className="hidden sm:block">
              <GhostButton href="/login" compact>
                Log In →
              </GhostButton>
            </div>

            <Link
              href="/login"
              className="rounded-full border border-[#ddb159]/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] sm:hidden"
            >
              Login
            </Link>
          </div>
        </nav>

        <section className="relative z-10 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
          <div className="mx-auto grid max-w-[1540px] gap-3 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="hidden rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl xl:block">
              <div className="mb-5 rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/8 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                  Live platform
                </p>
                <p className="sg-data mt-2 text-3xl font-black text-[#faf6f0]">
                  {metrics.totalStocks.toLocaleString("en-GB")}
                </p>
                <p className="mt-1 text-xs font-bold text-[#faf6f0]/42">
                  stocks scanned
                </p>
              </div>

              <nav className="space-y-2">
                {[
                  ["♛", "Rankings", "#rankings-preview"],
                  ["✦", "Features", "#features"],
                  ["◇", "Affiliate", "/affiliate"],
                  ["◎", "Pricing", "#pricing"],
                ].map(([icon, label, href]) =>
                  href.startsWith("#") ? (
                    <a
                      key={href}
                      href={href}
                      className="group flex h-10 items-center gap-2 rounded-xl border border-transparent px-3 text-sm font-bold text-[#faf6f0]/72 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ddb159]/35 hover:bg-[#ddb159]/8 hover:text-[#faf6f0]"
                    >
                      <span className="w-5 text-center text-[#ddb159]">
                        {icon}
                      </span>
                      {label}
                    </a>
                  ) : (
                    <Link
                      key={href}
                      href={href}
                      className="group flex h-10 items-center gap-2 rounded-xl border border-transparent px-3 text-sm font-bold text-[#faf6f0]/72 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ddb159]/35 hover:bg-[#ddb159]/8 hover:text-[#faf6f0]"
                    >
                      <span className="w-5 text-center text-[#ddb159]">
                        {icon}
                      </span>
                      {label}
                    </Link>
                  ),
                )}
              </nav>

              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#04180f]/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#faf6f0]/40">
                  Market read
                </p>
                <p className="mt-2 text-xl font-black text-[#00ff88]">
                  {metrics.sentiment}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#faf6f0]/42">
                  The engine is live. StockGPT helps you start from structure,
                  not noise.
                </p>
              </div>
            </aside>

            <div className="grid gap-3">
              <section className="grid gap-3 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)]">
                <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/70 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-6 lg:p-7">
                  <div className="pointer-events-none absolute -right-20 -top-20 h-[360px] w-[360px] opacity-[0.07]">
                    <svg viewBox="0 0 500 600" className="h-full w-full">
                      <defs>
                        <linearGradient id="heroFlame" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ddb159" />
                          <stop offset="100%" stopColor="#f0c867" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 278 48 C 310 30, 360 65, 370 130 C 380 190, 352 242, 318 282 C 295 308, 278 334, 282 370 C 286 406, 308 428, 296 442 C 270 462, 212 432, 208 390 C 204 352, 226 316, 248 282 C 270 248, 282 208, 272 162 C 264 126, 246 78, 278 48 Z"
                        fill="url(#heroFlame)"
                      />
                      <path
                        d="M 208 218 C 228 194, 272 202, 278 240 C 284 274, 262 306, 240 334 C 222 356, 212 378, 218 406 C 200 396, 172 368, 172 336 C 172 300, 188 270, 208 218 Z"
                        fill="url(#heroFlame)"
                      />
                    </svg>
                  </div>

                  <div className="inline-flex items-center gap-3 rounded-full border border-[#ddb159]/30 bg-gradient-to-r from-[#ddb159]/14 via-[#ddb159]/8 to-[#ddb159]/14 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#ddb159] shadow-[0_0_38px_rgba(221,177,89,0.12)] sm:text-[11px]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ff88]" />
                    </span>
                    AI-powered market clarity
                  </div>

                  <h1 className="sg-heading relative mt-6 max-w-4xl text-[44px] font-light leading-[0.94] text-[#faf6f0] sm:text-[62px] lg:text-[70px] 2xl:text-[82px]">
                    {[
                      { word: "Stop", italic: false },
                      { word: "starting", italic: false },
                      { word: "from", italic: false },
                      { word: "noise.", italic: true },
                      { word: "Start", italic: false },
                      { word: "with", italic: false },
                      { word: "the", italic: false },
                      { word: "stocks", italic: false },
                      { word: "worth", italic: true },
                      { word: "researching.", italic: false },
                    ].map(({ word, italic }, index) => (
                      <span
                        key={`${word}-${index}`}
                        className={[
                          "sg-word mr-[0.22em]",
                          italic ? "sg-italic-accent" : "",
                        ].join(" ")}
                        style={{ "--delay": `${index * 70}ms` } as CSSProperties}
                      >
                        {word}
                      </span>
                    ))}
                  </h1>

                  <p className="relative mt-6 max-w-2xl text-base leading-8 text-[#faf6f0]/58 sm:text-lg">
                    Most investors are overloaded with apps, headlines and
                    opinions. StockGPT scans{" "}
                    <span className="sg-data font-black text-[#ddb159]">
                      {metrics.totalStocks.toLocaleString("en-GB")}
                    </span>{" "}
                    US stocks and turns the market into a clearer research
                    workflow.
                  </p>

                  <div className="relative mt-7 flex flex-col gap-3 sm:flex-row">
                    <CheckoutButton>Start with StockGPT</CheckoutButton>
                    <GhostButton href="/login">Log In</GhostButton>
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
                <div className="sg-card sg-reveal sg-tilt rounded-3xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                    The problem
                  </p>
                  <h2 className="sg-heading mt-2 text-3xl font-light">
                    Too much noise.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/52">
                    Retail investors are surrounded by tickers, headlines and
                    opinions, but very little structure for deciding where to
                    look first.
                  </p>
                </div>

                <div className="sg-card sg-reveal sg-tilt rounded-3xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                    The shift
                  </p>
                  <h2 className="sg-heading mt-2 text-3xl font-light">
                    Start ranked.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/52">
                    StockGPT gives your research a clearer order of priority, so
                    you are not beginning each decision from a blank screen.
                  </p>
                </div>

                <div className="sg-card sg-reveal sg-tilt rounded-3xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                    The workflow
                  </p>
                  <h2 className="sg-heading mt-2 text-3xl font-light">
                    Research faster.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/52">
                    Rankings, portfolio context, market news and AI research sit
                    inside one premium dashboard-style experience.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="features" className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="mx-auto max-w-[1540px] rounded-3xl border border-white/[0.08] bg-[#04180f]/74 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-8">
            <div className="sg-reveal text-center">
              <SectionLabel>Core Features</SectionLabel>
              <h2 className="sg-heading text-4xl font-light leading-[1.04] text-[#faf6f0] sm:text-6xl">
                A calmer way to{" "}
                <span className="sg-italic-accent">understand</span> the market.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#faf6f0]/52">
                StockGPT is built around one simple idea: investors make better
                decisions when research starts with structure instead of noise.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  id={feature.id}
                  key={feature.title}
                  className="sg-card sg-reveal sg-tilt scroll-mt-28 rounded-3xl p-7"
                >
                  <div className="mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-2xl border border-[#ddb159]/30 bg-gradient-to-br from-[#ddb159]/14 to-[#ddb159]/4 text-3xl text-[#ddb159] shadow-[0_0_32px_rgba(221,177,89,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]">
                    {feature.icon}
                  </div>
                  <h3 className="sg-heading text-3xl font-light text-[#faf6f0]">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-8 text-[#faf6f0]/52">
                    {feature.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="mx-auto max-w-[1540px] rounded-3xl border border-white/[0.08] bg-[#061b12]/64 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.26)] backdrop-blur-xl sm:p-8">
            <div className="sg-reveal">
              <SectionLabel>Illustrative Returns</SectionLabel>
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                <div>
                  <h2 className="sg-heading max-w-3xl text-4xl font-light leading-[1.05] text-[#faf6f0] sm:text-6xl">
                    Return <span className="sg-italic-accent">scenarios</span>,
                    not fake testimonials.
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-[#faf6f0]/52">
                    These figures are illustrative examples only. They are not
                    live performance data, not financial advice, and not a
                    guarantee of future returns.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {resultStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="sg-card sg-stat-card sg-reveal rounded-2xl p-5"
                    >
                      <p className="relative min-h-[38px] text-[10px] font-black uppercase tracking-[0.2em] text-[#faf6f0]/42">
                        {stat.label}
                      </p>
                      <p className="relative mt-4 text-4xl font-black text-[#ddb159] drop-shadow-[0_0_24px_rgba(221,177,89,0.32)] sm:text-5xl">
                        <StatCounter
                          target={stat.target}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                          decimals={stat.decimals}
                        />
                      </p>
                      <p className="relative mt-3 text-xs font-bold text-[#faf6f0]/42">
                        {stat.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                [
                  "Momentum rotation example",
                  "+22.8%",
                  "Illustrative top-ranked basket return",
                ],
                [
                  "Risk reduction example",
                  "-28.0%",
                  "Illustrative drawdown avoided after risk deterioration",
                ],
                [
                  "Portfolio reallocation example",
                  "+14.6%",
                  "Illustrative uplift from replacing weak-ranked holdings",
                ],
              ].map(([title, value, detail]) => (
                <article
                  key={title}
                  className="sg-card sg-reveal sg-tilt rounded-2xl border-l-2 border-l-[#ddb159] p-5"
                >
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#faf6f0]/42">
                    {title}
                  </p>
                  <p className="sg-data mt-4 text-4xl font-black text-[#00ff88] drop-shadow-[0_0_20px_rgba(0,255,136,0.22)]">
                    {value}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#faf6f0]/48">
                    {detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="mx-auto max-w-[1540px] rounded-3xl border border-white/[0.08] bg-[#061b12]/64 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.26)] backdrop-blur-xl sm:p-8">
            <div className="sg-reveal">
              <SectionLabel>How StockGPT Works</SectionLabel>
              <h2 className="sg-heading text-4xl font-light leading-[1.05] text-[#faf6f0] sm:text-6xl">
                How the engine <span className="sg-italic-accent">thinks</span>.
              </h2>
              <p className="mt-4 text-lg text-[#faf6f0]/52">
                Live market inputs. AI scoring. One clearer starting point for
                your research.
              </p>
            </div>

            <div className="engine-flow sg-reveal relative mt-12">
              <div className="sg-engine-line absolute left-0 top-[35px] hidden h-px w-full bg-gradient-to-r from-[#ddb159] via-[#ddb159]/45 to-transparent lg:block" />

              <div className="grid gap-4 lg:grid-cols-5">
                {engineSteps.map((step, index) => (
                  <article
                    key={step.title}
                    className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur transition-all duration-500 hover:-translate-y-2 hover:border-[#ddb159]/40 hover:bg-[#ddb159]/[0.05] hover:shadow-[0_24px_60px_rgba(0,0,0,0.32),0_0_40px_rgba(221,177,89,0.14)]"
                  >
                    <div className="sg-engine-num sg-data mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#ddb159]/40 bg-gradient-to-br from-[#ddb159]/14 to-[#ddb159]/4 text-lg font-black text-[#ddb159] shadow-[0_0_30px_rgba(221,177,89,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="sg-heading text-2xl font-light text-[#faf6f0]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#faf6f0]/50">
                      {step.copy}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="affiliate" className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5">
          <div className="sg-reveal mx-auto grid max-w-[1540px] gap-6 rounded-3xl border border-[#ddb159]/22 bg-[linear-gradient(135deg,rgba(221,177,89,0.14),rgba(255,255,255,0.035)_38%,rgba(0,255,136,0.035))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-[#ddb159]/30 bg-[#ddb159]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] text-[#ddb159]">
                Affiliate Program
              </p>
              <h2 className="sg-heading text-4xl font-light leading-[1.05] text-[#faf6f0] sm:text-6xl">
                <span className="sg-italic-accent">Earn</span> with StockGPT.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#faf6f0]/52">
                Apply to partner with StockGPT and earn commission on approved
                subscriber referrals. Built for investors, creators and finance
                communities.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ddb159]">
                Creator partner route
              </p>
              <p className="mt-3 text-sm leading-7 text-[#faf6f0]/50">
                The dedicated affiliate page collects applications directly. No
                missing external link is required.
              </p>
              <Link
                href="/affiliate"
                className="sg-magnetic group relative mt-6 inline-flex w-full justify-center overflow-hidden rounded-full border border-[#ddb159]/55 px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#ddb159] transition-all duration-500 hover:-translate-y-1 hover:bg-[#ddb159]/10 hover:shadow-[0_20px_60px_rgba(221,177,89,0.18)] sm:w-auto"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#ddb159]/30 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                <span className="relative">Become an Affiliate →</span>
              </Link>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="relative z-10 px-3 pb-3 sm:px-4 lg:px-5"
        >
          <div className="mx-auto max-w-[1540px] rounded-3xl border border-[#ddb159]/18 bg-[radial-gradient(circle_at_50%_0%,rgba(221,177,89,0.12),transparent_34%),#04180f] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div className="sg-reveal text-left">
                <SectionLabel>Pricing</SectionLabel>
                <h2 className="sg-heading text-4xl font-light leading-[1.05] text-[#faf6f0] sm:text-6xl">
                  A clearer research workflow,{" "}
                  <span className="sg-italic-accent">without</span> the market
                  noise.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#faf6f0]/52">
                  Start with a ranked view of the market, then use portfolio
                  tools, news context and AI research to decide what deserves
                  your attention.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <CheckoutButton>Start with StockGPT</CheckoutButton>
                  <GhostButton href="/login">Log In</GhostButton>
                </div>
              </div>

              <div className="sg-pricing-card sg-card sg-reveal rounded-3xl p-6 text-left sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="w-fit rounded-full border border-[#ddb159]/30 bg-[#ddb159]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                    ✦ Core Plan
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#faf6f0]/42">
                    Full access
                  </p>
                </div>

                <div className="mt-7 flex items-end gap-3">
                  <p className="sg-data text-5xl font-black text-[#faf6f0] drop-shadow-[0_0_30px_rgba(221,177,89,0.22)] sm:text-6xl">
                    £18.99
                  </p>
                  <p className="pb-2 text-base font-bold text-[#faf6f0]/46">
                    / month
                  </p>
                </div>

                <ul className="mt-7 space-y-3.5 text-base font-bold text-[#faf6f0]">
                  {[
                    `AI stock rankings across ${metrics.totalStocks.toLocaleString(
                      "en-GB",
                    )} stocks`,
                    "Daily AI scores and rank movements",
                    "World news and stock market impact",
                    "AI Portfolio Builder and alerts",
                    "Ask StockGPT chatbot",
                    "Research guidance and market context",
                    "Live market updates",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="sg-check-anim mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <CheckoutButton full>Continue to Access</CheckoutButton>
                </div>

                <form
                  action="/api/premium-waitlist"
                  method="post"
                  className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
                >
                  <p className="text-sm font-bold text-[#faf6f0]/50">
                    ◻ Executive tier coming soon — join the waitlist.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="Email address"
                      className="min-h-11 flex-1 rounded-full border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#faf6f0] outline-none transition-colors placeholder:text-[#faf6f0]/30 focus:border-[#ddb159]/60 focus:shadow-[0_0_24px_rgba(221,177,89,0.16)]"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-[#ddb159]/35 px-5 py-3 text-sm font-black text-[#ddb159] transition hover:-translate-y-0.5 hover:bg-[#ddb159]/10 hover:shadow-[0_10px_30px_rgba(221,177,89,0.12)]"
                    >
                      Join →
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 px-3 pb-5 sm:px-4 lg:px-5">
          <div className="mx-auto grid max-w-[1540px] gap-8 rounded-3xl border border-white/[0.08] bg-[#04180f]/72 p-7 backdrop-blur-xl md:grid-cols-[1.15fr_1fr_1fr]">
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
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#faf6f0]/48">
                AI-powered stock rankings, portfolio tools and market
                intelligence.
              </p>
            </div>

            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.26em] text-[#ddb159]">
                Platform
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm font-bold text-[#faf6f0]/50">
                <Link href="/" className="transition-colors hover:text-[#ddb159]">
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
              <p className="mb-4 text-xs font-black uppercase tracking-[0.26em] text-[#ddb159]">
                Access
              </p>
              <div className="space-y-3 text-sm font-bold text-[#faf6f0]/50">
                <Link href="/login" className="block transition-colors hover:text-[#ddb159]">
                  Log In →
                </Link>
                <Link href="/affiliate" className="block transition-colors hover:text-[#ddb159]">
                  Apply as affiliate →
                </Link>
                <Link href="/pricing" className="block transition-colors hover:text-[#ddb159]">
                  Subscription →
                </Link>
              </div>
            </div>

            <div className="border-t border-white/[0.08] pt-5 md:col-span-3">
              <p className="text-[11px] leading-6 text-[#4a6a5a]">
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
