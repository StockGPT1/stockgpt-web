"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LandingMetrics } from "./ScrollLandingScreens";
import {
  ChatScreen,
  FixedScale,
  NewsScreen,
  PhoneDashboardScreen,
  PortfolioScreen,
  RankingsScreen,
} from "./ScrollLandingScreens";

const PHONE_SCROLL_SHIFT = 220;
const SCENE_COUNT = 6;

const MORPH_ACTORS = [
  { key: "app-header", arcX: -64, arcY: -34, rotation: -1.5, lag: 0 },
  { key: "briefing", arcX: 84, arcY: -48, rotation: 2, lag: 0.03 },
  { key: "rankings", arcX: 88, arcY: 72, rotation: 2.5, lag: 0.07 },
  { key: "nav", arcX: -110, arcY: 58, rotation: -2, lag: 0.04 },
] as const;

const DOT_STOPS = [
  "Intro",
  "Rankings",
  "Portfolio",
  "World News",
  "Ask StockGPT",
  "Get started",
] as const;

type MorphActor = {
  source: HTMLElement;
  target: HTMLElement;
  clone: HTMLElement;
  sourceRect: DOMRect;
  targetRect: DOMRect;
  sourceRadius: number;
  targetRadius: number;
  arcX: number;
  arcY: number;
  rotation: number;
  lag: number;
};

type SurfaceGeometry = {
  sourceRect: DOMRect;
  targetRect: DOMRect;
  sourceRadius: number;
  targetRadius: number;
};

type SceneCopyDef = {
  index: string;
  eyebrow: string;
  title: ReactNode;
  body: string;
  chips: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function seg(value: number, start: number, end: number) {
  return clamp01((value - start) / (end - start));
}

const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInOut = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
const lerp = (start: number, end: number, value: number) => start + (end - start) * value;

const SCENE_COPY: SceneCopyDef[] = [
  {
    index: "01",
    eyebrow: "Rankings",
    title: <><span>Every stock. Scored. </span><em className="sl-gold not-italic">Ranked.</em></>,
    body:
      "StockGPT scans 500+ US stocks every day and distils quality, growth, value, momentum, risk and income into one score — so your research starts at the top of a ranked list, not in a hundred open tabs.",
    chips: ["Daily model runs", "Six-factor scoring", "Rank movement tracking"],
  },
  {
    index: "02",
    eyebrow: "Portfolio",
    title: <><span>See the whole picture. </span><em className="sl-gold not-italic">Act with context.</em></>,
    body:
      "Track value, return, health, concentration and model conviction in the same portfolio workspace you use after signing in. Import real positions and StockGPT keeps the context current.",
    chips: ["Portfolio health", "Reliable performance history", "Exposure monitoring"],
  },
  {
    index: "03",
    eyebrow: "World News",
    title: <><span>The world moves. </span><em className="sl-gold not-italic">Your watchlist feels it.</em></>,
    body:
      "World News connects global headlines to the tickers they actually touch — scored for impact, mapped to sectors, and written in plain English. You know why the market moved before you have to ask.",
    chips: ["Ticker mapping", "Impact scoring", "Sector context"],
  },
  {
    index: "04",
    eyebrow: "Ask StockGPT",
    title: <><span>Ask anything. </span><em className="sl-gold not-italic">Interrogate everything.</em></>,
    body:
      "Ask StockGPT sits on top of the entire ranking engine. Question a score, stress-test a thesis, compare two tickers side by side — and get answers grounded in the same data that builds the rankings, not vibes.",
    chips: ["Grounded in live rankings", "Thesis stress-tests", "Plain-English answers"],
  },
];

function GoldButton({ href, children, ghost = false }: { href: string; children: ReactNode; ghost?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-12 items-center justify-center rounded-full px-7 text-[12px] font-black uppercase tracking-[0.16em] no-underline transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black",
        ghost
          ? "border border-white/25 bg-white/[0.04] !text-white hover:bg-white/[0.09]"
          : "border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a_0%,#ddb159_55%,#c99a3e_100%)] !text-[#071b11] shadow-[0_10px_40px_rgba(221,177,89,0.35)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SceneCopy({ copy }: { copy: SceneCopyDef }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 text-center">
      <p className="sl-e0 sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
        {copy.index} · {copy.eyebrow}
      </p>
      <h2 className="sl-e1 mt-3 text-[clamp(26px,4.6vw,52px)] font-black leading-[1.02] tracking-[-0.04em] text-white">
        {copy.title}
      </h2>
      <p className="sl-e2 mx-auto mt-4 max-w-2xl text-[clamp(12.5px,1.25vw,16px)] font-medium leading-relaxed text-white/55">
        {copy.body}
      </p>
      <div className="sl-e3 mt-4 flex flex-wrap items-center justify-center gap-2">
        {copy.chips.map((chip) => (
          <span key={chip} className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[10.5px] font-black uppercase tracking-[0.12em] text-white/60">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div data-sl-monitor className="relative" style={{ width: "min(1120px, 91vw, 98vh)" }}>
      <div className="pointer-events-none absolute inset-[1.1%_-0.55%_-1.2%_0.55%] rounded-[20px] border border-white/[0.035] bg-[#070a09] shadow-[18px_28px_70px_rgba(0,0,0,.62)]" />
      <div
        data-sl-monitor-bezel
        className="relative overflow-hidden rounded-[19px] border border-white/20 bg-[linear-gradient(135deg,#777d79_0%,#343937_3%,#111514_11%,#080b0a_52%,#282d2a_91%,#5f6561_98%,#171a19_100%)] p-[7px] pb-[12px]"
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.9),0 46px 110px rgba(0,0,0,.74),0 12px 34px rgba(0,0,0,.58),0 0 90px rgba(221,177,89,.065),inset 0 1px 0 rgba(255,255,255,.3),inset 1px 0 0 rgba(255,255,255,.08)" }}
      >
        <div className="pointer-events-none absolute inset-[2px] rounded-[16px] border border-black/75" />
        <div className="absolute left-1/2 top-[2px] z-20 flex h-[5px] -translate-x-1/2 items-center gap-1.5">
          <i className="size-[4px] rounded-full border border-white/10 bg-[#010302] shadow-[inset_0_0_2px_rgba(49,117,87,.65)]" />
          <i className="size-[2px] rounded-full bg-white/20" />
        </div>
        <div data-sl-monitor-screen className="relative overflow-hidden rounded-[12px] border border-black bg-[#04120b] shadow-[inset_0_0_0_1px_rgba(255,255,255,.035)]" style={{ aspectRatio: "1280 / 756" }}>
          {children}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,.075)_0%,rgba(255,255,255,.016)_16%,transparent_33%,transparent_77%,rgba(255,255,255,.018)_100%)]" />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_18px_rgba(0,0,0,.58)]" />
        </div>
        <div className="absolute bottom-[4px] left-1/2 h-[2px] w-20 -translate-x-1/2 rounded-full opacity-45 [background:repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_1px,transparent_1px_4px)]" />
        <span className="absolute bottom-[3px] left-4 text-[5px] font-black uppercase tracking-[0.28em] text-white/15">StockGPT</span>
        <i className="absolute bottom-[4px] right-4 size-[3px] rounded-full bg-emerald-400/90 shadow-[0_0_7px_rgba(52,211,153,.7)]" />
      </div>
      <div className="pointer-events-none absolute -bottom-6 left-1/2 h-9 w-[88%] -translate-x-1/2 rounded-[50%] bg-black/65 blur-2xl" />
    </div>
  );
}

