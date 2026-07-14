"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LandingMetrics } from "./ScrollLandingScreens";
import {
  ChatScreen,
  FixedScale,
  NewsScreen,
  PhoneDashboardScreen,
  PortfolioScreen,
  RankingsScreen,
} from "./ScrollLandingScreens";

/* ================================================================== */
/*  Timeline                                                          */
/*                                                                    */
/*  One viewport-height sticky stage inside a 700vh track. Scroll     */
/*  position is mapped to progress p ∈ [0,1] and every layer is       */
/*  scrubbed from it — the page never visually scrolls, it transforms.*/
/*                                                                    */
/*    0.000 – 0.100  hero: diagonal phone under a spotlight           */
/*    0.030 – 0.140  phone straightens to vertical                    */
/*    0.140 – 0.340  phone modules disperse while the rankings        */
/*                   monitor, chrome, controls and rows assemble      */
/*    0.290 – 0.460  scene 1 · Rankings                               */
/*    0.460 – 0.620  scene 2 · Portfolio                              */
/*    0.620 – 0.780  scene 3 · World News                             */
/*    0.780 – 0.900  scene 4 · Ask StockGPT                           */
/*    0.900 – 1.000  finale · CTA                                     */
/* ================================================================== */

const STRAIGHTEN = { a: 0.03, b: 0.14 };
/* The real mobile dashboard reaches its rankings rail, then its modules
   disperse while the complete logged-in desktop workspace assembles. */
const MORPH = { a: 0.14, b: 0.34 };
const PHONE_SCROLL_SHIFT = 252;

const SCENES: { a: number; b: number; final?: boolean; handoff?: boolean }[] = [
  { a: 0.29, b: 0.46, handoff: true },
  { a: 0.46, b: 0.62 },
  { a: 0.62, b: 0.78 },
  { a: 0.78, b: 0.9 },
  { a: 0.9, b: 1.0, final: true },
];

