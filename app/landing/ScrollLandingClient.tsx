"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DashboardRow, LandingMetrics } from "./ScrollLandingScreens";
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
/*  scrubbed from it — the page never visually scrolls, it animates.  */
/*                                                                    */
/*    0.000 – 0.100  hero: diagonal phone under a spotlight           */
/*    0.030 – 0.140  phone straightens to vertical                    */
/*    0.140 – 0.270  camera pulls back — the phone screen turns out   */
/*                   to be one pixel of a giant dot-matrix letter     */
/*    0.270 – 0.400  keep pulling back: the letter shrinks until it   */
/*                   is the "R" of "Ranked." in the next headline     */
/*    0.290 – 0.460  scene 1 · Rankings                               */
/*    0.460 – 0.620  scene 2 · Portfolio Builder                      */
/*    0.620 – 0.780  scene 3 · World News                             */
/*    0.780 – 0.900  scene 4 · Ask StockGPT                           */
/*    0.900 – 1.000  finale · CTA                                     */
/* ================================================================== */

const STRAIGHTEN = { a: 0.03, b: 0.14 };
/* one continuous exponential zoom-out: the phone screen is a single
   native pixel of the headline's "R"; the camera pulls back ~7000×
   until the glyph sits at its real size in the scene-1 headline */
const PIXEL_ZOOM = { a: 0.14, b: 0.4 };
/* native pixel rows of the R bitmap — hundreds of thousands of
   individually-shaded pixels, rendered on canvas so density is free */
const GLYPH_ROWS = 768;

const SCENES: { a: number; b: number; final?: boolean; pixel?: boolean }[] = [
  /* scene 1 fades in around the landing dot-letter — no slide, no
     scale, so the measured letter target stays put */
  { a: 0.29, b: 0.46, pixel: true },
  { a: 0.46, b: 0.62 },
  { a: 0.62, b: 0.78 },
  { a: 0.78, b: 0.9 },
  { a: 0.9, b: 1.0, final: true },
];

/* Progress targets for the side-rail dots. */
const DOT_STOPS = [
  { label: "Intro", p: 0 },
  { label: "Rankings", p: 0.37 },
  { label: "Portfolio Builder", p: 0.54 },
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
        Every stock. Scored.{" "}
        <em className="whitespace-nowrap not-italic">
          {/* the dot-matrix letter from the pixel zoom-out lands on this R */}
          <span data-sl-rtarget className="sl-gold inline-block">
            R
          </span>
          <span className="sl-gold">anked.</span>
        </em>
      </>
    ),
    body:
      "StockGPT scans 500+ US stocks every single day and distils quality, growth, value, momentum, risk and income into one score — so your research starts at the top of a ranked list, not in a hundred open tabs.",
    chips: ["Daily model runs", "Six-factor scoring", "Rank movement tracking"],
  },
  {
    index: "02",
    eyebrow: "Portfolio Builder",
    title: (
      <>
        Tell it your risk. <em className="sl-gold not-italic">Watch it build.</em>
      </>
    ),
    body:
      "Set your risk appetite, horizon and sector tilt — the Portfolio Builder drafts a fully-weighted allocation from the live rankings in seconds. Import your real positions and it keeps watching exposure, concentration and weak-ranked holdings for you.",
    chips: ["Risk-based generation", "Trading 212 CSV import", "Exposure monitoring"],
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

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#04120b]"
      style={{
        width: "min(1220px, 94vw, 118vh)",
        aspectRatio: "1280 / 800",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.6), 0 60px 140px rgba(0,0,0,0.72), 0 0 120px rgba(221,177,89,0.07)",
      }}
    >
      <div className="flex h-[5.5%] min-h-[30px] shrink-0 items-center gap-3 border-b border-white/8 bg-[#0a150f] px-4">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="sl-mono mx-auto flex items-center gap-2 rounded-full border border-white/8 bg-black/30 px-4 py-1 text-[10px] font-bold text-white/45">
          <svg width="9" height="10" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="1" y="5" width="8" height="6" rx="1.5" />
            <path d="M3 5V3.5a2 2 0 0 1 4 0V5" />
          </svg>
          {url}
        </span>
        <span className="w-[52px]" />
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  High-definition iPhone                                            */
/* ------------------------------------------------------------------ */