function CinematicPhone() {
  return (
    <div className="relative" style={{ width: "min(310px, 62vw, 31vh)", aspectRatio: "393 / 852" }}>
      <div
        data-sl-phone-hardware
        className="absolute inset-0 rounded-[16.8%_/_7.8%]"
        style={{
          background: "linear-gradient(145deg,#787d79 0%,#343938 8%,#151918 24%,#555a56 42%,#1a1e1d 62%,#666b66 80%,#171b1a 100%)",
          boxShadow: "0 70px 150px rgba(0,0,0,.88),0 26px 58px rgba(0,0,0,.68),0 0 90px rgba(221,177,89,.1),inset 0 0 0 1px rgba(255,255,255,.24)",
        }}
      >
        <div className="absolute inset-[.75%] rounded-[16.2%_/_7.45%] border border-white/10" />
        <div className="absolute -left-[1.15%] top-[18%] h-[4.6%] w-[1.35%] rounded-l-md bg-[linear-gradient(90deg,#777c77,#202423)]" />
        <div className="absolute -left-[1.15%] top-[26.5%] h-[8.2%] w-[1.35%] rounded-l-md bg-[linear-gradient(90deg,#777c77,#202423)]" />
        <div className="absolute -left-[1.15%] top-[37%] h-[8.2%] w-[1.35%] rounded-l-md bg-[linear-gradient(90deg,#777c77,#202423)]" />
        <div className="absolute -right-[1.15%] top-[29%] h-[12%] w-[1.35%] rounded-r-md bg-[linear-gradient(270deg,#777c77,#202423)]" />
      </div>
      <div data-sl-phone-hardware className="absolute inset-[1.25%_2.65%] rounded-[15.7%_/_7.35%] bg-[#020303] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" />
      <div data-sl-phone-screen data-sl-phone-hardware className="absolute inset-[2.05%_3.55%] overflow-hidden rounded-[14.1%_/_6.6%] bg-[#04120b]">
        <FixedScale w={393} h={852} mode="cover"><PhoneDashboardScreen /></FixedScale>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,.16)_0%,rgba(255,255,255,.045)_17%,transparent_29%,transparent_68%,rgba(255,255,255,.035)_88%)]" />
      </div>
      <div data-sl-phone-hardware className="absolute left-1/2 top-[3.35%] z-10 h-[3.35%] w-[30%] -translate-x-1/2 rounded-full bg-black shadow-[0_1px_2px_rgba(255,255,255,.07)]">
        <div className="absolute right-[10%] top-1/2 aspect-square h-[43%] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#1c2940,#06090d_60%)]" />
        <div className="absolute left-[17%] top-1/2 h-[12%] w-[34%] -translate-y-1/2 rounded-full bg-[#161a19]" />
      </div>
      <div data-sl-phone-hardware className="absolute bottom-[3.15%] left-1/2 z-10 h-[.55%] w-[32%] -translate-x-1/2 rounded-full bg-white/82" />
    </div>
  );
}

function TopNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="StockGPT home" className="relative h-10 w-[140px] focus:outline-none focus:ring-2 focus:ring-[#ddb159] sm:h-11 sm:w-[160px]">
          <Image src="/logo.png" alt="StockGPT" fill priority className="object-contain object-left drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]" sizes="160px" />
        </Link>
        <div className="flex items-center gap-2.5">
          <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:border-white/20 sm:bg-black/30 sm:!text-white sm:backdrop-blur-md sm:hover:bg-white/10">Log in</Link>
          <Link href="/signup" className="hidden h-11 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:inline-flex">Create account</Link>
        </div>
      </div>
    </header>
  );
}

function FinaleContent() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center">
      <p className="sl-e0 sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">Your move</p>
      <h2 className="sl-e1 mt-4 text-[clamp(30px,5.4vw,62px)] font-black leading-[1.02] tracking-[-0.04em] text-white">Start your research<br /><span className="sl-gold">with structure.</span></h2>
      <p className="sl-e2 mt-5 max-w-xl text-[clamp(13px,1.3vw,16px)] font-medium leading-relaxed text-white/55">Create a free account, explore the dashboard, and subscribe inside only when you&apos;re ready. Rankings, portfolio tools, world news and Ask StockGPT — one workflow.</p>
      <div className="sl-e3 mt-8 flex flex-col items-center gap-3 sm:flex-row"><GoldButton href="/signup">Create free account</GoldButton><GoldButton href="/login" ghost>Log in</GoldButton></div>
      <div className="sl-e3 mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-white/40">
        <Link href="/about" className="!text-white/40 no-underline hover:!text-[#ddb159]">About</Link>
        <Link href="/pricing" className="!text-white/40 no-underline hover:!text-[#ddb159]">Pricing</Link>
        <Link href="/affiliate" className="!text-white/40 no-underline hover:!text-[#ddb159]">Affiliate</Link>
        <Link href="/legal" className="!text-white/40 no-underline hover:!text-[#ddb159]">Legal</Link>
      </div>
      <p className="sl-e3 mt-6 max-w-2xl text-[10px] leading-5 text-white/30">StockGPT is a research and ranking tool. All content is informational and educational, not financial advice. Investing involves risk — always do your own research. © 2026 StockGPT.</p>
    </div>
  );
}

function StaticLanding({ metrics }: { metrics: LandingMetrics }) {
  const screens = [<RankingsScreen key="r" metrics={metrics} />, <PortfolioScreen key="p" />, <NewsScreen key="n" />, <ChatScreen key="c" />];
  return (
    <div className="sl-bg min-h-screen">
      <TopNav />
      <section className="flex flex-col items-center px-6 pb-16 pt-32 text-center">
        <h1 className="text-[clamp(48px,10vw,110px)] font-black leading-none tracking-[-0.05em] text-white">StockGPT</h1>
        <p className="sl-mono mt-3 text-[clamp(12px,1.6vw,17px)] font-bold uppercase tracking-[0.42em] text-white/55">AI-driven market insights</p>
        <div className="mt-12"><CinematicPhone /></div>
      </section>
      {SCENE_COPY.map((copy, index) => (
        <section key={copy.index} className="flex flex-col items-center gap-8 px-4 py-16">
          <SceneCopy copy={copy} />
          <PanelFrame><FixedScale w={1280} h={756}>{screens[index]}</FixedScale></PanelFrame>
        </section>
      ))}
      <FinaleContent />
    </div>
  );
}