const MORPH_ACTORS = [
  { key: "app-header", arcX: -92, arcY: -74, rotation: -2.4, lag: 0 },
  { key: "briefing", arcX: 118, arcY: -54, rotation: 3.2, lag: 0.025 },
  { key: "portfolio", arcX: -146, arcY: 76, rotation: -3.8, lag: 0.01 },
  { key: "rankings-title", arcX: 124, arcY: 44, rotation: 2.6, lag: 0.045 },
  { key: "rank-row-0", arcX: -108, arcY: 108, rotation: -4.5, lag: 0.06 },
  { key: "rank-row-1", arcX: 14, arcY: 132, rotation: 1.8, lag: 0.085 },
  { key: "rank-row-2", arcX: 112, arcY: 96, rotation: 4.2, lag: 0.11 },
  { key: "nav", arcX: -162, arcY: 8, rotation: -3.4, lag: 0.035 },
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

/* Progress targets for the side-rail dots. */
const DOT_STOPS = [
  { label: "Intro", p: 0 },
  { label: "Rankings", p: 0.37 },
  { label: "Portfolio", p: 0.54 },
  { label: "World News", p: 0.7 },
  { label: "Ask StockGPT", p: 0.84 },
  { label: "Get started", p: 0.985 },
];


function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function seg(p: number, a: number, b: number) {
  return clamp01((p - a) / (b - a));
}
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type SceneCopyDef = {
  index: string;
  eyebrow: string;
  title: ReactNode;
  body: string;
  chips: string[];
};

const SCENE_COPY: SceneCopyDef[] = [
  {
    index: "01",
    eyebrow: "Rankings",
    title: (
      <>
        Every stock. Scored. <em className="sl-gold not-italic">Ranked.</em>
      </>
    ),
    body:
      "StockGPT scans 500+ US stocks every single day and distils quality, growth, value, momentum, risk and income into one score — so your research starts at the top of a ranked list, not in a hundred open tabs.",
    chips: ["Daily model runs", "Six-factor scoring", "Rank movement tracking"],
  },
  {
    index: "02",
    eyebrow: "Portfolio",
    title: (
      <>
        See the whole picture. <em className="sl-gold not-italic">Act with context.</em>
      </>
    ),
    body:
      "Track value, return, health, concentration and model conviction in the same portfolio workspace you use after signing in. Import real positions and StockGPT keeps the context current.",
    chips: ["Portfolio health", "Reliable performance history", "Exposure monitoring"],
  },
  {
    index: "03",
    eyebrow: "World News",
    title: (
      <>
        The world moves. <em className="sl-gold not-italic">Your watchlist feels it.</em>
      </>
    ),
    body:
      "World News connects global headlines to the tickers they actually touch — scored for impact, mapped to sectors, and written in plain English. You know why the market moved before you have to ask.",
    chips: ["Ticker mapping", "Impact scoring", "Sector context"],
  },
  {
    index: "04",
    eyebrow: "Ask StockGPT",
    title: (
      <>
        Ask anything. <em className="sl-gold not-italic">Interrogate everything.</em>
      </>
    ),
    body:
      "Ask StockGPT sits on top of the entire ranking engine. Question a score, stress-test a thesis, compare two tickers side by side — and get answers grounded in the same data that builds the rankings, not vibes.",
    chips: ["Grounded in live rankings", "Thesis stress-tests", "Plain-English answers"],
  },
];

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                  */
/* ------------------------------------------------------------------ */

function GoldButton({
  href,
  children,
  ghost = false,
}: {
  href: string;
  children: ReactNode;
  ghost?: boolean;
}) {
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
          <span
            key={chip}
            className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[10.5px] font-black uppercase tracking-[0.12em] text-white/60"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-sl-monitor
      className="relative"
      style={{ width: "min(1120px, 91vw, 98vh)" }}
    >
      <div className="pointer-events-none absolute inset-[1.1%_-0.55%_-1.2%_0.55%] rounded-[20px] border border-white/[0.035] bg-[#070a09] shadow-[18px_28px_70px_rgba(0,0,0,.62)]" />
      <div
        data-sl-monitor-bezel
        className="relative overflow-hidden rounded-[19px] border border-white/20 bg-[linear-gradient(135deg,#777d79_0%,#343937_3%,#111514_11%,#080b0a_52%,#282d2a_91%,#5f6561_98%,#171a19_100%)] p-[7px] pb-[12px]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(0,0,0,.9),0 46px 110px rgba(0,0,0,.74),0 12px 34px rgba(0,0,0,.58),0 0 90px rgba(221,177,89,.065),inset 0 1px 0 rgba(255,255,255,.3),inset 1px 0 0 rgba(255,255,255,.08)",
        }}
      >
        <div className="pointer-events-none absolute inset-[2px] rounded-[16px] border border-black/75" />
        <div className="absolute left-1/2 top-[2px] z-20 flex h-[5px] -translate-x-1/2 items-center gap-1.5">
          <i className="size-[4px] rounded-full border border-white/10 bg-[#010302] shadow-[inset_0_0_2px_rgba(49,117,87,.65)]" />
          <i className="size-[2px] rounded-full bg-white/20" />
        </div>
        <div className="relative overflow-hidden rounded-[12px] border border-black bg-[#04120b] shadow-[inset_0_0_0_1px_rgba(255,255,255,.035)]" style={{ aspectRatio: "1280 / 756" }}>
          {children}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,.075)_0%,rgba(255,255,255,.016)_16%,transparent_33%,transparent_77%,rgba(255,255,255,.018)_100%)]" />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_18px_rgba(0,0,0,.58)]" />
        </div>
        <div className="absolute bottom-[4px] left-1/2 h-[2px] w-20 -translate-x-1/2 rounded-full opacity-45 [background:repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_1px,transparent_1px_4px)]" />
        <span className="absolute bottom-[3px] left-4 text-[5px] font-black uppercase tracking-[0.28em] text-white/15">StockGPT</span>
        <i className="absolute bottom-[4px] right-4 size-[3px] rounded-full bg-emerald-400/90 shadow-[0_0_7px_rgba(52,211,153,.7)]" />
        <i className="absolute right-0 top-[18%] h-[16%] w-px bg-white/10" />
        <i className="absolute right-0 top-[38%] h-[8%] w-px bg-black" />
      </div>
      <div className="pointer-events-none absolute -bottom-6 left-1/2 h-9 w-[88%] -translate-x-1/2 rounded-[50%] bg-black/65 blur-2xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  High-definition iPhone                                            */
/* ------------------------------------------------------------------ */

