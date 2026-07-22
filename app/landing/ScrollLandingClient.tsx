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
  RankCard,
  RANK_CARD_W0,
  RANK_CARD_W1,
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
/* the invisible cut: the phone's "Top ranked" card undocks and flies
   to its slide-2 slot (MORPH) while its own layout unfolds from the
   compact mobile card into the desktop table (UNFOLD). The card is the
   same component in both worlds, so no surface ever swaps on screen. */
const MORPH = { a: 0.14, b: 0.33 };
const UNFOLD = { a: 0.17, b: 0.33 };

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
        Every stock. Scored. <em className="sl-gold not-italic">Ranked.</em>
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
        "fx-sheen inline-flex h-12 items-center justify-center rounded-full px-7 text-[12px] font-black uppercase tracking-[0.16em] no-underline transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black",
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
      className="overflow-hidden rounded-3xl border border-white/12 bg-[#04120b]"
      style={{
        width: "min(1220px, 94vw, 112vh)",
        aspectRatio: "1280 / 756",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.6), 0 60px 140px rgba(0,0,0,0.72), 0 0 120px rgba(221,177,89,0.07)",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  High-definition iPhone                                            */
/* ------------------------------------------------------------------ */

function CinematicPhone({
  metrics,
  frameRef,
  dimRef,
}: {
  metrics: LandingMetrics;
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
          <PhoneDashboardScreen metrics={metrics} />
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
            className="fx-sheen hidden h-11 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-6 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline transition-colors hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:inline-flex"
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
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
          <CinematicPhone metrics={metrics} frameRef={frameRef} dimRef={dimRef} />
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
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
    /*  Geometry for the invisible cut. All rects are measured with   */
    /*  transforms neutralised, so they are exact at any viewport:    */
    /*    c0    the card's resting rect inside the straightened phone */
    /*    slot  the card's destination rect in slide 2                */
    /*    phoneC the phone's layout centre (for slaving its zoom)     */
    /* ------------------------------------------------------------ */
    let c0 = { x: 0, y: 0, w: 216, h: 200, cx: 0, cy: 0 };
    let slot = { x: 0, y: 0, w: 900, cx: 0 };
    let phoneC = { x: 0, y: 0 };
    let cardHole: HTMLElement | null = null;

    const measureGeometry = () => {
      const phone = phoneRef.current;
      const tilt = tiltRef.current;
      const scene0 = sceneRefs.current[0];
      const slotEl = slotRef.current;
      cardHole = phone?.querySelector<HTMLElement>("[data-sl-zoom]") ?? null;
      if (!phone || !tilt || !scene0 || !slotEl || !cardHole) return;
      /* neutralise the scrub transforms; no paint can happen inside
         this synchronous block, so nothing flashes */
      const saved = [phone.style.transform, tilt.style.transform, scene0.style.transform];
      phone.style.transform = "none";
      tilt.style.transform = "none";
      scene0.style.transform = "none";
      const cr = cardHole.getBoundingClientRect();
      const sr = slotEl.getBoundingClientRect();
      const pr = phone.getBoundingClientRect();
      c0 = {
        x: cr.left,
        y: cr.top,
        w: cr.width,
        h: cr.height,
        cx: cr.left + cr.width / 2,
        cy: cr.top + cr.height / 2,
      };
      slot = { x: sr.left, y: sr.top, w: sr.width, cx: sr.left + sr.width / 2 };
      phoneC = { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2 };
      phone.style.transform = saved[0];
      tilt.style.transform = saved[1];
      scene0.style.transform = saved[2];
    };

    const readTarget = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      target = max > 0 ? scroller.scrollTop / max : 0;
    };

    const onResize = () => {
      readTarget();
      measureGeometry();
    };

    const apply = (p: number) => {
      const t1 = easeInOut(seg(p, STRAIGHTEN.a, STRAIGHTEN.b));
      /* card flight (rect) and card unfold (internal layout) */
      const tM = easeInOut(seg(p, MORPH.a, MORPH.b));
      const tC = easeInOut(seg(p, UNFOLD.a, UNFOLD.b));
      /* scene-0 exit drives the landed card out with its copy */
      const t0 = seg(p, SCENES[0].a, SCENES[0].b);
      const out0 = seg(t0, 0.82, 1);
      const tout0 = out0 * out0;

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

      /* spotlight recedes as the card takes over the frame */
      const glow = glowRef.current;
      if (glow) glow.style.opacity = String(1 - 0.65 * tM);

      /* the flying card: same component as in the phone, taking off
         from the exact pixels of the in-phone card and landing on the
         slide-2 slot while its layout unfolds to the desktop table */
      const W = c0.w + (slot.w - c0.w) * tM;
      const designW = RANK_CARD_W0 + (RANK_CARD_W1 - RANK_CARD_W0) * tC;
      const k = W / designW;
      const cx = c0.cx + (slot.cx - c0.cx) * tM;
      const y = c0.y + (slot.y - c0.y) * tM;
      const ov = overlayRef.current;
      if (ov) {
        const on = p >= MORPH.a && p < 0.475;
        ov.style.visibility = on ? "visible" : "hidden";
        ov.style.opacity = String(1 - tout0);
        ov.style.setProperty("--t", tC.toFixed(4));
        ov.style.transform = `translate(${cx - W / 2}px, ${y}px) scale(${k * (1 + tout0 * 0.1)})`;
        ov.style.filter = tout0 > 0.01 ? `blur(${tout0 * 6}px)` : "none";
      }
      /* the in-phone copy of the card hides the instant the flying one
         covers it — identical pixels, so the swap cannot be seen */
      if (cardHole) cardHole.style.visibility = p >= MORPH.a ? "hidden" : "visible";

      /* phone: straighten, then slaved to the flying card — it scales
         slightly faster so its edges exit the viewport, and only fades
         once what remains on screen is featureless dark background */
      const phone = phoneRef.current;
      const tilt = tiltRef.current;
      if (phone && tilt) {
        const F = 1 + ((slot.w / Math.max(1, c0.w)) * 1.22 - 1) * tM;
        /* glue the hidden card's TOP edge to the flying card's top so
           the dashboard above stays visually attached to it */
        const tx = tM > 0 ? cx - phoneC.x - (c0.cx - phoneC.x) * F : 0;
        const ty = (tM > 0 ? y - phoneC.y - (c0.y - phoneC.y) * F : 0) + (1 - t1) * 26;
        phone.style.transform = `translate(${tx}px, ${ty}px) scale(${(0.96 + 0.04 * t1) * F})`;
        const o = 1 - seg(p, 0.27, 0.315);
        phone.style.opacity = String(o);
        phone.style.visibility = o <= 0 ? "hidden" : "visible";
        tilt.style.transform = `perspective(1500px) rotateX(${6 * (1 - t1)}deg) rotateY(${-24 * (1 - t1)}deg) rotateZ(${-8 * (1 - t1)}deg)`;
      }

      /* feature scenes + finale */
      SCENES.forEach((w, i) => {
        const el = sceneRefs.current[i];
        if (!el) return;
        const t = seg(p, w.a, w.b);
        const outRaw = w.final ? 0 : seg(t, 0.82, 1);
        const tout = outRaw * outRaw;

        if (w.pixel) {
          /* the card is already on screen carrying the transition; the
             copy above it rises in around the landed card. The scene
             root must not move while entering, or the slot would slide
             out from under the card. */
          const o = seg(p, 0.27, 0.31) * (1 - tout);
          el.style.opacity = String(o);
          el.style.visibility = o < 0.003 ? "hidden" : "visible";
          el.style.transform = tout > 0 ? `scale(${1 + tout * 0.13})` : "none";
          el.style.filter = tout > 0.01 ? `blur(${tout * 6}px)` : "none";
          el.style.setProperty("--k", easeOut(seg(p, 0.3, 0.38)).toFixed(4));
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
    measureGeometry();
    tick();
    /* FixedScale commits its cover-fit scale in a state update that
       lands after this effect, so the first measurement sees the phone
       screen unscaled — re-measure once that render has flushed, and
       once more after fonts/layout settle */
    const remeasure = () => {
      measureGeometry();
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
        <StaticLanding metrics={metrics} />
      </main>
    );
  }

  const hiddenScene: CSSProperties = {
    opacity: 0,
    visibility: "hidden",
    transform: "translateY(90px) scale(0.95)",
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

          {/* the flying rankings card: identical component to the one
              inside the phone; it takes over at the exact same pixels,
              flies to the slide-2 slot and unfolds mid-flight */}
          <div
            ref={overlayRef}
            className="pointer-events-none absolute left-0 top-0 z-[27] origin-top-left"
            style={{ visibility: "hidden", opacity: 0 }}
          >
            <RankCard metrics={metrics} />
          </div>

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
                <CinematicPhone metrics={metrics} frameRef={frameRef} dimRef={dimRef} />
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
              style={i === 0 ? { opacity: 0, visibility: "hidden" } : hiddenScene}
            >
              <SceneCopy copy={copy} />
              {i === 0 ? (
                /* slide 2's panel is the flying card itself — this slot
                   only reserves its landing rect in the layout */
                <div
                  ref={slotRef}
                  aria-hidden
                  style={{ width: "min(900px, 90vw)", aspectRatio: "900 / 470" }}
                />
              ) : (
                <PanelFrame>
                  <FixedScale w={1280} h={756}>
                    {screens[i]}
                  </FixedScale>
                </PanelFrame>
              )}
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