const LANDING_CSS = `
  .sl-root {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #020806;
    scrollbar-width: thin;
    scrollbar-color: #ddb159 #020806;
    overscroll-behavior: contain;
    scroll-snap-type: y mandatory;
  }
  .sl-root::-webkit-scrollbar { width: 11px; }
  .sl-root::-webkit-scrollbar-track { background: #020806; }
  .sl-root::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #f0cf7a, #ddb159 45%, #a7792f);
    border: 3px solid #020806;
    border-radius: 999px;
  }
  .sl-snap-anchor {
    height: 100dvh;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }
  .sl-mono {
    font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-variant-numeric: tabular-nums;
  }
  .sl-gold {
    background: linear-gradient(120deg, #f4d78a 10%, #ddb159 45%, #c08f2f 90%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sl-bg {
    background:
      radial-gradient(ellipse 90% 60% at 50% -12%, rgba(221,177,89,0.13), transparent 62%),
      radial-gradient(ellipse 60% 44% at 50% 112%, rgba(15,60,38,0.5), transparent 64%),
      linear-gradient(180deg, #030a07 0%, #020806 52%, #01110a 100%);
  }
  .sl-grain {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
    opacity: .05;
    mix-blend-mode: overlay;
  }
  .sl-vignette {
    background: radial-gradient(ellipse 78% 68% at 50% 46%, transparent 58%, rgba(0,0,0,.62) 100%);
  }

  .sl-copy .sl-e0 { --sl-delay: 0; }
  .sl-copy .sl-e1 { --sl-delay: .16; }
  .sl-copy .sl-e2 { --sl-delay: .32; }
  .sl-copy .sl-e3 { --sl-delay: .48; }
  .sl-copy .sl-e0, .sl-copy .sl-e1, .sl-copy .sl-e2, .sl-copy .sl-e3 {
    --sl-show: clamp(0, var(--copy-in, 1) * 1.85 - var(--sl-delay, 0), 1);
    --sl-hidden: clamp(0, 1 - var(--sl-show) + var(--copy-out, 0), 1);
    opacity: 1;
    clip-path: inset(calc(var(--sl-hidden) * 50.1%) 0 round calc(var(--sl-hidden) * 12px));
    transform: translate3d(calc(var(--sl-hidden) * 18px), calc(var(--sl-hidden) * 28px), 0);
    will-change: transform, clip-path;
  }

  .sl-workspace [data-sl-fragment] {
    --sl-build: clamp(0, (var(--workspace-in, 1) - var(--sl-delay, 0)) * 2.65, 1);
    --sl-hidden: clamp(0, 1 - var(--sl-build) + var(--workspace-out, 0), 1);
    opacity: 1;
    clip-path: inset(calc(var(--sl-hidden) * 50.1%) calc(var(--sl-hidden) * 3%) round calc(4px + var(--sl-hidden) * 14px));
    transform:
      translate3d(
        calc((1 - var(--sl-build)) * var(--sl-in-x, 0px) + var(--workspace-out, 0) * var(--sl-out-x, 0px)),
        calc((1 - var(--sl-build)) * var(--sl-in-y, 0px) + var(--workspace-out, 0) * var(--sl-out-y, 0px)),
        0
      )
      rotate(calc((1 - var(--sl-build) + var(--workspace-out, 0)) * var(--sl-rot, 0deg)))
      scale(calc(.95 + var(--sl-build) * .05 - var(--workspace-out, 0) * .025));
    transform-origin: center;
    will-change: transform, clip-path;
  }
  .sl-desktop [data-sl-monitor] {
    --sl-monitor-show: clamp(0, var(--desktop-in, 1) * 1.42, 1);
    --sl-monitor-hidden: clamp(0, 1 - var(--sl-monitor-show) + var(--desktop-out, 0), 1);
    opacity: 1;
    clip-path: inset(calc(var(--sl-monitor-hidden) * 50.1%) calc(var(--sl-monitor-hidden) * 2%) round calc(19px + var(--sl-monitor-hidden) * 20px));
    transform:
      perspective(1500px)
      translate3d(
        calc((1 - var(--sl-monitor-show)) * 34px + var(--desktop-out, 0) * -42px),
        calc((1 - var(--sl-monitor-show)) * 74px + var(--desktop-out, 0) * -30px),
        0
      )
      rotateX(calc((1 - var(--sl-monitor-show)) * 7deg + var(--desktop-out, 0) * -3deg))
      rotateY(calc((1 - var(--sl-monitor-show)) * -3deg + var(--desktop-out, 0) * 2deg))
      scale(calc(.91 + var(--sl-monitor-show) * .09 - var(--desktop-out, 0) * .035));
    transform-origin: center 72%;
    will-change: transform, clip-path;
  }
  .sl-desktop [data-sl-monitor-bezel] {
    transform: translateY(calc((1 - var(--sl-monitor-show)) * -10px));
  }
  .sl-workspace [data-sl-morph-target] {
    --sl-target-hidden: clamp(0, 1 - var(--sl-shared-reveal, 1), 1);
    opacity: 1 !important;
    clip-path: inset(0 calc(var(--sl-target-hidden) * 100%) 0 0 round 10px) !important;
    transform: translate3d(calc(var(--sl-target-hidden) * 18px), 0, 0) !important;
    filter: none !important;
  }

  [data-sl-phone-piece] {
    opacity: 1;
    clip-path: inset(calc(var(--phone-break, 0) * 50.1%) calc(var(--phone-break, 0) * 3%) round calc(8px + var(--phone-break, 0) * 16px));
    transform:
      translate3d(
        calc(var(--phone-break, 0) * var(--phone-x, 0px)),
        calc(var(--phone-break, 0) * var(--phone-y, 0px)),
        0
      )
      rotate(calc(var(--phone-break, 0) * var(--phone-r, 0deg)))
      scale(calc(1 - var(--phone-break, 0) * .035));
    will-change: transform, clip-path;
  }
  [data-sl-phone-hardware] {
    opacity: 1;
    clip-path: inset(calc(var(--phone-break, 0) * 50.1%) calc(var(--phone-break, 0) * 2%) round calc(var(--phone-break, 0) * 22px));
    transform: perspective(900px) rotateY(calc(var(--phone-break, 0) * 20deg)) scale(calc(1 - var(--phone-break, 0) * .56));
    transform-origin: center;
    will-change: transform, clip-path;
  }
  [data-sl-morph-actor] {
    backface-visibility: hidden;
    contain: layout paint style;
  }
  .sl-shared-surface {
    background:
      linear-gradient(112deg, rgba(255,255,255,.11), transparent 26%, transparent 74%, rgba(255,255,255,.025)),
      linear-gradient(180deg, #062117, #03140d);
    box-shadow: 0 28px 80px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.08);
    will-change: left, top, width, height, border-radius, clip-path;
  }

  .sl-finale .sl-e0 { --sl-delay: 0; }
  .sl-finale .sl-e1 { --sl-delay: .15; }
  .sl-finale .sl-e2 { --sl-delay: .3; }
  .sl-finale .sl-e3 { --sl-delay: .44; }
  .sl-finale .sl-e0, .sl-finale .sl-e1, .sl-finale .sl-e2, .sl-finale .sl-e3 {
    --sl-show: clamp(0, var(--finale-in, 0) * 1.9 - var(--sl-delay, 0), 1);
    --sl-hidden: clamp(0, 1 - var(--sl-show), 1);
    opacity: 1;
    clip-path: inset(calc(var(--sl-hidden) * 50.1%) 0 round 14px);
    transform: translate3d(0, calc(var(--sl-hidden) * 38px), 0);
    will-change: transform, clip-path;
  }

  .sl-dot {
    display: block;
    height: 8px;
    width: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.22);
    transition: background 220ms ease, transform 220ms ease, box-shadow 220ms ease;
  }
  .sl-dotbtn[data-active="1"] .sl-dot {
    background: #ddb159;
    transform: scale(1.45);
    box-shadow: 0 0 14px rgba(221,177,89,.65);
  }
  .sl-dotbtn .sl-dotlabel {
    position: absolute;
    right: 26px;
    top: 50%;
    transform: translateY(-50%) translateX(6px);
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease, transform 180ms ease;
  }
  .sl-dotbtn:hover .sl-dotlabel, .sl-dotbtn:focus-visible .sl-dotlabel {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }

  @keyframes slCue {
    0%, 100% { transform: translateY(0); opacity: .9; }
    50% { transform: translateY(9px); opacity: .4; }
  }
  .sl-cue-anim { animation: slCue 1.8s ease-in-out infinite; }

  @media (max-height: 760px) and (min-width: 768px) {
    .sl-desktop-copy { height: 24vh !important; }
    .sl-desktop-stack { gap: 1.2vh !important; padding-top: 8.5vh !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sl-cue-anim { animation: none !important; }
    [data-sl-phone-piece], [data-sl-phone-hardware], [data-sl-fragment],
    [data-sl-monitor], [data-sl-monitor-bezel], .sl-copy > div, .sl-finale > div {
      opacity: 1 !important;
      transform: none !important;
      clip-path: none !important;
    }
  }
`;