function CinematicPhone() {
  return (
    <div className="relative" style={{ width: "min(310px, 62vw, 31vh)", aspectRatio: "393 / 852" }}>
      {/* titanium rail */}
      <div
        data-sl-phone-hardware
        className="absolute inset-0 rounded-[16.8%_/_7.8%]"
        style={{
          background:
            "linear-gradient(145deg,#787d79 0%,#343938 8%,#151918 24%,#555a56 42%,#1a1e1d 62%,#666b66 80%,#171b1a 100%)",
          boxShadow:
            "0 70px 150px rgba(0,0,0,.88),0 26px 58px rgba(0,0,0,.68),0 0 90px rgba(221,177,89,.1),inset 0 0 0 1px rgba(255,255,255,.24)",
        }}
      >
        {/* side buttons */}
        <div className="absolute inset-[.75%] rounded-[16.2%_/_7.45%] border border-white/10" />
        <div className="absolute -left-[1.15%] top-[18%] h-[4.6%] w-[1.35%] rounded-l-md bg-[linear-gradient(90deg,#777c77,#202423)] shadow-[-1px_0_1px_rgba(255,255,255,.18)]" />
        <div className="absolute -left-[1.15%] top-[26.5%] h-[8.2%] w-[1.35%] rounded-l-md bg-[linear-gradient(90deg,#777c77,#202423)]" />
        <div className="absolute -left-[1.15%] top-[37%] h-[8.2%] w-[1.35%] rounded-l-md bg-[linear-gradient(90deg,#777c77,#202423)]" />
        <div className="absolute -right-[1.15%] top-[29%] h-[12%] w-[1.35%] rounded-r-md bg-[linear-gradient(270deg,#777c77,#202423)]" />
        <div className="absolute left-[9%] top-0 h-[.7%] w-[14%] bg-black/45" />
        <div className="absolute right-[9%] top-0 h-[.7%] w-[14%] bg-black/45" />
        <div className="absolute bottom-0 left-[10%] h-[.7%] w-[13%] bg-black/45" />
        <div className="absolute bottom-0 right-[10%] h-[.7%] w-[13%] bg-black/45" />
      </div>

      {/* black bezel */}
      <div data-sl-phone-hardware className="absolute inset-[1.25%_2.65%] rounded-[15.7%_/_7.35%] bg-[#020303] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" />

      {/* screen — inset tuned so its aspect matches the 393×852 design
          canvas and the cover-fit never crops the header edges */}
      <div data-sl-phone-hardware className="absolute inset-[2.05%_3.55%] overflow-hidden rounded-[14.1%_/_6.6%] bg-[#04120b]">
        <FixedScale w={393} h={852} mode="cover">
          <PhoneDashboardScreen />
        </FixedScale>

        {/* glass glare */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(112deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.045) 17%,transparent 29%,transparent 68%,rgba(255,255,255,.035) 88%)",
          }}
        />
      </div>

      {/* dynamic island */}
      <div data-sl-phone-hardware className="absolute left-1/2 top-[3.35%] z-10 h-[3.35%] w-[30%] -translate-x-1/2 rounded-full bg-black shadow-[0_1px_2px_rgba(255,255,255,.07)]">
        <div className="absolute right-[10%] top-1/2 aspect-square h-[43%] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#1c2940,#06090d_60%)]" />
        <div className="absolute left-[17%] top-1/2 h-[12%] w-[34%] -translate-y-1/2 rounded-full bg-[#161a19]" />
      </div>
      <div data-sl-phone-hardware className="absolute bottom-[3.15%] left-1/2 z-10 h-[.55%] w-[32%] -translate-x-1/2 rounded-full bg-white/82" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fixed chrome: nav + dots rail                                     */
/* ------------------------------------------------------------------ */

function TopNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label="StockGPT home"
          className="relative h-10 w-[140px] focus:outline-none focus:ring-2 focus:ring-[#ddb159] sm:h-11 sm:w-[160px]"
        >
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-left drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
            sizes="160px"
          />
        </Link>
        <div className="flex items-center gap-2.5">
          {/* on mobile the single top-right button is Log in (gold);
             desktop shows the ghost Log in + gold Create account pair */}
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline transition-colors hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:border-white/20 sm:bg-black/30 sm:!text-white sm:backdrop-blur-md sm:hover:bg-white/10"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="hidden h-11 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline transition-colors hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:inline-flex"
          >
            Create account
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Reduced-motion fallback: plain stacked page, zero scroll tricks    */
/* ------------------------------------------------------------------ */

function StaticLanding({ metrics }: { metrics: LandingMetrics }) {
  const screens = [
    <RankingsScreen key="r" metrics={metrics} />,
    <PortfolioScreen key="p" />,
    <NewsScreen key="n" />,
    <ChatScreen key="c" />,
  ];

  return (
    <div className="sl-bg min-h-screen">
      <TopNav />
      <section className="flex flex-col items-center px-6 pb-16 pt-32 text-center">
        <h1 className="text-[clamp(48px,10vw,110px)] font-black leading-none tracking-[-0.05em] text-white">
          StockGPT
        </h1>
        <p className="sl-mono mt-3 text-[clamp(12px,1.6vw,17px)] font-bold uppercase tracking-[0.42em] text-white/55">
          AI-driven market insights
        </p>
        <div className="mt-12">
          <CinematicPhone />
        </div>
      </section>

      {SCENE_COPY.map((copy, i) => (
        <section key={copy.index} className="flex flex-col items-center gap-8 px-4 py-16">
          <SceneCopy copy={copy} />
          <PanelFrame>
            <FixedScale w={1280} h={756}>
              {screens[i]}
            </FixedScale>
          </PanelFrame>
        </section>
      ))}

      <FinaleContent />
    </div>
  );
}

