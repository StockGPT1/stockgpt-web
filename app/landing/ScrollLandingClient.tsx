"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { LandingMetrics } from "./ScrollLandingScreens";
import { LandingBelowFold, SOCIALS, SocialIconLink } from "./LandingSections";
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

/* The original hero-and-features timeline occupied the whole track;
   two extra movements (manifesto, stats wall) now live in the final
   2/9, so every original anchor is compressed by Z to keep its
   absolute scroll distance identical. */
const Z = 7 / 9;

const STRAIGHTEN = { a: 0.03 * Z, b: 0.14 * Z };
/* the invisible cut: the phone's "Top ranked" card undocks and flies
   to its slide-2 slot (MORPH) while its own layout unfolds from the
   compact mobile card into the desktop table (UNFOLD). The card is the
   same component in both worlds, so no surface ever swaps on screen. */
const MORPH = { a: 0.14 * Z, b: 0.33 * Z };
const UNFOLD = { a: 0.17 * Z, b: 0.33 * Z };

const SCENES: { a: number; b: number; final?: boolean; pixel?: boolean }[] = [
  /* scene 1 fades in around the landing dot-letter — no slide, no
     scale, so the measured letter target stays put */
  { a: 0.29 * Z, b: 0.46 * Z, pixel: true },
  { a: 0.46 * Z, b: 0.62 * Z },
  { a: 0.62 * Z, b: 0.78 * Z },
  { a: 0.78 * Z, b: 0.7 },
  /* the new movements */
  { a: 0.7, b: 0.79 },
  { a: 0.79, b: 0.88 },
  { a: 0.88, b: 1.0, final: true },
];


function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function seg(p: number, a: number, b: number) {
  return clamp01((p - a) / (b - a));
}
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type SceneLayout = "center" | "left" | "right";

type SceneCopyDef = {
  index: string;
  eyebrow: string;
  title: ReactNode;
  body: string;
  chips: string[];
  /* giant outlined verb scrubbed behind the scene */
  word: string;
  /* lg+ composition: centered stack, or copy beside the panel */
  layout: SceneLayout;
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
    word: "RANKED",
    layout: "center",
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
    word: "BUILT",
    layout: "left",
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
    word: "MAPPED",
    layout: "right",
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
    word: "ANSWERED",
    layout: "left",
  },
];

/* count-up stats for the dedicated stats movement, scrubbed by scroll */
const STATS: { value: number; suffix: string; label: string }[] = [
  { value: 500, suffix: "+", label: "US stocks scored" },
  { value: 6, suffix: "", label: "model factors" },
  { value: 365, suffix: "", label: "runs a year" },
];

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                  */
/* ------------------------------------------------------------------ */

/* Magnetic CTA: the button leans toward the cursor while hovered and
   springs home on leave. Pure transform on a CSS var, so it composes
   with the sheen and never fights the scroll engine. */