function CinematicPhone({
  metrics,
  rows,
  frameRef,
  dimRef,
}: {
  metrics: LandingMetrics;
  rows?: DashboardRow[];
  frameRef: React.RefObject<HTMLDivElement | null>;
  dimRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative" style={{ width: "min(296px, 58vw, 29vh)", aspectRatio: "320 / 655" }}>
      {/* titanium rail */}
      <div
        ref={frameRef}
        className="absolute inset-0 rounded-[17.5%_/_8.6%]"
        style={{
          background:
            "linear-gradient(148deg, #585e58 0%, #23292a 16%, #14181a 38%, #454b46 52%, #171b1d 68%, #3c423d 88%, #101413 100%)",
          boxShadow:
            "0 60px 130px rgba(0,0,0,0.85), 0 24px 55px rgba(0,0,0,0.6), 0 0 90px rgba(221,177,89,0.10)",
        }}
      >
        {/* side buttons */}
        <div className="absolute -left-[1.2%] top-[21%] h-[4.5%] w-[1.4%] rounded-l-md bg-[linear-gradient(90deg,#4c524d,#181c1d)]" />
        <div className="absolute -left-[1.2%] top-[28%] h-[8%] w-[1.4%] rounded-l-md bg-[linear-gradient(90deg,#4c524d,#181c1d)]" />
        <div className="absolute -left-[1.2%] top-[38%] h-[8%] w-[1.4%] rounded-l-md bg-[linear-gradient(90deg,#4c524d,#181c1d)]" />
        <div className="absolute -right-[1.2%] top-[30%] h-[11%] w-[1.4%] rounded-r-md bg-[linear-gradient(270deg,#4c524d,#181c1d)]" />
      </div>

      {/* black bezel */}
      <div className="absolute inset-[1.6%_3.2%] rounded-[15.5%_/_7.4%] bg-black" />

      {/* screen — inset tuned so its aspect matches the 330×700 design
          canvas and the cover-fit never crops the header edges */}
      <div className="absolute inset-[2.6%_4.3%] overflow-hidden rounded-[13%_/_6.2%] bg-[#04120b]">
        <FixedScale w={330} h={700} mode="cover">
          <PhoneDashboardScreen metrics={metrics} rows={rows} />
        </FixedScale>

        {/* pixel glow: the screen turns solid gold as it shrinks into a
            single dot of the letter grid */}
        <div
          ref={dimRef}
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0,
            background: "linear-gradient(135deg, #f4d78a 0%, #ddb159 55%, #c99a3e 100%)",
          }}
        />

        {/* glass glare */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(112deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.045) 18%, transparent 30%, transparent 68%, rgba(255,255,255,0.03) 86%)",
          }}
        />
      </div>

      {/* dynamic island */}
      <div className="absolute left-1/2 top-[4.2%] z-10 h-[3.4%] w-[27%] -translate-x-1/2 rounded-full bg-black">
        <div className="absolute right-[12%] top-1/2 h-[42%] w-[13%] -translate-y-1/2 rounded-full bg-[#0d1420]" />
      </div>
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
          <Link
            href="/login"
            className="hidden h-11 items-center rounded-full border border-white/20 bg-black/30 px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-white no-underline backdrop-blur-md transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159] sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline transition-colors hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black"
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