function FinaleContent() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center">
      <p className="sl-e0 sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
        Your move
      </p>
      <h2 className="sl-e1 mt-4 text-[clamp(30px,5.4vw,62px)] font-black leading-[1.02] tracking-[-0.04em] text-white">
        Start your research
        <br />
        <span className="sl-gold">with structure.</span>
      </h2>
      <p className="sl-e2 mt-5 max-w-xl text-[clamp(13px,1.3vw,16px)] font-medium leading-relaxed text-white/55">
        Create a free account, explore the dashboard, and subscribe inside only when you&apos;re
        ready. Rankings, portfolio tools, world news and Ask StockGPT — one workflow.
      </p>
      <div className="sl-e3 mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <GoldButton href="/signup">Create free account</GoldButton>
        <GoldButton href="/login" ghost>
          Log in
        </GoldButton>
      </div>
      <div className="sl-e3 mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-white/40">
        <Link href="/about" className="!text-white/40 no-underline hover:!text-[#ddb159]">
          About
        </Link>
        <Link href="/pricing" className="!text-white/40 no-underline hover:!text-[#ddb159]">
          Pricing
        </Link>
        <Link href="/affiliate" className="!text-white/40 no-underline hover:!text-[#ddb159]">
          Affiliate
        </Link>
        <Link href="/legal" className="!text-white/40 no-underline hover:!text-[#ddb159]">
          Legal
        </Link>
        <Link href="/landing" className="!text-white/40 no-underline hover:!text-[#ddb159]">
          Classic landing
        </Link>
      </div>
      <p className="sl-e3 mt-6 max-w-2xl text-[10px] leading-5 text-white/30">
        StockGPT is a research and ranking tool. All content is for informational and educational
        purposes only and does not constitute financial advice or a recommendation to buy or sell
        any security. Investing involves risk — always do your own research. © 2026 StockGPT.
      </p>
    </div>
  );
}

/* ================================================================== */
/*  Main component                                                    */
/* ================================================================== */