function GoldButton({
  href,
  children,
  ghost = false,
}: {
  href: string;
  children: ReactNode;
  ghost?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  const onMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    el.style.setProperty("--magx", `${(dx * 0.22).toFixed(1)}px`);
    el.style.setProperty("--magy", `${(dy * 0.3).toFixed(1)}px`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--magx", "0px");
    el.style.setProperty("--magy", "0px");
  };

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={[
        "fx-sheen sl-magnet inline-flex h-12 items-center justify-center rounded-full px-7 text-[12px] font-black uppercase tracking-[0.16em] no-underline focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black",
        ghost
          ? "border border-white/25 bg-white/[0.04] !text-white hover:bg-white/[0.09]"
          : "border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a_0%,#ddb159_55%,#c99a3e_100%)] !text-[#071b11] shadow-[0_10px_40px_rgba(221,177,89,0.35)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

/* Vertical rail pinned to the left edge on desktop — present through
   the whole scroll story, mirroring the progress dots on the right. */
function SocialRail() {
  return (
    <div className="absolute left-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex">
      <span className="sl-mono mb-1 text-[8.5px] font-black uppercase tracking-[0.3em] text-white/30 [writing-mode:vertical-rl]">
        Follow
      </span>
      {SOCIALS.map((social) => (
        <SocialIconLink key={social.href} social={social} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kinetic outlined typography                                        */
/* ------------------------------------------------------------------ */

/* An endless row of giant stroke-outlined words drifting sideways.
   `size` tunes the type scale, `speed` the loop duration, `reverse`
   the direction — the same primitive dresses the hero, the finale and
   anything in between. */
function OutlineRow({
  word,
  size = "lg",
  speed = 60,
  reverse = false,
  solid = false,
  className = "",
}: {
  word: string;
  size?: "sm" | "md" | "lg";
  speed?: number;
  reverse?: boolean;
  solid?: boolean;
  className?: string;
}) {
  const run = (half: string) =>
    Array.from({ length: 6 }, (_, i) => (
      <span
        key={`${half}${i}`}
        className={`${solid ? "sl-outline-solid" : "sl-outline"} sl-outline-${size} px-[0.35em]`}
      >
        {word}
      </span>
    ));
  return (
    <div
      aria-hidden="true"
      className={`sl-tape-track flex w-max ${reverse ? "sl-tape-rev" : ""} ${className}`}
      style={{ animationDuration: `${speed}s` }}
    >
      {run("a")}
      {run("b")}
    </div>
  );
}

/* Finale backdrop: three storeys of drifting outlined STOCKGPT. */
function OutlineMarquee() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 flex flex-col justify-center gap-3 overflow-hidden opacity-70"
    >
      <OutlineRow word="STOCKGPT" size="lg" speed={64} />
      <OutlineRow word="SCORED ◆ RANKED ◆" size="md" speed={46} reverse />
      <OutlineRow word="STOCKGPT" size="lg" speed={78} />
    </div>
  );
}

/* Per-scene kinetic backdrop: a giant outlined verb plus a ghost index
   numeral. Horizontal drift is scrubbed straight off the scene's --k,
   so the word slides in sync with the scroll — not on a clock. */
function SceneBackdrop({ word }: { word: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="sl-backdrop-word absolute top-[8%] flex w-max items-baseline gap-[0.4em] whitespace-nowrap"
      >
        <span className="sl-outline sl-outline-xl">{word}</span>
        <span className="sl-outline sl-outline-xl opacity-60">{word}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gold dust — slow particles rising through the stage                */
/* ------------------------------------------------------------------ */

function GoldDust() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="sl-dust" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preloader — count-up + letter scramble, once per session           */
/* ------------------------------------------------------------------ */

const SCRAMBLE_CHARS = "◆▲$%#01STOCKGPT";

function Preloader() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const wordRef = useRef<HTMLSpanElement | null>(null);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (window.sessionStorage.getItem("sl-preloaded") === "1") {
      /* repeat visit this session: hide instantly, unmount next tick */
      root.style.display = "none";
      const skip = window.setTimeout(() => setMounted(false), 0);
      return () => window.clearTimeout(skip);
    }

    const started = performance.now();
    const DURATION = 1400;
    const FINAL = "STOCKGPT";
    let raf = 0;
    let hideTimer = 0;

    const frame = (now: number) => {
      const t = clamp01((now - started) / DURATION);
      const pct = pctRef.current;
      const word = wordRef.current;
      if (pct) pct.textContent = String(Math.round(t * 100)).padStart(3, "0");
      if (word) {
        /* letters lock in left-to-right as the counter climbs */
        const settled = Math.floor(t * (FINAL.length + 2));
        word.textContent = FINAL.split("")
          .map((letter, i) =>
            i < settled
              ? letter
              : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
          )
          .join("");
      }
      if (t < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      window.sessionStorage.setItem("sl-preloaded", "1");
      root.classList.add("sl-preloader-out");
      hideTimer = window.setTimeout(() => setMounted(false), 700);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={rootRef}
      className="sl-preloader fixed inset-0 z-[140] flex flex-col items-center justify-center bg-[#020806]"
      aria-hidden="true"
    >
      <span
        ref={wordRef}
        className="sl-mono text-[clamp(28px,6vw,64px)] font-black tracking-[0.18em] text-white"
      >
        ◆◆◆◆◆◆◆◆
      </span>
      <div className="mt-6 flex items-center gap-4">
        <span className="h-px w-16 bg-[#ddb159]/40" />
        <span ref={pctRef} className="sl-mono text-[13px] font-black tracking-[0.3em] text-[#ddb159]">
          000
        </span>
        <span className="h-px w-16 bg-[#ddb159]/40" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom cursor — a single gold dot (fine pointers only)             */
/* ------------------------------------------------------------------ */

function LandingCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    if (!dot) return;

    document.body.classList.add("sl-cursor-on");
    let seen = false;

    const onMove = (event: PointerEvent) => {
      if (!seen) {
        seen = true;
        dot.style.opacity = "1";
      }
      dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      const target = event.target as Element | null;
      dot.dataset.hover = target?.closest?.("a, button, select, [data-cursor]") ? "1" : "0";
    };
    const onLeave = () => {
      seen = false;
      dot.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.body.classList.remove("sl-cursor-on");
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={dotRef} className="sl-cur-dot" style={{ opacity: 0 }} data-hover="0">
      <span className="sl-cur-dot-core" />
    </div>
  );
}

function SceneCopy({ copy, side = false }: { copy: SceneCopyDef; side?: boolean }) {
  return (
    <div
      className={
        side
          ? "w-full max-w-3xl px-6 text-center lg:max-w-none lg:px-0 lg:text-left"
          : "mx-auto w-full max-w-3xl px-6 text-center"
      }
    >
      <p className="sl-e0 sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
        {copy.eyebrow}
      </p>
      <h2
        className={`sl-e1 mt-3 font-black leading-[1.02] tracking-[-0.04em] text-white ${
          side ? "text-[clamp(26px,4.6vw,58px)]" : "text-[clamp(26px,4.6vw,52px)]"
        }`}
      >
        {copy.title}
      </h2>
      <p
        className={`sl-e2 mt-4 max-w-2xl text-[clamp(12.5px,1.25vw,16px)] font-medium leading-relaxed text-white/55 ${
          side ? "mx-auto lg:mx-0 lg:max-w-[34rem]" : "mx-auto"
        }`}
      >
        {copy.body}
      </p>
      <div
        className={`sl-e3 mt-4 flex flex-wrap items-center gap-2 ${
          side ? "justify-center lg:justify-start" : "justify-center"
        }`}
      >
        {copy.chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/60 sm:px-3.5 sm:py-1.5 sm:text-[10.5px] sm:tracking-[0.12em]"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function PanelFrame({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className="overflow-hidden rounded-3xl border border-white/12 bg-[#04120b]"
      style={{
        width: compact ? "min(100%, 900px, 118vh)" : "min(1220px, 94vw, 112vh)",
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
          className="relative h-9 w-[112px] focus:outline-none focus:ring-2 focus:ring-[#ddb159] sm:h-11 sm:w-[160px]"
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
          {/* same pair as desktop, compacted to fit a phone header */}
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-full border border-white/20 bg-black/30 px-3.5 text-[10px] font-black uppercase tracking-[0.12em] !text-white no-underline backdrop-blur-md transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:h-11 sm:px-6 sm:text-[11px] sm:tracking-[0.16em]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="fx-sheen inline-flex h-10 items-center rounded-full border border-[#ddb159] bg-[#ddb159] px-3.5 text-[10px] font-black uppercase tracking-[0.12em] !text-[#071b11] no-underline transition-colors hover:bg-[#e8c36b] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black sm:h-11 sm:px-6 sm:text-[11px] sm:tracking-[0.16em]"
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

      <section className="px-4 py-20">
        <ManifestoContent />
      </section>
      <section className="px-4 py-20">
        <StatsContent />
      </section>

      <FinaleContent />
      <LandingBelowFold />
    </div>
  );
}

/* Movement 5 — the engine room: what the model actually measures.
   A spec sheet dressed as cinema; the six factors with live-looking
   meter bars and a terminal readout underneath. */
const ENGINE_FACTORS: { code: string; name: string; body: string; meter: number }[] = [
  { code: "QLT", name: "Quality", body: "Balance-sheet strength and durable profitability", meter: 86 },
  { code: "GRW", name: "Growth", body: "Revenue and earnings trajectory, not stories", meter: 74 },
  { code: "VAL", name: "Value", body: "Price against sector-adjusted fundamentals", meter: 63 },
  { code: "MOM", name: "Momentum", body: "Trend strength measured against the market", meter: 91 },
  { code: "RSK", name: "Risk", body: "Volatility and drawdown behaviour, penalised", meter: 57 },
  { code: "INC", name: "Income", body: "Dividend yield and how reliably it is paid", meter: 68 },
];

function ManifestoContent() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center">
      <p className="sl-e0 sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
        Under the hood
      </p>
      <h2 className="sl-e1 mt-3 text-[clamp(30px,5vw,58px)] font-black leading-[1.02] tracking-[-0.045em] text-white">
        One model. Six lenses. <span className="sl-gold">Zero guesswork.</span>
      </h2>

      <div className="sl-e2 mx-auto mt-[4vh] grid max-w-4xl grid-cols-2 gap-2.5 text-left lg:grid-cols-3">
        {ENGINE_FACTORS.map((factor) => (
          <div
            key={factor.code}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="sl-mono text-[10px] font-black tracking-[0.2em] text-[#ddb159]">
                {factor.code}
              </span>
              <span className="text-[12.5px] font-black text-white">{factor.name}</span>
            </div>
            <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#b88a32,#f4d78a)]"
                style={{ width: `${factor.meter}%` }}
              />
            </div>
            <p className="mt-2.5 hidden text-[10.5px] font-medium leading-relaxed text-white/48 sm:block">
              {factor.body}
            </p>
          </div>
        ))}
      </div>

      <p className="sl-e3 sl-mono mx-auto mt-[3.5vh] flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-white/38">
        <span>Universe · 500+ US equities</span>
        <span className="text-[#ddb159]/60">◆</span>
        <span>Cadence · every market day</span>
        <span className="text-[#ddb159]/60">◆</span>
        <span>Scored · sector-relative</span>
        <span className="text-[#ddb159]/60">◆</span>
        <span>Output · one number per stock</span>
      </p>
    </div>
  );
}

/* Movement 6 — the stats wall: three giant numbers counting up. */
function StatsContent({
  statRefs,
}: {
  statRefs?: React.MutableRefObject<(HTMLSpanElement | null)[]>;
}) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 text-center">
      <p className="sl-e0 sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
        The receipts
      </p>
      <div className="mt-[4vh] grid grid-cols-1 gap-[4.5vh] sm:grid-cols-3 sm:gap-6">
        {STATS.map((stat, i) => (
          <div key={stat.label} className={i === 0 ? "sl-e1" : i === 1 ? "sl-e2" : "sl-e3"}>
            <span
              ref={
                statRefs
                  ? (el) => {
                      statRefs.current[i] = el;
                    }
                  : undefined
              }
              className="sl-mono block text-[clamp(56px,9vw,148px)] font-black leading-none text-[#ddb159]"
              style={{ textShadow: "0 0 60px rgba(221,177,89,0.35)" }}
            >
              {statRefs ? "0" : `${stat.value}${stat.suffix}`}
            </span>
            <span className="mt-3 block text-[10.5px] font-black uppercase tracking-[0.22em] text-white/42">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
      <p className="sl-e3 mx-auto mt-[5vh] max-w-xl text-[clamp(12px,1.15vw,15px)] font-medium leading-relaxed text-white/45">
        Scored every market day. No cherry-picking, no backfilled wins — the model&apos;s
        output is the product.
      </p>
    </div>
  );
}

function FinaleContent() {
  return (
    <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center">
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
      <div className="sl-e3 mt-10 flex items-center justify-center gap-3">
        {SOCIALS.map((social) => (
          <SocialIconLink key={social.href} social={social} />
        ))}
      </div>
      <div className="sl-e3 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-white/40">
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
  const heroOutlineRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const statRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
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
      /* the story spans the sticky track only — the sections after it
         extend scrollHeight and must not dilute the timeline */
      const trackEl = trackRef.current;
      const max = (trackEl ? trackEl.offsetHeight : scroller.scrollHeight) - scroller.clientHeight;
      target = max > 0 ? clamp01(scroller.scrollTop / max) : 0;
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
      const heroOut = seg(p, 0.03 * Z, 0.1 * Z);
      const title = heroTitleRef.current;
      if (title) {
        title.style.opacity = String(1 - easeOut(heroOut));
        title.style.transform = `translateY(${heroOut * -70}px) scale(${1 + heroOut * 0.05})`;
        title.style.visibility = heroOut >= 1 ? "hidden" : "visible";
      }
      const cue = cueRef.current;
      if (cue) cue.style.opacity = String(1 - seg(p, 0.004, 0.025));

      /* hero backdrop type leaves with the title */
      const heroOutline = heroOutlineRef.current;
      if (heroOutline) {
        const o = (1 - seg(p, 0.008, 0.055)) * 0.85;
        heroOutline.style.opacity = String(o);
        heroOutline.style.visibility = o <= 0 ? "hidden" : "visible";
      }

      /* finale stats count up as the CTA arrives */
      const ft = easeOut(seg(p, 0.795, 0.865));
      statRefs.current.forEach((el, i) => {
        if (!el) return;
        const stat = STATS[i];
        if (!stat) return;
        const value = `${Math.round(stat.value * ft)}${ft >= 1 ? stat.suffix : ""}`;
        if (el.textContent !== value) el.textContent = value;
      });

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
        const on = p >= MORPH.a && p < 0.475 * Z;
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
        const o = 1 - seg(p, 0.27 * Z, 0.315 * Z);
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
          const o = seg(p, 0.27 * Z, 0.31 * Z) * (1 - tout);
          el.style.opacity = String(o);
          el.style.visibility = o < 0.003 ? "hidden" : "visible";
          el.style.transform = tout > 0 ? `scale(${1 + tout * 0.13})` : "none";
          el.style.filter = tout > 0.01 ? `blur(${tout * 6}px)` : "none";
          el.style.setProperty("--k", easeOut(seg(p, 0.3 * Z, 0.38 * Z)).toFixed(4));
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
    };

    const tick = () => {
      if (!running) return;
      if (current < 0) current = target;
      const diff = target - current;
      /* 0.24/frame: catches the wheel quickly while still smoothing
         out discrete scroll steps (0.15 felt a beat behind the hand) */
      current = Math.abs(diff) < 0.00035 ? target : current + diff * 0.24;
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

    @keyframes slCue {
      0%, 100% { transform: translateY(0); opacity: 0.9; }
      50% { transform: translateY(9px); opacity: 0.4; }
    }
    .sl-cue-anim { animation: slCue 1.8s ease-in-out infinite; }
    @keyframes slCaret { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
    .sl-caret { animation: slCaret 1s steps(1) infinite; }
    @keyframes slPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .sl-pulse { animation: slPulse 1.6s ease-in-out infinite; }

    /* magnetic CTAs — transform lives on CSS vars so hover scale,
       cursor pull and spring-back all compose */
    .sl-magnet {
      transform: translate3d(var(--magx, 0px), var(--magy, 0px), 0) scale(var(--mags, 1));
      transition: transform 320ms cubic-bezier(0.22, 1.4, 0.36, 1);
    }
    .sl-magnet:hover { --mags: 1.04; }

    /* endless drifting type */
    @keyframes slTape { to { transform: translate3d(-50%, 0, 0); } }
    .sl-tape-track { animation: slTape 60s linear infinite; will-change: transform; }
    .sl-tape-rev { animation-direction: reverse; }

    /* giant outlined type, in four scales */
    .sl-outline, .sl-outline-solid {
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.04em;
      white-space: nowrap;
    }
    .sl-outline {
      color: transparent;
      -webkit-text-stroke: 1.5px rgba(221, 177, 89, 0.15);
    }
    .sl-outline-solid { color: rgba(221, 177, 89, 0.07); }
    .sl-stroke-white {
      color: transparent;
      -webkit-text-stroke: 2px rgba(255, 255, 255, 0.4);
    }
    .sl-outline-sm { font-size: clamp(40px, 7vw, 100px); }
    .sl-outline-md { font-size: clamp(60px, 10vw, 150px); }
    .sl-outline-lg { font-size: clamp(90px, 17vw, 240px); }
    .sl-outline-xl { font-size: clamp(120px, 24vw, 340px); }

    /* scene backdrop word: drift is scrubbed from the scene's --k, so
       the type physically rides the scroll */
    .sl-backdrop-word {
      left: 0;
      opacity: 0.55;
      transform: translate3d(calc(-12vw - (1 - var(--k, 1)) * 34vw), 0, 0);
      will-change: transform;
    }

    /* gold dust drifting up through the stage */
    @keyframes slDust {
      0% { transform: translate3d(0, 12vh, 0) scale(0.6); opacity: 0; }
      12% { opacity: var(--dust-o, 0.5); }
      88% { opacity: var(--dust-o, 0.5); }
      100% { transform: translate3d(var(--dust-dx, 3vw), -108vh, 0) scale(1.1); opacity: 0; }
    }
    .sl-dust {
      position: absolute;
      bottom: 0;
      width: 3px;
      height: 3px;
      border-radius: 999px;
      background: #f4d78a;
      box-shadow: 0 0 8px rgba(221, 177, 89, 0.8);
      animation: slDust var(--dust-t, 16s) linear infinite;
      animation-delay: var(--dust-d, 0s);
      opacity: 0;
    }
    .sl-dust:nth-child(1)  { left: 6%;  --dust-t: 15s; --dust-d: -2s;  --dust-o: 0.4; --dust-dx: 2vw; }
    .sl-dust:nth-child(2)  { left: 14%; --dust-t: 21s; --dust-d: -9s;  --dust-o: 0.28; --dust-dx: -3vw; }
    .sl-dust:nth-child(3)  { left: 22%; --dust-t: 17s; --dust-d: -5s;  --dust-o: 0.5; --dust-dx: 4vw; }
    .sl-dust:nth-child(4)  { left: 31%; --dust-t: 24s; --dust-d: -14s; --dust-o: 0.22; --dust-dx: -2vw; }
    .sl-dust:nth-child(5)  { left: 38%; --dust-t: 14s; --dust-d: -7s;  --dust-o: 0.45; --dust-dx: 3vw; }
    .sl-dust:nth-child(6)  { left: 46%; --dust-t: 19s; --dust-d: -11s; --dust-o: 0.3; --dust-dx: -4vw; }
    .sl-dust:nth-child(7)  { left: 53%; --dust-t: 23s; --dust-d: -3s;  --dust-o: 0.26; --dust-dx: 2vw; }
    .sl-dust:nth-child(8)  { left: 61%; --dust-t: 16s; --dust-d: -12s; --dust-o: 0.5; --dust-dx: -3vw; }
    .sl-dust:nth-child(9)  { left: 68%; --dust-t: 20s; --dust-d: -6s;  --dust-o: 0.34; --dust-dx: 4vw; }
    .sl-dust:nth-child(10) { left: 75%; --dust-t: 15s; --dust-d: -10s; --dust-o: 0.42; --dust-dx: -2vw; }
    .sl-dust:nth-child(11) { left: 82%; --dust-t: 25s; --dust-d: -4s;  --dust-o: 0.2; --dust-dx: 3vw; }
    .sl-dust:nth-child(12) { left: 88%; --dust-t: 18s; --dust-d: -13s; --dust-o: 0.38; --dust-dx: -4vw; }
    .sl-dust:nth-child(13) { left: 94%; --dust-t: 22s; --dust-d: -8s;  --dust-o: 0.3; --dust-dx: 2vw; }
    .sl-dust:nth-child(14) { left: 3%;  --dust-t: 26s; --dust-d: -16s; --dust-o: 0.24; --dust-dx: 3vw; }

    /* preloader */
    .sl-preloader { transition: transform 650ms cubic-bezier(0.7, 0, 0.2, 1); }
    .sl-preloader-out { transform: translateY(-100%); }

    /* per-letter hero entrance (plays once on load) */
    @keyframes slLetter {
      from { opacity: 0; transform: translateY(46px) rotate(5deg); }
      to { opacity: 1; transform: none; }
    }
    .sl-letter { animation: slLetter 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }

    /* aurora drift behind everything */
    @keyframes slAurora {
      0% { transform: rotate(0deg) scale(1.35); }
      50% { transform: rotate(180deg) scale(1.5); }
      100% { transform: rotate(360deg) scale(1.35); }
    }
    .sl-aurora {
      background: conic-gradient(
        from 90deg at 50% 50%,
        transparent 0deg,
        rgba(221, 177, 89, 0.05) 70deg,
        transparent 140deg,
        rgba(16, 185, 129, 0.045) 220deg,
        transparent 300deg,
        rgba(221, 177, 89, 0.04) 340deg,
        transparent 360deg
      );
      filter: blur(48px);
      animation: slAurora 46s linear infinite;
      will-change: transform;
    }

    /* mouse-parallax spotlight (vars set on the stage) */
    .sl-parallax {
      transform: translate3d(calc(var(--mx, 0) * 28px), calc(var(--my, 0) * 18px), 0);
      transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    /* custom cursor: a single gold dot that grows over interactives
       (fine pointers; class applied only when active) */
    .sl-cursor-on .sl-root, .sl-cursor-on .sl-root * { cursor: none !important; }
    /* the outer element only translates; the inner core scales. Mixing
       the standalone scale property with the transform translate would
       multiply the translation and teleport the dot on hover. */
    .sl-cur-dot {
      position: fixed; left: -4px; top: -4px; z-index: 120;
      pointer-events: none;
      transition: opacity 200ms ease;
    }
    .sl-cur-dot-core {
      display: block; width: 9px; height: 9px; border-radius: 999px;
      background: #f4d78a; box-shadow: 0 0 16px rgba(221, 177, 89, 0.9);
      transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sl-cur-dot[data-hover="1"] .sl-cur-dot-core { transform: scale(2.6); }

    @media (prefers-reduced-motion: reduce) {
      .sl-cue-anim, .sl-caret, .sl-pulse, .sl-tape-track, .sl-letter, .sl-aurora, .sl-dust { animation: none !important; }
      .sl-magnet, .sl-parallax { transform: none !important; transition: none !important; }
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

  /* mouse parallax: normalised cursor position feeds the spotlight
     (and nothing the scroll engine writes to) via CSS vars */
  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage || event.pointerType !== "mouse") return;
    stage.style.setProperty("--mx", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    stage.style.setProperty("--my", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };

  return (
    <main ref={scrollerRef} className="sl-root h-[100dvh] overflow-y-auto overflow-x-hidden">
      <style>{css}</style>
      <Preloader />
      <LandingCursor />
      <TopNav />

      {/* scroll track — the stage stays pinned while this scrolls */}
      <div ref={trackRef} className="h-[900vh]">
        <div
          ref={stageRef}
          onPointerMove={onStagePointerMove}
          className="sl-bg sticky top-0 h-[100dvh] overflow-hidden"
        >
          {/* atmosphere */}
          <div className="sl-aurora pointer-events-none absolute inset-[-20%]" />
          <GoldDust />
          <div className="sl-parallax pointer-events-none absolute inset-0">
            <div
              ref={glowRef}
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 46% 42% at 50% 6%, rgba(244,231,193,0.15), transparent 60%), radial-gradient(ellipse 30% 26% at 50% 30%, rgba(221,177,89,0.12), transparent 65%)",
              }}
            />
          </div>
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

          {/* hero backdrop: slow outlined drift behind the phone */}
          <div
            ref={heroOutlineRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[30%] z-[6] overflow-hidden opacity-85"
          >
            <OutlineRow word="STOCKGPT" size="lg" speed={90} />
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
              {/* per-letter entrance on load; scroll still owns the container */}
              {"StockGPT".split("").map((letter, i) => (
                <span
                  key={i}
                  className="sl-letter inline-block"
                  style={{ animationDelay: `${0.08 + i * 0.055}s` }}
                >
                  {letter}
                </span>
              ))}
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

          {/* feature scenes — each with its own composition. Scene 0
              keeps the exact centered stack the card-morph geometry is
              measured against; the others alternate copy/panel sides. */}
          {SCENE_COPY.map((copy, i) => {
            const split = i !== 0 && copy.layout !== "center";
            const containerClass =
              i === 0 || copy.layout === "center"
                ? "sl-scene absolute inset-0 z-20 flex flex-col items-center justify-center gap-[3.2vh] pb-[2vh] pt-[10vh]"
                : copy.layout === "left"
                  ? "sl-scene absolute inset-0 z-20 flex flex-col items-center justify-center gap-[3.2vh] pb-[2vh] pt-[10vh] lg:grid lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-center lg:gap-[3vw] lg:px-[5vw] lg:pt-[9vh]"
                  : "sl-scene absolute inset-0 z-20 flex flex-col items-center justify-center gap-[3.2vh] pb-[2vh] pt-[10vh] lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-center lg:gap-[3vw] lg:px-[5vw] lg:pt-[9vh]";

            return (
              <div
                key={copy.index}
                ref={(el) => {
                  sceneRefs.current[i] = el;
                }}
                className={containerClass}
                style={i === 0 ? { opacity: 0, visibility: "hidden" } : hiddenScene}
              >
                <SceneBackdrop word={copy.word} />
                <div className={copy.layout === "right" ? "min-w-0 lg:order-2" : "min-w-0"}>
                  <SceneCopy copy={copy} side={split} />
                </div>
                {i === 0 ? (
                  /* slide 2's panel is the flying card itself — this slot
                     only reserves its landing rect in the layout */
                  <div
                    ref={slotRef}
                    aria-hidden
                    style={{ width: "min(900px, 90vw)", aspectRatio: "900 / 470" }}
                  />
                ) : (
                  <div
                    className={`flex w-full min-w-0 justify-center px-0 ${
                      copy.layout === "right" ? "lg:order-1" : ""
                    }`}
                  >
                    <PanelFrame compact={split}>
                      <FixedScale w={1280} h={756}>
                        {screens[i]}
                      </FixedScale>
                    </PanelFrame>
                  </div>
                )}
              </div>
            );
          })}

          {/* movement 5 — manifesto */}
          <div
            ref={(el) => {
              sceneRefs.current[4] = el;
            }}
            className="sl-scene absolute inset-0 z-20 flex items-center justify-center"
            style={hiddenScene}
          >
            <SceneBackdrop word="ENGINEERED" />
            <ManifestoContent />
          </div>

          {/* movement 6 — stats wall */}
          <div
            ref={(el) => {
              sceneRefs.current[5] = el;
            }}
            className="sl-scene absolute inset-0 z-20 flex items-center justify-center"
            style={hiddenScene}
          >
            <SceneBackdrop word="PROOF" />
            <StatsContent statRefs={statRefs} />
          </div>

          {/* finale */}
          <div
            ref={(el) => {
              sceneRefs.current[6] = el;
            }}
            className="sl-scene absolute inset-0 z-20 flex items-center justify-center"
            style={{ ...hiddenScene, pointerEvents: "none" }}
          >
            <OutlineMarquee />
            <FinaleContent />
            {/* giant cropped wordmark bleeding off the bottom edge */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -bottom-[7vw] z-0 whitespace-nowrap text-center"
            >
              <span className="text-[19vw] font-black leading-none tracking-[-0.06em] text-white/[0.045]">
                STOCKGPT
              </span>
            </div>
          </div>

          {/* socials rail */}
          <SocialRail />
        </div>
      </div>

      {/* Revolut-style below-the-fold: normal flow after the story */}
      <LandingBelowFold />
    </main>
  );
}