export function ScrollLandingClient({ metrics }: { metrics: LandingMetrics }) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const sharedSurfaceRef = useRef<HTMLDivElement | null>(null);
  const morphLayerRef = useRef<HTMLDivElement | null>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const workspaceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finaleRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const navigateRef = useRef<(scene: number) => void>(() => undefined);
  const [staticMode, setStaticMode] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStaticMode(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (staticMode) return;

    const scroller = scrollerRef.current;
    const phone = phoneRef.current;
    const tilt = tiltRef.current;
    const desktop = desktopRef.current;
    const sharedSurface = sharedSurfaceRef.current;
    const morphLayer = morphLayerRef.current;
    const finale = finaleRef.current;
    if (!scroller || !phone || !tilt || !desktop || !sharedSurface || !morphLayer || !finale) return;

    let activeScene = clamp(Math.round(scroller.scrollTop / Math.max(1, scroller.clientHeight)), 0, SCENE_COUNT - 1);
    let transitionFrom = activeScene;
    let transitionTarget = activeScene;
    let transitionStartedAt = 0;
    let transitionDuration = 0;
    let transitioning = false;
    let queuedScene: number | null = null;
    let syncingScroll = false;
    let phoneScroll: HTMLElement | null = null;
    let surfaceGeometry: SurfaceGeometry | null = null;
    let morphActors: MorphActor[] = [];
    let transitionRaf = 0;
    let remeasureRaf = 0;
    let lateRemeasure = 0;
    let syncTimer = 0;
    let settleTimer = 0;
    let continuationTimer = 0;
    let wheelResetTimer = 0;
    let wheelDelta = 0;
    let wheelConsumed = false;
    let touchStartY: number | null = null;

    const setNumber = (element: HTMLElement | null, property: string, value: number) => {
      element?.style.setProperty(property, value.toFixed(4));
    };

    const updateDots = (scene: number) => {
      dotRefs.current.forEach((dot, index) => {
        if (!dot) return;
        const active = index === scene;
        dot.dataset.active = active ? "1" : "0";
        if (active) dot.setAttribute("aria-current", "step");
        else dot.removeAttribute("aria-current");
      });
    };

    const clearMorphActors = () => {
      morphActors.forEach(({ source, target }) => {
        source.style.removeProperty("visibility");
        target.style.removeProperty("--sl-shared-reveal");
      });
      morphActors = [];
      surfaceGeometry = null;
      morphLayer.replaceChildren();
      sharedSurface.style.visibility = "hidden";
    };

    const findPhoneScroll = () => {
      phoneScroll = phone.querySelector<HTMLElement>("[data-sl-phone-scroll]");
    };

    const buildGeometry = () => {
      const rankingsWorkspace = workspaceRefs.current[0];
      const rankingsCopy = copyRefs.current[0];
      const phoneScreen = phone.querySelector<HTMLElement>("[data-sl-phone-screen]");
      const monitorScreen = desktop.querySelector<HTMLElement>("[data-sl-monitor-screen]");
      if (!rankingsWorkspace || !rankingsCopy || !phoneScroll || !phoneScreen || !monitorScreen) return;

      clearMorphActors();
      const saved = [
        [phone, phone.style.cssText],
        [tilt, tilt.style.cssText],
        [phoneScroll, phoneScroll.style.cssText],
        [desktop, desktop.style.cssText],
        [rankingsWorkspace, rankingsWorkspace.style.cssText],
        [rankingsCopy, rankingsCopy.style.cssText],
      ] as const;

      phone.style.visibility = "visible";
      phone.style.transform = "translate3d(0,-18px,0) scale(.98)";
      phone.style.setProperty("--phone-break", "0");
      tilt.style.transform = "perspective(1500px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
      phoneScroll.style.transform = `translate3d(0,${-PHONE_SCROLL_SHIFT}px,0)`;
      desktop.style.visibility = "visible";
      desktop.style.setProperty("--desktop-in", "1");
      desktop.style.setProperty("--desktop-out", "0");
      rankingsWorkspace.style.visibility = "visible";
      rankingsWorkspace.style.setProperty("--workspace-in", "1");
      rankingsWorkspace.style.setProperty("--workspace-out", "0");
      rankingsCopy.style.visibility = "visible";
      rankingsCopy.style.setProperty("--copy-in", "1");
      rankingsCopy.style.setProperty("--copy-out", "0");

      const layerRect = morphLayer.getBoundingClientRect();
      const relativeRect = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return new DOMRect(rect.left - layerRect.left, rect.top - layerRect.top, rect.width, rect.height);
      };

      const sourceSurfaceRect = relativeRect(phoneScreen);
      const targetSurfaceRect = relativeRect(monitorScreen);
      surfaceGeometry = {
        sourceRect: sourceSurfaceRect,
        targetRect: targetSurfaceRect,
        sourceRadius: parseFloat(getComputedStyle(phoneScreen).borderTopLeftRadius) || 28,
        targetRadius: parseFloat(getComputedStyle(monitorScreen).borderTopLeftRadius) || 12,
      };

      MORPH_ACTORS.forEach((definition, index) => {
        const source = phone.querySelector<HTMLElement>(`[data-sl-morph-source="${definition.key}"]`);
        const target = rankingsWorkspace.querySelector<HTMLElement>(`[data-sl-morph-target="${definition.key}"]`);
        if (!source || !target) return;

        const sourceRect = relativeRect(source);
        const targetRect = relativeRect(target);
        if (sourceRect.width < 1 || sourceRect.height < 1 || targetRect.width < 1 || targetRect.height < 1) return;

        const clone = source.cloneNode(true) as HTMLElement;
        clone.removeAttribute("data-sl-phone-piece");
        clone.removeAttribute("data-sl-morph-source");
        clone.querySelectorAll<HTMLElement>("[data-sl-phone-piece], [data-sl-morph-source]").forEach((node) => {
          node.removeAttribute("data-sl-phone-piece");
          node.removeAttribute("data-sl-morph-source");
        });
        clone.setAttribute("data-sl-morph-actor", definition.key);
        clone.setAttribute("aria-hidden", "true");
        Object.assign(clone.style, {
          position: "absolute",
          inset: "auto",
          left: "0",
          top: "0",
          width: `${sourceRect.width}px`,
          height: `${sourceRect.height}px`,
          margin: "0",
          opacity: "1",
          visibility: "hidden",
          pointerEvents: "none",
          transformOrigin: "top left",
          zIndex: String(20 + index),
          willChange: "transform, clip-path, border-radius",
        });
        morphLayer.appendChild(clone);
        morphActors.push({
          source,
          target,
          clone,
          sourceRect,
          targetRect,
          sourceRadius: parseFloat(getComputedStyle(source).borderTopLeftRadius) || 0,
          targetRadius: parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0,
          arcX: definition.arcX,
          arcY: definition.arcY,
          rotation: definition.rotation,
          lag: definition.lag,
        });
      });

      saved.forEach(([element, cssText]) => {
        element.style.cssText = cssText;
      });
    };

    const hideWorkspaces = () => {
      workspaceRefs.current.forEach((workspace) => {
        if (workspace) workspace.style.visibility = "hidden";
      });
      copyRefs.current.forEach((copy) => {
        if (copy) copy.style.visibility = "hidden";
      });
    };

    const applySharedSurface = (phase: number) => {
      if (!surfaceGeometry) {
        sharedSurface.style.visibility = "hidden";
        return;
      }
      const travel = easeInOut(seg(phase, .1, .9));
      const reveal = easeOut(seg(phase, .06, .2));
      const collapse = easeInOut(seg(phase, .82, .99));
      const hidden = clamp01(1 - reveal + collapse);
      const { sourceRect, targetRect, sourceRadius, targetRadius } = surfaceGeometry;
      sharedSurface.style.visibility = phase > .03 && phase < .995 ? "visible" : "hidden";
      sharedSurface.style.left = `${lerp(sourceRect.x, targetRect.x, travel)}px`;
      sharedSurface.style.top = `${lerp(sourceRect.y, targetRect.y, travel)}px`;
      sharedSurface.style.width = `${lerp(sourceRect.width, targetRect.width, travel)}px`;
      sharedSurface.style.height = `${lerp(sourceRect.height, targetRect.height, travel)}px`;
      sharedSurface.style.borderRadius = `${lerp(sourceRadius, targetRadius, travel)}px`;
      sharedSurface.style.clipPath = `inset(${hidden * 50.1}% 0 round ${lerp(sourceRadius, targetRadius, travel)}px)`;
    };

    const applyMorphActors = (phase: number) => {
      morphActors.forEach((actor, index) => {
        const travel = easeInOut(seg(phase, .12 + actor.lag, .88));
        const arc = Math.sin(Math.PI * travel);
        const resize = easeInOut(seg(travel, .18, .76));
        const targetScaleX = clamp(actor.targetRect.width / actor.sourceRect.width, .68, 1.38);
        const targetScaleY = clamp(actor.targetRect.height / actor.sourceRect.height, .68, 1.3);
        const scaleX = lerp(1, targetScaleX, resize);
        const scaleY = lerp(1, targetScaleY, resize);
        const destinationX = actor.targetRect.x + (actor.targetRect.width - actor.sourceRect.width * scaleX) / 2;
        const destinationY = actor.targetRect.y + (actor.targetRect.height - actor.sourceRect.height * scaleY) / 2;
        const x = lerp(actor.sourceRect.x, destinationX, travel) + actor.arcX * arc;
        const y = lerp(actor.sourceRect.y, destinationY, travel) + actor.arcY * arc;
        const radius = lerp(actor.sourceRadius, actor.targetRadius, travel);
        const handoff = easeInOut(seg(travel, .66, .98));
        const targetReveal = easeOut(seg(travel, .58 + index * .015, .96));

        actor.source.style.visibility = phase > .115 ? "hidden" : "visible";
        actor.target.style.setProperty("--sl-shared-reveal", targetReveal.toFixed(4));
        actor.clone.style.visibility = phase > .11 && phase < .985 ? "visible" : "hidden";
        actor.clone.style.transform = `translate3d(${x}px,${y}px,0) rotate(${actor.rotation * arc}deg) scale(${scaleX},${scaleY})`;
        actor.clone.style.borderRadius = `${radius}px`;
        actor.clone.style.clipPath = `inset(${handoff * 50.1}% 0 round ${Math.max(0, radius)}px)`;
        actor.clone.style.boxShadow = `0 ${12 + arc * 18}px ${26 + arc * 32}px rgba(0,0,0,${.26 + arc * .24})`;
      });
    };

    const renderIdle = (scene: number) => {
      hideWorkspaces();
      const intro = scene === 0;
      const desktopScene = scene >= 1 && scene <= 4;

      phone.style.visibility = intro ? "visible" : "hidden";
      phone.style.transform = "translate3d(0,26px,0) scale(.96)";
      phone.style.setProperty("--phone-break", "0");
      tilt.style.transform = "perspective(1500px) rotateX(6deg) rotateY(-24deg) rotateZ(-8deg)";
      if (phoneScroll) phoneScroll.style.transform = "translate3d(0,0,0)";

      if (heroTitleRef.current) {
        heroTitleRef.current.style.visibility = intro ? "visible" : "hidden";
        heroTitleRef.current.style.clipPath = "inset(0)";
        heroTitleRef.current.style.transform = "translate3d(0,0,0)";
      }
      if (cueRef.current) {
        cueRef.current.style.visibility = intro ? "visible" : "hidden";
        cueRef.current.style.clipPath = "inset(0)";
      }
      if (glowRef.current) glowRef.current.style.opacity = intro ? "1" : ".38";

      desktop.style.visibility = desktopScene ? "visible" : "hidden";
      setNumber(desktop, "--desktop-in", desktopScene ? 1 : 0);
      setNumber(desktop, "--desktop-out", 0);
      workspaceRefs.current.forEach((workspace, index) => {
        if (!workspace) return;
        const active = desktopScene && index === scene - 1;
        workspace.style.visibility = active ? "visible" : "hidden";
        workspace.style.zIndex = active ? "2" : "1";
        setNumber(workspace, "--workspace-in", active ? 1 : 0);
        setNumber(workspace, "--workspace-out", 0);
      });
      copyRefs.current.forEach((copy, index) => {
        if (!copy) return;
        const active = desktopScene && index === scene - 1;
        copy.style.visibility = active ? "visible" : "hidden";
        copy.style.zIndex = active ? "2" : "1";
        setNumber(copy, "--copy-in", active ? 1 : 0);
        setNumber(copy, "--copy-out", 0);
      });

      morphActors.forEach(({ source, target, clone }) => {
        source.style.visibility = intro ? "visible" : "hidden";
        target.style.setProperty("--sl-shared-reveal", scene === 1 ? "1" : "0");
        clone.style.visibility = "hidden";
      });
      sharedSurface.style.visibility = "hidden";

      finale.style.visibility = scene === 5 ? "visible" : "hidden";
      finale.style.pointerEvents = scene === 5 ? "auto" : "none";
      setNumber(finale, "--finale-in", scene === 5 ? 1 : 0);
      updateDots(scene);
    };

    const renderIntroHandoff = (phase: number) => {
      hideWorkspaces();
      const straighten = easeOut(seg(phase, 0, .24));
      const phoneBreak = easeInOut(seg(phase, .18, .84));
      const desktopIn = easeOut(seg(phase, .2, .94));
      const workspaceIn = easeOut(seg(phase, .28, .96));
      const copyIn = easeOut(seg(phase, .62, 1));
      const heroOut = easeInOut(seg(phase, .02, .27));

      phone.style.visibility = phase < .995 ? "visible" : "hidden";
      phone.style.transform = `translate3d(${-24 * phoneBreak}px,${lerp(26, -18, straighten) - 26 * phoneBreak}px,0) scale(${.96 + .02 * straighten - .08 * phoneBreak})`;
      phone.style.setProperty("--phone-break", phoneBreak.toFixed(4));
      tilt.style.transform = `perspective(1500px) rotateX(${6 * (1 - straighten)}deg) rotateY(${-24 * (1 - straighten)}deg) rotateZ(${-8 * (1 - straighten)}deg)`;
      if (phoneScroll) phoneScroll.style.transform = `translate3d(0,${-PHONE_SCROLL_SHIFT * straighten}px,0)`;

      if (heroTitleRef.current) {
        heroTitleRef.current.style.visibility = phase < .99 ? "visible" : "hidden";
        heroTitleRef.current.style.clipPath = `inset(${heroOut * 50.1}% 0)`;
        heroTitleRef.current.style.transform = `translate3d(0,${-54 * heroOut}px,0)`;
      }
      if (cueRef.current) {
        cueRef.current.style.visibility = phase < .18 ? "visible" : "hidden";
        cueRef.current.style.clipPath = `inset(${easeInOut(seg(phase, 0, .15)) * 50.1}% 0)`;
      }
      if (glowRef.current) glowRef.current.style.opacity = String(lerp(1, .38, easeOut(seg(phase, .16, .78))));

      desktop.style.visibility = phase > .12 ? "visible" : "hidden";
      setNumber(desktop, "--desktop-in", desktopIn);
      setNumber(desktop, "--desktop-out", 0);
      const rankingsWorkspace = workspaceRefs.current[0];
      const rankingsCopy = copyRefs.current[0];
      if (rankingsWorkspace) {
        rankingsWorkspace.style.visibility = phase > .18 ? "visible" : "hidden";
        rankingsWorkspace.style.zIndex = "2";
        setNumber(rankingsWorkspace, "--workspace-in", workspaceIn);
        setNumber(rankingsWorkspace, "--workspace-out", 0);
      }
      if (rankingsCopy) {
        rankingsCopy.style.visibility = phase > .56 ? "visible" : "hidden";
        rankingsCopy.style.zIndex = "2";
        setNumber(rankingsCopy, "--copy-in", copyIn);
        setNumber(rankingsCopy, "--copy-out", 0);
      }
      finale.style.visibility = "hidden";
      setNumber(finale, "--finale-in", 0);
      applySharedSurface(phase);
      applyMorphActors(phase);
    };

    const renderDesktopSwap = (from: number, to: number, phase: number) => {
      hideWorkspaces();
      phone.style.visibility = "hidden";
      desktop.style.visibility = "visible";
      setNumber(desktop, "--desktop-in", 1);
      setNumber(desktop, "--desktop-out", 0);
      sharedSurface.style.visibility = "hidden";
      morphActors.forEach(({ clone }) => {
        clone.style.visibility = "hidden";
      });
      finale.style.visibility = "hidden";
      setNumber(finale, "--finale-in", 0);

      const outgoingWorkspace = workspaceRefs.current[from - 1];
      const incomingWorkspace = workspaceRefs.current[to - 1];
      const outgoingCopy = copyRefs.current[from - 1];
      const incomingCopy = copyRefs.current[to - 1];
      const out = easeInOut(seg(phase, 0, .7));
      const incoming = easeOut(seg(phase, .24, 1));
      const copyOut = easeInOut(seg(phase, 0, .52));
      const copyIn = easeOut(seg(phase, .4, .98));

      if (outgoingWorkspace) {
        outgoingWorkspace.style.visibility = "visible";
        outgoingWorkspace.style.zIndex = "1";
        setNumber(outgoingWorkspace, "--workspace-in", 1);
        setNumber(outgoingWorkspace, "--workspace-out", out);
      }
      if (incomingWorkspace) {
        incomingWorkspace.style.visibility = "visible";
        incomingWorkspace.style.zIndex = "2";
        setNumber(incomingWorkspace, "--workspace-in", incoming);
        setNumber(incomingWorkspace, "--workspace-out", 0);
      }
      if (outgoingCopy) {
        outgoingCopy.style.visibility = "visible";
        outgoingCopy.style.zIndex = "1";
        setNumber(outgoingCopy, "--copy-in", 1);
        setNumber(outgoingCopy, "--copy-out", copyOut);
      }
      if (incomingCopy) {
        incomingCopy.style.visibility = "visible";
        incomingCopy.style.zIndex = "2";
        setNumber(incomingCopy, "--copy-in", copyIn);
        setNumber(incomingCopy, "--copy-out", 0);
      }
    };

    const renderFinaleHandoff = (phase: number) => {
      hideWorkspaces();
      phone.style.visibility = "hidden";
      sharedSurface.style.visibility = "hidden";
      const askWorkspace = workspaceRefs.current[3];
      const askCopy = copyRefs.current[3];
      const desktopOut = easeInOut(seg(phase, .16, .82));
      const finaleIn = easeOut(seg(phase, .38, 1));

      desktop.style.visibility = phase < .995 ? "visible" : "hidden";
      setNumber(desktop, "--desktop-in", 1);
      setNumber(desktop, "--desktop-out", desktopOut);
      if (askWorkspace) {
        askWorkspace.style.visibility = phase < .995 ? "visible" : "hidden";
        setNumber(askWorkspace, "--workspace-in", 1);
        setNumber(askWorkspace, "--workspace-out", desktopOut);
      }
      if (askCopy) {
        askCopy.style.visibility = phase < .995 ? "visible" : "hidden";
        setNumber(askCopy, "--copy-in", 1);
        setNumber(askCopy, "--copy-out", easeInOut(seg(phase, 0, .58)));
      }
      finale.style.visibility = phase > .28 ? "visible" : "hidden";
      finale.style.pointerEvents = phase > .86 ? "auto" : "none";
      setNumber(finale, "--finale-in", finaleIn);
    };

    const scrollToScene = (scene: number, behavior: ScrollBehavior) => {
      syncingScroll = true;
      scroller.scrollTo({ top: scene * scroller.clientHeight, behavior });
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncingScroll = false;
      }, behavior === "smooth" ? Math.max(transitionDuration + 160, 650) : 80);
    };

    const transitionLength = (from: number, to: number) => {
      if ((from === 0 && to === 1) || (from === 1 && to === 0)) return 1080;
      if ((from === 4 && to === 5) || (from === 5 && to === 4)) return 940;
      return 840;
    };

    const requestScene = (requested: number) => {
      const scene = clamp(Math.round(requested), 0, SCENE_COUNT - 1);
      if (transitioning) {
        if (scene !== transitionTarget) queuedScene = scene;
        return;
      }
      if (scene === activeScene) {
        scrollToScene(scene, "smooth");
        return;
      }

      let next = scene;
      queuedScene = null;
      if (activeScene === 0 && scene > 1) {
        next = 1;
        queuedScene = scene;
      } else if (activeScene > 1 && scene === 0) {
        next = 1;
        queuedScene = 0;
      } else if (activeScene < 4 && scene === 5) {
        next = 4;
        queuedScene = 5;
      } else if (activeScene === 5 && scene < 4) {
        next = 4;
        queuedScene = scene;
      }

      transitionFrom = activeScene;
      transitionTarget = next;
      transitionDuration = transitionLength(transitionFrom, transitionTarget);
      transitionStartedAt = performance.now();
      transitioning = true;
      updateDots(transitionTarget);
      scrollToScene(transitionTarget, "smooth");

      const frame = (now: number) => {
        const raw = clamp01((now - transitionStartedAt) / transitionDuration);
        const eased = easeInOut(raw);
        if (transitionFrom === 0 && transitionTarget === 1) {
          renderIntroHandoff(eased);
        } else if (transitionFrom === 1 && transitionTarget === 0) {
          renderIntroHandoff(1 - eased);
        } else if (transitionFrom === 4 && transitionTarget === 5) {
          renderFinaleHandoff(eased);
        } else if (transitionFrom === 5 && transitionTarget === 4) {
          renderFinaleHandoff(1 - eased);
        } else {
          renderDesktopSwap(transitionFrom, transitionTarget, eased);
        }

        if (raw < 1) {
          transitionRaf = requestAnimationFrame(frame);
          return;
        }

        activeScene = transitionTarget;
        transitioning = false;
        renderIdle(activeScene);
        scrollToScene(activeScene, "auto");
        const continuation = queuedScene;
        queuedScene = null;
        if (continuation !== null && continuation !== activeScene) {
          continuationTimer = window.setTimeout(() => requestScene(continuation), 70);
        }
      };
      cancelAnimationFrame(transitionRaf);
      transitionRaf = requestAnimationFrame(frame);
    };

    navigateRef.current = requestScene;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      wheelDelta += event.deltaY;
      window.clearTimeout(wheelResetTimer);
      wheelResetTimer = window.setTimeout(() => {
        wheelDelta = 0;
        wheelConsumed = false;
      }, 180);
      if (wheelConsumed || Math.abs(wheelDelta) < 42) return;
      wheelConsumed = true;
      const base = transitioning ? transitionTarget : activeScene;
      requestScene(base + (wheelDelta > 0 ? 1 : -1));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === " " && target?.matches("button, a")) return;
      const base = transitioning ? transitionTarget : activeScene;
      let next: number | null = null;
      if (event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey)) next = base + 1;
      if (event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey)) next = base - 1;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = SCENE_COUNT - 1;
      if (next === null) return;
      event.preventDefault();
      requestScene(next);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (touchStartY === null) return;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const distance = touchStartY - endY;
      touchStartY = null;
      if (Math.abs(distance) < 44) {
        scrollToScene(activeScene, "smooth");
        return;
      }
      const base = transitioning ? transitionTarget : activeScene;
      requestScene(base + (distance > 0 ? 1 : -1));
    };

    const onScroll = () => {
      if (syncingScroll || transitioning) return;
      const position = scroller.scrollTop / Math.max(1, scroller.clientHeight);
      const candidate = clamp(Math.round(position), 0, SCENE_COUNT - 1);
      if (candidate !== activeScene && Math.abs(position - activeScene) > .3) requestScene(candidate);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!transitioning) scrollToScene(activeScene, "smooth");
      }, 130);
    };

    const onResize = () => {
      cancelAnimationFrame(transitionRaf);
      if (transitioning) activeScene = transitionTarget;
      transitioning = false;
      queuedScene = null;
      findPhoneScroll();
      buildGeometry();
      renderIdle(activeScene);
      scrollToScene(activeScene, "auto");
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    findPhoneScroll();
    renderIdle(activeScene);
    buildGeometry();
    renderIdle(activeScene);
    remeasureRaf = requestAnimationFrame(() => {
      remeasureRaf = requestAnimationFrame(() => {
        findPhoneScroll();
        buildGeometry();
        renderIdle(activeScene);
      });
    });
    lateRemeasure = window.setTimeout(() => {
      findPhoneScroll();
      buildGeometry();
      renderIdle(activeScene);
    }, 500);

    return () => {
      cancelAnimationFrame(transitionRaf);
      cancelAnimationFrame(remeasureRaf);
      window.clearTimeout(lateRemeasure);
      window.clearTimeout(syncTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(continuationTimer);
      window.clearTimeout(wheelResetTimer);
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      navigateRef.current = () => undefined;
      clearMorphActors();
    };
  }, [staticMode]);

  if (staticMode) {
    return (
      <main className="sl-root">
        <style>{LANDING_CSS}</style>
        <StaticLanding metrics={metrics} />
      </main>
    );
  }

  const screens = [
    <RankingsScreen key="rankings" metrics={metrics} />,
    <PortfolioScreen key="portfolio" />,
    <NewsScreen key="news" />,
    <ChatScreen key="chat" />,
  ];

  return (
    <main ref={scrollerRef} className="sl-root h-[100dvh] overflow-y-auto overflow-x-hidden">
      <style>{LANDING_CSS}</style>
      <TopNav />
      <div className="relative">
        <div className="sl-bg sticky top-0 h-[100dvh] overflow-hidden">
          <div
            ref={glowRef}
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 46% 42% at 50% 6%, rgba(244,231,193,.15), transparent 60%), radial-gradient(ellipse 30% 26% at 50% 30%, rgba(221,177,89,.12), transparent 65%)" }}
          />
          <div className="pointer-events-none absolute bottom-[6%] left-1/2 h-[10vh] w-[64vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(221,177,89,.10),transparent_70%)] blur-2xl" />
          <div className="sl-grain pointer-events-none absolute inset-0" />
          <div className="sl-vignette pointer-events-none absolute inset-0" />

          <div className="pointer-events-none absolute inset-0 z-[26] flex items-center justify-center pt-[24vh]">
            <div ref={phoneRef} style={{ transform: "translate3d(0,26px,0) scale(.96)" }}>
              <div ref={tiltRef} style={{ transform: "perspective(1500px) rotateX(6deg) rotateY(-24deg) rotateZ(-8deg)" }}>
                <CinematicPhone />
              </div>
            </div>
          </div>

          <div ref={sharedSurfaceRef} aria-hidden="true" className="sl-shared-surface pointer-events-none invisible absolute z-[27] overflow-hidden border border-white/15" />
          <div ref={morphLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[28] overflow-visible" />

          <div ref={heroTitleRef} className="pointer-events-none absolute inset-x-0 top-[11vh] z-10 flex flex-col items-center px-4 text-center">
            <h1 className="text-[clamp(56px,12.5vw,150px)] font-black leading-none tracking-[-0.055em] text-white" style={{ textShadow: "0 10px 60px rgba(0,0,0,.75), 0 0 110px rgba(221,177,89,.18)" }}>StockGPT</h1>
            <p className="sl-mono mt-2 text-[clamp(11px,1.7vw,18px)] font-bold uppercase tracking-[0.44em] text-white/60">AI-driven market insights</p>
          </div>

          <div ref={cueRef} className="pointer-events-none absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
            <span className="sl-mono text-[9.5px] font-black uppercase tracking-[0.4em] text-white/45">Scroll</span>
            <span className="sl-cue-anim flex h-9 w-[22px] items-start justify-center rounded-full border border-white/30 pt-1.5"><span className="h-2 w-[3px] rounded-full bg-[#ddb159]" /></span>
          </div>

          <div ref={desktopRef} className="sl-desktop sl-desktop-stack invisible absolute inset-0 z-20 flex flex-col items-center justify-center gap-[1.8vh] pb-[1vh] pt-[8vh]">
            <div className="sl-desktop-copy relative h-[clamp(170px,25vh,220px)] w-full shrink-0">
              {SCENE_COPY.map((copy, index) => (
                <div
                  key={copy.index}
                  ref={(element) => { copyRefs.current[index] = element; }}
                  className="sl-copy invisible absolute inset-0 flex items-center justify-center"
                >
                  <SceneCopy copy={copy} />
                </div>
              ))}
            </div>
            <PanelFrame>
              <div className="relative h-full w-full overflow-hidden">
                {screens.map((screen, index) => (
                  <div
                    key={SCENE_COPY[index].index}
                    ref={(element) => { workspaceRefs.current[index] = element; }}
                    className="sl-workspace invisible absolute inset-0"
                  >
                    <FixedScale w={1280} h={756}>{screen}</FixedScale>
                  </div>
                ))}
              </div>
            </PanelFrame>
          </div>

          <div ref={finaleRef} className="sl-finale invisible absolute inset-0 z-20 flex items-center justify-center" style={{ pointerEvents: "none" }}>
            <FinaleContent />
          </div>

          <nav aria-label="Landing sections" className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-4 md:flex">
            {DOT_STOPS.map((label, index) => (
              <button
                key={label}
                ref={(element) => { dotRefs.current[index] = element; }}
                type="button"
                data-active={index === 0 ? "1" : "0"}
                aria-label={label}
                onClick={() => navigateRef.current(index)}
                className="sl-dotbtn relative p-1 focus:outline-none"
              >
                <span className="sl-dot" />
                <span className="sl-dotlabel sl-mono text-[9px] font-black uppercase tracking-[0.22em] text-white/55">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div aria-hidden="true" className="-mt-[100dvh]">
          {DOT_STOPS.map((label) => <section key={label} className="sl-snap-anchor" />)}
        </div>
      </div>
    </main>
  );
}