function StaticLanding({
  metrics,
  topRankings,
}: {
  metrics: LandingMetrics;
  topRankings?: DashboardRow[];
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const screens = [
    { url: "stockgpt.pro/rankings", node: <RankingsScreen rows={topRankings} metrics={metrics} /> },
    { url: "stockgpt.pro/portfolio", node: <PortfolioScreen /> },
    { url: "stockgpt.pro/world-news", node: <NewsScreen /> },
    { url: "stockgpt.pro/ask-stockgpt", node: <ChatScreen /> },
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
          <CinematicPhone metrics={metrics} rows={topRankings} frameRef={frameRef} dimRef={dimRef} />
        </div>
      </section>

      {SCENE_COPY.map((copy, i) => (
        <section key={copy.index} className="flex flex-col items-center gap-8 px-4 py-16">
          <SceneCopy copy={copy} />
          <BrowserFrame url={screens[i].url}>
            <FixedScale w={1280} h={756}>
              {screens[i].node}
            </FixedScale>
          </BrowserFrame>
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

export function ScrollLandingClient({
  metrics,
  topRankings,
}: {
  metrics: LandingMetrics;
  topRankings?: DashboardRow[];
}) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

    /* ------------------------------------------------------------ */
    /*  Deep-zoom world model. "World" = scene-1's final layout in    */
    /*  viewport px. The headline's R glyph, magnified, is a bitmap   */
    /*  of GLYPH_ROWS×~GLYPH_ROWS×0.75 native pixels; the phone       */
    /*  screen IS one of those pixels. A single exponential camera    */
    /*  Z: Z0 → 1 drives phone, pixel canvas and scene together.      */
    /*  All geometry comes from layout offsets + canvas font metrics, */
    /*  so the glyph lands on the real letter at any viewport.        */
    /* ------------------------------------------------------------ */
    let bmp: HTMLCanvasElement | null = null;
    let bmpCols = 1;
    let pixelRow = 0;
    let pixelCol = 0;
    let glyph = { x: 0, y: 0, w: 40, h: 40 }; // world rect of the R glyph
    let u = 0.1; // world size of one native pixel
    let P = { x: 0, y: 0 }; // world position of the phone's pixel
    let Z0 = 4000; // camera scale at which that pixel is phone-sized
    const fontFamily = getComputedStyle(scroller).fontFamily;

    const buildBitmap = () => {
      const c = document.createElement("canvas");
      const mctx = c.getContext("2d", { willReadFrequently: true });
      if (!mctx) return;
      const probe = 100;
      mctx.font = `900 ${probe}px ${fontFamily}`;
      const m = mctx.measureText("R");
      const tightW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const tightH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      if (tightW <= 0 || tightH <= 0) return;
      bmpCols = Math.max(8, Math.round((GLYPH_ROWS * tightW) / tightH));
      c.width = bmpCols;
      c.height = GLYPH_ROWS;
      const fs = probe * (GLYPH_ROWS / tightH);
      mctx.font = `900 ${fs}px ${fontFamily}`;
      const m2 = mctx.measureText("R");
      const grad = mctx.createLinearGradient(0, 0, bmpCols, GLYPH_ROWS);
      grad.addColorStop(0, "#f4d78a");
      grad.addColorStop(0.55, "#ddb159");
      grad.addColorStop(1, "#c08f2f");
      mctx.fillStyle = grad;
      mctx.fillText("R", m2.actualBoundingBoxLeft, m2.actualBoundingBoxAscent);
      /* per-pixel brightness noise: at depth every native pixel reads
         as an individual tile; zoomed out it fuses into solid gold */
      const img = mctx.getImageData(0, 0, bmpCols, GLYPH_ROWS);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 10) {
          const f = 0.84 + Math.random() * 0.3;
          d[i] = Math.min(255, d[i] * f);
          d[i + 1] = Math.min(255, d[i + 1] * f);
          d[i + 2] = Math.min(255, d[i + 2] * f);
          d[i + 3] = 255;
        } else {
          d[i + 3] = 0;
        }
      }
      mctx.putImageData(img, 0, 0);
      /* the phone's pixel: middle of the left stem, mid-height */
      pixelRow = Math.round(GLYPH_ROWS * 0.56);
      let runStart = -1;
      let runEnd = -1;
      for (let cx = 0; cx < bmpCols; cx++) {
        const filled = img.data[(pixelRow * bmpCols + cx) * 4 + 3] > 128;
        if (filled && runStart < 0) runStart = cx;
        if (!filled && runStart >= 0) {
          runEnd = cx;
          break;
        }
      }
      if (runEnd < 0) runEnd = runStart + 1;
      pixelCol = runStart >= 0 ? Math.floor((runStart + runEnd) / 2) : Math.floor(bmpCols / 4);
      bmp = c;
    };

    const measureGeometry = () => {
      const sceneRoot = sceneRefs.current[0];
      const rEl = sceneRoot?.querySelector<HTMLElement>("[data-sl-rtarget]");
      const mctx = document.createElement("canvas").getContext("2d");
      if (!sceneRoot || !rEl || !mctx) return;
      let x = 0;
      let y = 0;
      let el: Element | null = rEl;
      while (el instanceof HTMLElement && el !== sceneRoot) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent;
      }
      /* tight glyph box inside the span's line box, via font metrics
         (the headline uses leading-[1.02], so font-size = height/1.02) */
      const lineH = rEl.offsetHeight;
      const fs = lineH / 1.02;
      mctx.font = `900 ${fs}px ${fontFamily}`;
      const m = mctx.measureText("R");
      const fba = m.fontBoundingBoxAscent || fs * 0.78;
      const fbd = m.fontBoundingBoxDescent || fs * 0.22;
      const halfLeading = (lineH - (fba + fbd)) / 2;
      const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const gw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      glyph = {
        x: x - m.actualBoundingBoxLeft,
        y: y + halfLeading + fba - m.actualBoundingBoxAscent,
        w: gw > 0 ? gw : rEl.offsetWidth,
        h: gh > 0 ? gh : lineH * 0.72,
      };
      u = glyph.h / GLYPH_ROWS;
      P = {
        x: glyph.x + ((pixelCol + 0.5) * glyph.w) / bmpCols,
        y: glyph.y + (pixelRow + 0.5) * u,
      };
      const phoneH = frameRef.current?.offsetHeight || 534;
      Z0 = phoneH / u;
      /* pixel canvas backing store follows the viewport */
      const cv = pixelCanvasRef.current;
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(scroller.clientWidth * dpr);
        cv.height = Math.round(scroller.clientHeight * dpr);
      }
    };

    const readTarget = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      target = max > 0 ? scroller.scrollTop / max : 0;
    };

    const onResize = () => {
      readTarget();
      measureGeometry();
    };

    const drawPixels = (Z: number, Sx: number, Sy: number, alpha: number) => {
      const cv = pixelCanvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx || !bmp) return;
      const vw = scroller.clientWidth;
      const vh = scroller.clientHeight;
      const dpr = cv.width / Math.max(1, vw);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      /* apparent size of one native pixel, and the glyph's screen rect */
      const ps = u * Z;
      const gx = (glyph.x - P.x) * Z + Sx;
      const gy = (glyph.y - P.y) * Z + Sy;
      /* crop to the visible part of the bitmap so cost is constant */
      const psx = (glyph.w / bmpCols) * Z;
      const sx0 = Math.max(0, Math.floor((0 - gx) / psx));
      const sx1 = Math.min(bmpCols, Math.ceil((vw - gx) / psx));
      const sy0 = Math.max(0, Math.floor((0 - gy) / ps));
      const sy1 = Math.min(GLYPH_ROWS, Math.ceil((vh - gy) / ps));
      if (sx1 <= sx0 || sy1 <= sy0) return;
      ctx.imageSmoothingEnabled = ps < 2;
      ctx.drawImage(
        bmp,
        sx0,
        sy0,
        sx1 - sx0,
        sy1 - sy0,
        gx + sx0 * psx,
        gy + sy0 * ps,
        (sx1 - sx0) * psx,
        (sy1 - sy0) * ps,
      );
      /* pixel-grid seams, fading out as the pixels fuse into the glyph */
      if (ps > 6) {
        ctx.globalAlpha = alpha * Math.min(1, (ps - 6) / 12) * 0.55;
        ctx.strokeStyle = "#020806";
        ctx.lineWidth = Math.min(3, ps * 0.06);
        ctx.beginPath();
        for (let cx = sx0; cx <= sx1; cx++) {
          const lx = gx + cx * psx;
          ctx.moveTo(lx, Math.max(0, gy + sy0 * ps));
          ctx.lineTo(lx, Math.min(vh, gy + sy1 * ps));
        }
        for (let cy = sy0; cy <= sy1; cy++) {
          const ly = gy + cy * ps;
          ctx.moveTo(Math.max(0, gx + sx0 * psx), ly);
          ctx.lineTo(Math.min(vw, gx + sx1 * psx), ly);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const apply = (p: number) => {
      const vw = scroller.clientWidth;
      const vh = scroller.clientHeight;
      const t1 = easeInOut(seg(p, STRAIGHTEN.a, STRAIGHTEN.b));

      /* the camera: exponential zoom-out Z0 → 1, panning its focus from
         the phone's resting point to the pixel's true place in the text */
      const tz = easeInOut(seg(p, PIXEL_ZOOM.a, PIXEL_ZOOM.b));
      const Z = Math.exp(Math.log(Math.max(2, Z0)) * (1 - tz));
      const tp = easeInOut(seg(p, PIXEL_ZOOM.a, 0.36));
      const phoneCy = 0.62 * vh; /* phone rest centre (pt-24vh container) */
      const Sx = vw / 2 + (P.x - vw / 2) * tp;
      const Sy = phoneCy + (P.y - phoneCy) * tp;
      /* apparent size of the phone's pixel right now */
      const ap = u * Z;

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

      /* spotlight recedes as the camera pulls back */
      const glow = glowRef.current;
      if (glow) glow.style.opacity = String(1 - 0.65 * tz);

      /* phone: straighten, then ride the camera down to one pixel */
      const phone = phoneRef.current;
      const tilt = tiltRef.current;
      const frame = frameRef.current;
      if (phone && tilt && frame) {
        const phoneH = frame.offsetHeight || 1;
        const sh = (0.96 + 0.04 * t1) * Math.min(1, ap / phoneH);
        const tx = Sx - vw / 2;
        const ty = Sy - phoneCy + (1 - t1) * 26;
        phone.style.transform = `translate(${tx}px, ${ty}px) scale(${sh})`;
        /* dissolve into the pixel field once it's down to a dot */
        const o = clamp01((ap - 40) / 50);
        phone.style.opacity = String(o);
        phone.style.visibility = o <= 0 ? "hidden" : "visible";
        tilt.style.transform = `perspective(1500px) rotateX(${6 * (1 - t1)}deg) rotateY(${-24 * (1 - t1)}deg) rotateZ(${-8 * (1 - t1)}deg)`;
        /* bezel melts away, screen floods gold — a lone lit pixel */
        frame.style.opacity = String(clamp01((ap - phoneH * 0.45) / (phoneH * 0.35)));
        const dim = dimRef.current;
        if (dim) dim.style.opacity = String(1 - clamp01((ap - phoneH * 0.3) / (phoneH * 0.45)));
      }

      /* the pixel field itself */
      const cv = pixelCanvasRef.current;
      if (cv) {
        const on = p > PIXEL_ZOOM.a - 0.01 && p < 0.42;
        cv.style.visibility = on ? "visible" : "hidden";
        if (on) drawPixels(Z, Sx, Sy, seg(p, 0.145, 0.19) * (1 - seg(p, 0.385, 0.41)));
      }

      /* feature scenes + finale */
      SCENES.forEach((w, i) => {
        const el = sceneRefs.current[i];
        if (!el) return;
        const t = seg(p, w.a, w.b);
        const outRaw = w.final ? 0 : seg(t, 0.82, 1);
        const tout = outRaw * outRaw;

        if (w.pixel) {
          /* this scene rides the same camera as the pixel field: it
             fades in while still ~9× oversized — as if the page were
             laid out for a vastly bigger screen — and shrinks into
             place anchored on the R the pixels are becoming */
          const o = seg(Z, 14, 6) * (1 - tout);
          el.style.opacity = String(o);
          el.style.visibility = o < 0.003 ? "hidden" : "visible";
          if (tout > 0) {
            el.style.transformOrigin = "50% 50%";
            el.style.transform = `scale(${1 + tout * 0.13})`;
          } else {
            el.style.transformOrigin = `${P.x}px ${P.y}px`;
            el.style.transform = `translate(${Sx - P.x}px, ${Sy - P.y}px) scale(${Math.min(Z, 9.5)})`;
          }
          el.style.filter = tout > 0.01 ? `blur(${tout * 6}px)` : "none";
          el.style.setProperty("--k", easeOut(seg(p, 0.3, 0.36)).toFixed(4));
          return;
        }

        const tin = easeOut(seg(t, 0, w.final ? 0.5 : 0.24));
        const o = tin * (1 - tout);
        el.style.opacity = String(o);
        el.style.visibility = o < 0.003 ? "hidden" : "visible";
        el.style.transform = `translateY(${(1 - tin) * 90}px) scale(${0.95 + tin * 0.05 + tout * 0.13})`;
        el.style.filter = tout > 0.01 ? `blur(${tout * 6}px)` : "none";
        el.style.setProperty("--k", tin.toFixed(4));
        if (w.final) el.style.pointerEvents = o > 0.5 ? "auto" : "none";
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
    buildBitmap();
    measureGeometry();
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", readTarget);
      window.removeEventListener("resize", onResize);
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

    /* staggered children inside a scene, driven by the scene's --k */
    .sl-scene .sl-e0, .sl-scene .sl-e1, .sl-scene .sl-e2, .sl-scene .sl-e3 { will-change: transform, opacity; }
    .sl-scene .sl-e0 { opacity: calc(var(--k, 1) * 1.9); transform: translateY(calc(clamp(0, 1 - var(--k, 1) * 1.9, 1) * 26px)); }
    .sl-scene .sl-e1 { opacity: calc(var(--k, 1) * 1.9 - 0.22); transform: translateY(calc(clamp(0, 1 - (var(--k, 1) * 1.9 - 0.22), 1) * 34px)); }
    .sl-scene .sl-e2 { opacity: calc(var(--k, 1) * 1.9 - 0.44); transform: translateY(calc(clamp(0, 1 - (var(--k, 1) * 1.9 - 0.44), 1) * 40px)); }
    .sl-scene .sl-e3 { opacity: calc(var(--k, 1) * 1.9 - 0.62); transform: translateY(calc(clamp(0, 1 - (var(--k, 1) * 1.9 - 0.62), 1) * 46px)); }

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
    }
  `;

  if (staticMode) {
    return (
      <main className="sl-root">
        <style>{css}</style>
        <StaticLanding metrics={metrics} topRankings={topRankings} />
      </main>
    );
  }

  const hiddenScene: CSSProperties = {
    opacity: 0,
    visibility: "hidden",
    transform: "translateY(90px) scale(0.95)",
  };

  const screens = [
    { url: "stockgpt.pro/rankings", node: <RankingsScreen rows={topRankings} metrics={metrics} /> },
    { url: "stockgpt.pro/portfolio", node: <PortfolioScreen /> },
    { url: "stockgpt.pro/world-news", node: <NewsScreen /> },
    { url: "stockgpt.pro/ask-stockgpt", node: <ChatScreen /> },
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

          {/* the pixel field: a canvas deep-zoom of the headline's R,
              ~200k native pixels, seamless from phone-pixel to glyph */}
          <canvas
            ref={pixelCanvasRef}
            className="pointer-events-none absolute inset-0 z-[25] h-full w-full"
            style={{ visibility: "hidden" }}
          />

          {/* hero phone — above the pixel field it dissolves into */}
          <div className="absolute inset-0 z-[26] flex items-center justify-center pt-[24vh]">
            <div ref={phoneRef} style={{ transform: "translateY(26px) scale(0.96)" }}>
              <div
                ref={tiltRef}
                style={{
                  transform: "perspective(1500px) rotateX(6deg) rotateY(-24deg) rotateZ(-8deg)",
                }}
              >
                <CinematicPhone
                  metrics={metrics}
                  rows={topRankings}
                  frameRef={frameRef}
                  dimRef={dimRef}
                />
              </div>
            </div>
          </div>

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
              className="sl-scene absolute inset-0 z-20 flex flex-col items-center justify-center gap-[3.2vh] pb-[2vh] pt-[10vh]"
              style={hiddenScene}
            >
              <SceneCopy copy={copy} />
              <BrowserFrame url={screens[i].url}>
                <FixedScale w={1280} h={756}>
                  {screens[i].node}
                </FixedScale>
              </BrowserFrame>
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