export function ScrollLandingClient({ metrics }: { metrics: LandingMetrics }) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const morphLayerRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [staticMode, setStaticMode] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStaticMode(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (staticMode) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let target = 0;
    let current = -1;
    let lastApplied = -1;
    let raf = 0;
    let running = true;

    let phoneScroll: HTMLElement | null = null;
    let morphActors: MorphActor[] = [];

    const findPhoneScroll = () => {
      const phone = phoneRef.current;
      phoneScroll = phone?.querySelector<HTMLElement>("[data-sl-phone-scroll]") ?? null;
    };

    const clearMorphActors = () => {
      morphActors.forEach(({ source, target }) => {
        source.style.removeProperty("visibility");
        target.style.removeProperty("--sl-target-reveal");
      });
      morphActors = [];
      morphLayerRef.current?.replaceChildren();
    };

    const buildMorphActors = () => {
      const phone = phoneRef.current;
      const tilt = tiltRef.current;
      const layer = morphLayerRef.current;
      const rankingsScene = sceneRefs.current[0];
      if (!phone || !tilt || !layer || !rankingsScene || !phoneScroll) return;

      clearMorphActors();

      /* Measure both interfaces in their exact handoff geometry. This keeps
         the clone paths accurate even when the stage or FixedScale changes. */
      const phoneCss = phone.style.cssText;
      const tiltCss = tilt.style.cssText;
      const scrollCss = phoneScroll.style.cssText;
      const sceneCss = rankingsScene.style.cssText;
      phone.style.transform = "translate3d(0,0,0) scale(1)";
      phone.style.visibility = "visible";
      phone.style.setProperty("--phone-break", "0");
      tilt.style.transform = "perspective(1500px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
      phoneScroll.style.transform = `translate3d(0, ${-PHONE_SCROLL_SHIFT}px, 0)`;
      rankingsScene.style.transform = "none";
      rankingsScene.style.setProperty("--k", "1");
      rankingsScene.style.setProperty("--out", "0");

      const layerRect = layer.getBoundingClientRect();
      const nextActors: MorphActor[] = [];

      MORPH_ACTORS.forEach((definition, index) => {
        const source = phone.querySelector<HTMLElement>(`[data-sl-morph-source="${definition.key}"]`);
        const targetNode = rankingsScene.querySelector<HTMLElement>(`[data-sl-morph-target="${definition.key}"]`);
        if (!source || !targetNode) return;

        const sourceViewportRect = source.getBoundingClientRect();
        const targetViewportRect = targetNode.getBoundingClientRect();
        const sourceRect = new DOMRect(
          sourceViewportRect.left - layerRect.left,
          sourceViewportRect.top - layerRect.top,
          sourceViewportRect.width,
          sourceViewportRect.height,
        );
        const targetRect = new DOMRect(
          targetViewportRect.left - layerRect.left,
          targetViewportRect.top - layerRect.top,
          targetViewportRect.width,
          targetViewportRect.height,
        );
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
        clone.style.position = "absolute";
        clone.style.inset = "auto";
        clone.style.left = "0";
        clone.style.top = "0";
        clone.style.width = `${sourceRect.width}px`;
        clone.style.height = `${sourceRect.height}px`;
        clone.style.margin = "0";
        clone.style.opacity = "1";
        clone.style.visibility = "hidden";
        clone.style.pointerEvents = "none";
        clone.style.transformOrigin = "top left";
        clone.style.zIndex = String(20 + index);
        clone.style.willChange = "transform, clip-path, border-radius";
        layer.appendChild(clone);

        nextActors.push({
          source,
          target: targetNode,
          clone,
          sourceRect,
          targetRect,
          sourceRadius: parseFloat(getComputedStyle(source).borderTopLeftRadius) || 0,
          targetRadius: parseFloat(getComputedStyle(targetNode).borderTopLeftRadius) || 0,
          arcX: definition.arcX,
          arcY: definition.arcY,
          rotation: definition.rotation,
          lag: definition.lag,
        });
      });

      morphActors = nextActors;
      phone.style.cssText = phoneCss;
      tilt.style.cssText = tiltCss;
      phoneScroll.style.cssText = scrollCss;
      rankingsScene.style.cssText = sceneCss;
    };

    const readTarget = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      target = max > 0 ? scroller.scrollTop / max : 0;
    };

    const onResize = () => {
      readTarget();
      findPhoneScroll();
      buildMorphActors();
      lastApplied = -1;
    };

    const apply = (p: number) => {
      const t1 = easeInOut(seg(p, STRAIGHTEN.a, STRAIGHTEN.b));
      /* The latest mobile dashboard scrolls naturally until its
         horizontal ranking cards are centred, then every phone module
         disperses while the desktop monitor assembles in parallel. */
      const tM = easeInOut(seg(p, MORPH.a, MORPH.b));
      if (phoneScroll) {
        phoneScroll.style.transform = "translate3d(0, " + (-PHONE_SCROLL_SHIFT * t1) + "px, 0)";
      }

      morphActors.forEach((actor, index) => {
        const travel = easeInOut(seg(tM, actor.lag, 0.91));
        const arc = Math.sin(Math.PI * travel);
        const resize = easeInOut(seg(travel, 0.22, 0.72));
        const targetScaleX = Math.min(1.58, Math.max(0.68, actor.targetRect.width / actor.sourceRect.width));
        const targetScaleY = Math.min(1.5, Math.max(0.68, actor.targetRect.height / actor.sourceRect.height));
        const scaleX = 1 + (targetScaleX - 1) * resize;
        const scaleY = 1 + (targetScaleY - 1) * resize;
        const destinationX = actor.targetRect.x + (actor.targetRect.width - actor.sourceRect.width * scaleX) / 2;
        const destinationY = actor.targetRect.y + (actor.targetRect.height - actor.sourceRect.height * scaleY) / 2;
        const x = actor.sourceRect.x + (destinationX - actor.sourceRect.x) * travel + actor.arcX * arc;
        const y = actor.sourceRect.y + (destinationY - actor.sourceRect.y) * travel + actor.arcY * arc;
        const radius = actor.sourceRadius + (actor.targetRadius - actor.sourceRadius) * travel;
        const handoff = easeInOut(seg(travel, 0.48, 0.82));
        const reveal = easeOut(seg(travel, 0.42 + index * 0.006, 0.84));

        actor.source.style.visibility = tM > 0.004 ? "hidden" : "visible";
        actor.target.style.setProperty("--sl-target-reveal", reveal.toFixed(4));
        actor.clone.style.visibility = tM > 0.004 && tM < 0.995 ? "visible" : "hidden";
        actor.clone.style.transform = `translate3d(${x}px,${y}px,0) rotate(${actor.rotation * arc}deg) scale(${scaleX},${scaleY})`;
        actor.clone.style.borderRadius = `${radius}px`;
        actor.clone.style.clipPath = `inset(0 0 ${handoff * 100}% 0 round ${Math.max(0, radius)}px)`;
        actor.clone.style.boxShadow = `0 ${12 + arc * 20}px ${28 + arc * 34}px rgba(0,0,0,${0.28 + arc * 0.28})`;
      });
      /* hero text */
      const heroOut = seg(p, 0.03, 0.1);
      const title = heroTitleRef.current;
      if (title) {
        title.style.opacity = String(1 - easeOut(heroOut));
        title.style.transform = `translateY(${heroOut * -70}px) scale(${1 + heroOut * 0.05})`;
        title.style.visibility = heroOut >= 1 ? "hidden" : "visible";
      }
      const cue = cueRef.current;
      if (cue) cue.style.opacity = String(1 - seg(p, 0.004, 0.03));

      /* spotlight recedes as the desktop workspace takes over */
      const glow = glowRef.current;
      if (glow) glow.style.opacity = String(1 - 0.65 * tM);

      /* Phone hardware recedes more slowly than the interface pieces,
         so the transformation reads as a real device coming apart. */
      const phone = phoneRef.current;
      const tilt = tiltRef.current;
      if (phone && tilt) {
        const lift = easeInOut(seg(p, 0.14, 0.31));
        phone.style.transform = `translate(${lift * -24}px, ${(1 - t1) * 26 + lift * -34}px) scale(${0.96 + 0.04 * t1 - lift * 0.1})`;
        phone.style.opacity = "1";
        phone.style.visibility = tM >= 0.995 ? "hidden" : "visible";
        phone.style.setProperty("--phone-break", tM.toFixed(4));
        tilt.style.transform = `perspective(1500px) rotateX(${6 * (1 - t1)}deg) rotateY(${-24 * (1 - t1)}deg) rotateZ(${-8 * (1 - t1)}deg)`;
      }

      /* feature scenes + finale */
      SCENES.forEach((w, i) => {
        const el = sceneRefs.current[i];
        if (!el) return;
        const tout = w.final ? 0 : easeInOut(seg(p, w.b - 0.045, w.b - 0.008));

        if (w.handoff) {
          /* No intermediate table: the real monitor, shell, controls and
             rows collect directly as the phone pieces move apart. */
          const build = easeOut(seg(p, 0.155, 0.35));
          const copyBuild = easeOut(seg(p, 0.22, 0.35));
          el.style.opacity = "1";
          el.style.visibility = p >= 0.135 && p <= w.b ? "visible" : "hidden";
          el.style.transform = "none";
          el.style.filter = "none";
          el.style.setProperty("--k", build.toFixed(4));
          el.style.setProperty("--copy-k", copyBuild.toFixed(4));
          el.style.setProperty("--out", tout.toFixed(4));
          return;
        }

        const enterStart = w.a - 0.015;
        const tin = easeOut(seg(p, enterStart, w.a + 0.035));
        el.style.opacity = "1";
        el.style.visibility = p >= enterStart && (w.final || p <= w.b) ? "visible" : "hidden";
        el.style.transform = "none";
        el.style.filter = "none";
        el.style.setProperty("--k", tin.toFixed(4));
        el.style.setProperty("--copy-k", tin.toFixed(4));
        el.style.setProperty("--out", tout.toFixed(4));
        if (w.final) el.style.pointerEvents = tin > 0.5 ? "auto" : "none";
      });

      /* dots rail */
      let active = 0;
      if (p >= 0.29) {
        active = 1 + SCENES.findIndex((w, i) => (i === SCENES.length - 1 ? true : p < w.b));
      }
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        dot.dataset.active = i === active ? "1" : "0";
      });
    };

    const tick = () => {
      if (!running) return;
      if (current < 0) current = target;
      const diff = target - current;
      current = Math.abs(diff) < 0.00035 ? target : current + diff * 0.15;
      if (current !== lastApplied) {
        apply(current);
        lastApplied = current;
      }
      raf = requestAnimationFrame(tick);
    };

    scroller.addEventListener("scroll", readTarget, { passive: true });
    window.addEventListener("resize", onResize);
    readTarget();
    findPhoneScroll();
    buildMorphActors();
    tick();
    /* FixedScale commits its cover-fit scale after this effect. Re-find
       the internal scroll surface once that render has flushed. */
    const remeasure = () => {
      findPhoneScroll();
      buildMorphActors();
      lastApplied = -1;
    };
    const rafRemeasure = requestAnimationFrame(() => requestAnimationFrame(remeasure));
    const lateRemeasure = window.setTimeout(remeasure, 450);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rafRemeasure);
      window.clearTimeout(lateRemeasure);
      scroller.removeEventListener("scroll", readTarget);
      window.removeEventListener("resize", onResize);
      clearMorphActors();
    };
  }, [staticMode]);

  const scrollToProgress = (p: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTo({ top: p * max, behavior: "smooth" });
  };

  const css = `
    .sl-root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #020806;
      scrollbar-width: thin;
      scrollbar-color: #ddb159 #020806;
      overscroll-behavior: contain;
    }
    .sl-root::-webkit-scrollbar { width: 11px; }
    .sl-root::-webkit-scrollbar-track { background: #020806; }
    .sl-root::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #f0cf7a, #ddb159 45%, #a7792f);
      border: 3px solid #020806;
      border-radius: 999px;
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
      opacity: 0.05;
      mix-blend-mode: overlay;
    }
    .sl-vignette {
      background: radial-gradient(ellipse 78% 68% at 50% 46%, transparent 58%, rgba(0,0,0,0.62) 100%);
    }

    /* Scene copy is uncovered in crisp staggered cuts instead of fading. */
    .sl-scene .sl-e0 { --sl-copy: clamp(0, var(--copy-k, var(--k, 1)) * 1.9, 1); }
    .sl-scene .sl-e1 { --sl-copy: clamp(0, var(--copy-k, var(--k, 1)) * 1.9 - .22, 1); }
    .sl-scene .sl-e2 { --sl-copy: clamp(0, var(--copy-k, var(--k, 1)) * 1.9 - .44, 1); }
    .sl-scene .sl-e3 { --sl-copy: clamp(0, var(--copy-k, var(--k, 1)) * 1.9 - .62, 1); }
    .sl-scene .sl-e0, .sl-scene .sl-e1, .sl-scene .sl-e2, .sl-scene .sl-e3 {
      --sl-copy-hidden: clamp(0, 1 - var(--sl-copy) + var(--out, 0), 1);
      opacity: 1;
      clip-path: inset(calc(var(--sl-copy-hidden) * 50.1%) 0);
      transform: translate3d(0, calc(var(--sl-copy-hidden) * 30px), 0) scaleX(calc(.96 + (1 - var(--sl-copy-hidden)) * .04));
      will-change: transform, clip-path;
    }

    /* Product screens do not slide as single screenshots. Their chrome,
       controls, cards and data regions assemble independently, then
       disperse in different directions before the next workspace forms. */
    .sl-scene [data-sl-fragment] {
      --sl-build: clamp(0, (var(--k, 1) - var(--sl-delay, 0)) * 2.8, 1);
      --sl-hidden: clamp(0, 1 - var(--sl-build) + var(--out, 0), 1);
      opacity: 1;
      clip-path: inset(calc(var(--sl-hidden) * 50.1%) calc(var(--sl-hidden) * 4%) round calc(4px + var(--sl-hidden) * 12px));
      transform:
        translate3d(
          calc((1 - var(--sl-build)) * var(--sl-in-x, 0px) + var(--out, 0) * var(--sl-out-x, 0px)),
          calc((1 - var(--sl-build)) * var(--sl-in-y, 0px) + var(--out, 0) * var(--sl-out-y, 0px)),
          0
        )
        rotate(calc((1 - var(--sl-build) + var(--out, 0)) * var(--sl-rot, 0deg)))
        scale(calc(.94 + var(--sl-build) * .06 - var(--out, 0) * .025));
      transform-origin: center;
      will-change: transform, clip-path;
    }
    .sl-scene [data-sl-monitor] {
      --sl-monitor-build: clamp(0, (var(--k, 1) - .04) * 1.55, 1);
      --sl-monitor-hidden: clamp(0, 1 - var(--sl-monitor-build) + var(--out, 0), 1);
      opacity: 1;
      clip-path: inset(calc(var(--sl-monitor-hidden) * 50.1%) calc(var(--sl-monitor-hidden) * 2.5%) round calc(18px + var(--sl-monitor-hidden) * 20px));
      transform:
        perspective(1500px)
        translate3d(
          calc((1 - var(--sl-monitor-build)) * 26px + var(--out, 0) * -34px),
          calc((1 - var(--sl-monitor-build)) * 72px + var(--out, 0) * -28px),
          0
        )
        rotateX(calc((1 - var(--sl-monitor-build)) * 8deg + var(--out, 0) * -3deg))
        rotateY(calc((1 - var(--sl-monitor-build)) * -4deg + var(--out, 0) * 2deg))
        scale(calc(.9 + var(--sl-monitor-build) * .1 - var(--out, 0) * .035));
      transform-origin: center 70%;
      will-change: transform, clip-path;
    }
    .sl-scene [data-sl-monitor-bezel] {
      transform: translateY(calc((1 - var(--sl-monitor-build)) * -12px));
      transition: box-shadow 180ms linear;
    }
    .sl-scene [data-sl-morph-target] {
      --sl-target-hidden: clamp(0, 1 - var(--sl-target-reveal, 0) + var(--out, 0), 1);
      opacity: 1 !important;
      clip-path: inset(0 calc(var(--sl-target-hidden) * 100%) 0 0 round 10px) !important;
      transform: translate3d(calc(var(--sl-target-hidden) * 20px), 0, 0) !important;
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
      transform:
        perspective(900px)
        rotateY(calc(var(--phone-break, 0) * 22deg))
        scale(calc(1 - var(--phone-break, 0) * .58));
      transform-origin: center;
      will-change: transform, clip-path;
    }
    [data-sl-morph-actor] {
      backface-visibility: hidden;
      contain: layout paint style;
    }

    .sl-dot {
      display: block; height: 8px; width: 8px; border-radius: 999px;
      background: rgba(255,255,255,0.22);
      transition: background 300ms ease, transform 300ms ease, box-shadow 300ms ease;
    }
    .sl-dotbtn[data-active="1"] .sl-dot {
      background: #ddb159; transform: scale(1.45);
      box-shadow: 0 0 14px rgba(221,177,89,0.65);
    }
    .sl-dotbtn .sl-dotlabel {
      position: absolute; right: 26px; top: 50%; transform: translateY(-50%) translateX(6px);
      white-space: nowrap; opacity: 0; pointer-events: none;
      transition: opacity 200ms ease, transform 200ms ease;
    }
    .sl-dotbtn:hover .sl-dotlabel, .sl-dotbtn:focus-visible .sl-dotlabel {
      opacity: 1; transform: translateY(-50%) translateX(0);
    }

    @keyframes slCue {
      0%, 100% { transform: translateY(0); opacity: 0.9; }
      50% { transform: translateY(9px); opacity: 0.4; }
    }
    .sl-cue-anim { animation: slCue 1.8s ease-in-out infinite; }
    @keyframes slCaret { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
    .sl-caret { animation: slCaret 1s steps(1) infinite; }
    @keyframes slPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .sl-pulse { animation: slPulse 1.6s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .sl-cue-anim, .sl-caret, .sl-pulse { animation: none !important; }
      .sl-scene [data-sl-fragment], .sl-scene [data-sl-monitor], .sl-scene [data-sl-monitor-bezel],
      [data-sl-phone-piece], [data-sl-phone-hardware] {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
        clip-path: none !important;
      }
    }
  `;

  if (staticMode) {
    return (
      <main className="sl-root">
        <style>{css}</style>
        <StaticLanding metrics={metrics} />
      </main>
    );
  }

  const hiddenScene: CSSProperties = {
    opacity: 0,
    visibility: "hidden",
    transform: "none",
  };

  const screens = [
    <RankingsScreen key="r" metrics={metrics} />,
    <PortfolioScreen key="p" />,
    <NewsScreen key="n" />,
    <ChatScreen key="c" />,
  ];

  return (
    <main ref={scrollerRef} className="sl-root h-[100dvh] overflow-y-auto overflow-x-hidden">
      <style>{css}</style>
      <TopNav />

      {/* scroll track — the stage stays pinned while this scrolls */}
      <div className="h-[700vh]">
        <div className="sl-bg sticky top-0 h-[100dvh] overflow-hidden">
          {/* atmosphere */}
          <div
            ref={glowRef}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 46% 42% at 50% 6%, rgba(244,231,193,0.15), transparent 60%), radial-gradient(ellipse 30% 26% at 50% 30%, rgba(221,177,89,0.12), transparent 65%)",
            }}
          />
          <div className="pointer-events-none absolute bottom-[6%] left-1/2 h-[10vh] w-[64vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(221,177,89,0.10),transparent_70%)] blur-2xl" />
          <div className="sl-grain pointer-events-none absolute inset-0" />
          <div className="sl-vignette pointer-events-none absolute inset-0" />

          {/* hero phone — pointer-events-none is load-bearing: this
              full-viewport container sits above the scenes (z-26 > z-20)
              and would otherwise swallow every tap on their buttons */}
          <div className="pointer-events-none absolute inset-0 z-[26] flex items-center justify-center pt-[24vh]">
            <div ref={phoneRef} style={{ transform: "translateY(26px) scale(0.96)" }}>
              <div
                ref={tiltRef}
                style={{
                  transform: "perspective(1500px) rotateX(6deg) rotateY(-24deg) rotateZ(-8deg)",
                }}
              >
                <CinematicPhone />
              </div>
            </div>
          </div>

          {/* Detached interface modules travel above both devices during
              the mobile-to-desktop handoff. The layer is populated from
              live DOM so it stays exact at every responsive breakpoint. */}
          <div ref={morphLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[28] overflow-visible" />

          {/* hero title */}
          <div
            ref={heroTitleRef}
            className="pointer-events-none absolute inset-x-0 top-[11vh] z-10 flex flex-col items-center px-4 text-center"
          >
            <h1
              className="text-[clamp(56px,12.5vw,150px)] font-black leading-none tracking-[-0.055em] text-white"
              style={{ textShadow: "0 10px 60px rgba(0,0,0,0.75), 0 0 110px rgba(221,177,89,0.18)" }}
            >
              StockGPT
            </h1>
            <p className="sl-mono mt-2 text-[clamp(11px,1.7vw,18px)] font-bold uppercase tracking-[0.44em] text-white/60">
              AI-driven market insights
            </p>
          </div>

          {/* scroll cue */}
          <div
            ref={cueRef}
            className="pointer-events-none absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
          >
            <span className="sl-mono text-[9.5px] font-black uppercase tracking-[0.4em] text-white/45">
              Scroll
            </span>
            <span className="sl-cue-anim flex h-9 w-[22px] items-start justify-center rounded-full border border-white/30 pt-1.5">
              <span className="h-2 w-[3px] rounded-full bg-[#ddb159]" />
            </span>
          </div>

          {/* feature scenes */}
          {SCENE_COPY.map((copy, i) => (
            <div
              key={copy.index}
              ref={(el) => {
                sceneRefs.current[i] = el;
              }}
            className="sl-scene absolute inset-0 z-20 flex flex-col items-center justify-center gap-[2.2vh] pb-[1vh] pt-[8.5vh]"
              style={i === 0 ? { opacity: 0, visibility: "hidden" } : hiddenScene}
            >
              <SceneCopy copy={copy} />
              <PanelFrame>
                <FixedScale w={1280} h={756}>
                  {screens[i]}
                </FixedScale>
              </PanelFrame>
            </div>
          ))}

          {/* finale */}
          <div
            ref={(el) => {
              sceneRefs.current[4] = el;
            }}
            className="sl-scene absolute inset-0 z-20 flex items-center justify-center"
            style={{ ...hiddenScene, pointerEvents: "none" }}
          >
            <FinaleContent />
          </div>

          {/* progress dots */}
          <nav
            aria-label="Landing sections"
            className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-4 md:flex"
          >
            {DOT_STOPS.map((stop, i) => (
              <button
                key={stop.label}
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                type="button"
                data-active={i === 0 ? "1" : "0"}
                aria-label={stop.label}
                onClick={() => scrollToProgress(stop.p)}
                className="sl-dotbtn relative p-1 focus:outline-none"
              >
                <span className="sl-dot" />
                <span className="sl-dotlabel sl-mono text-[9px] font-black uppercase tracking-[0.22em] text-white/55">
                  {stop.label}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
