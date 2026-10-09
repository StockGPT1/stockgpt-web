"use client";

import Link from "next/link";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import {
  InsideEngineSequence,
  type InsideEngineSequenceHandle,
} from "./InsideEngineSequence";
import {
  ChatScreen,
  FixedScale,
  NewsScreen,
  PortfolioScreen,
  RankingsScreen,
  type LandingMetrics,
} from "./ScrollLandingScreens";

type ProductSurface = "rankings" | "portfolio" | "news" | "analysis";
type SceneSide = "center" | "left" | "right";

export type InsideEngineScene = {
  id: string;
  label: string;
  lines: string[];
  start: number;
  enterEnd: number;
  exitStart: number;
  end: number;
  copySide: SceneSide;
  product?: ProductSurface;
  final?: boolean;
};

/**
 * The single source of truth for narrative copy and scroll timing. Adjacent
 * windows overlap slightly so the HTML layers crossfade cleanly in either
 * scroll direction while the underlying frame sequence remains continuous.
 */
export const INSIDE_ENGINE_SCENES: readonly InsideEngineScene[] = [
  {
    id: "noise",
    label: "The noise",
    lines: ["The market gives you information.", "Too much of it."],
    start: 0.015,
    enterEnd: 0.045,
    exitStart: 0.135,
    end: 0.17,
    copySide: "center",
  },
  {
    id: "rankings",
    label: "Ranking engine",
    lines: ["500+ companies.", "One place to start."],
    start: 0.145,
    enterEnd: 0.18,
    exitStart: 0.295,
    end: 0.335,
    copySide: "left",
    product: "rankings",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    lines: [
      "Ideas are easy.",
      "Structure is harder.",
      "Build a Portfolio Draft around your risk.",
    ],
    start: 0.31,
    enterEnd: 0.35,
    exitStart: 0.46,
    end: 0.505,
    copySide: "right",
    product: "portfolio",
  },
  {
    id: "world-news",
    label: "World news",
    lines: [
      "News isn't separate from your portfolio.",
      "Everything is connected.",
    ],
    start: 0.475,
    enterEnd: 0.515,
    exitStart: 0.625,
    end: 0.67,
    copySide: "right",
    product: "news",
  },
  {
    id: "analytical-core",
    label: "Analytical core",
    lines: ["Why is this ranked #12?"],
    start: 0.64,
    enterEnd: 0.685,
    exitStart: 0.795,
    end: 0.845,
    copySide: "right",
    product: "analysis",
  },
  {
    id: "final-reveal",
    label: "Inside the engine",
    lines: ["Research before you react.", "Rank. Research. Build. Monitor."],
    start: 0.815,
    enterEnd: 0.87,
    exitStart: 1,
    end: 1,
    copySide: "left",
    final: true,
  },
] as const;

export type InsideEngineExperienceHandle = {
  setProgress: (progress: number) => void;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function segment(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOut(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function ProductPanel({
  product,
  metrics,
}: {
  product: ProductSurface;
  metrics: LandingMetrics;
}) {
  let surface: ReactNode;

  if (product === "rankings") surface = <RankingsScreen metrics={metrics} />;
  else if (product === "portfolio") surface = <PortfolioScreen />;
  else if (product === "news") surface = <NewsScreen />;
  else surface = <ChatScreen />;

  return (
    <div
      aria-hidden="true"
      className="ie-product-shell relative w-full overflow-hidden rounded-[26px] border border-[#ddb159]/25 bg-[#020806]/72 p-1.5 shadow-[0_32px_110px_rgba(0,0,0,0.78),0_0_70px_rgba(221,177,89,0.12)] backdrop-blur-xl"
    >
      <div className="pointer-events-none relative aspect-[1280/756] overflow-hidden rounded-[21px] bg-[#04120b]">
        <FixedScale w={1280} h={756}>
          {surface}
        </FixedScale>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_24%,transparent_76%,rgba(221,177,89,0.06))]" />
    </div>
  );
}

function NarrativeCopy({ scene }: { scene: InsideEngineScene }) {
  return (
    <div
      className={`relative z-10 max-w-[610px] ${
        scene.copySide === "center" ? "mx-auto text-center" : "text-left"
      }`}
    >
      <p className="sl-mono inline-flex rounded-full border border-[#ddb159]/25 bg-black/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-[#f4d78a] backdrop-blur-md lg:text-[10px]">
        Inside the engine&nbsp;&nbsp;/&nbsp;&nbsp;{scene.label}
      </p>
      <h2 className="mt-5 text-[clamp(34px,4.7vw,72px)] font-black leading-[0.98] tracking-[-0.045em] text-white [text-shadow:0_8px_42px_rgba(0,0,0,0.9)]">
        {scene.lines.map((line, index) => (
          <span
            key={line}
            className={`block ${
              index === scene.lines.length - 1 ? "text-[#f1cf78]" : ""
            } ${scene.lines.length === 3 && index === 2 ? "mt-5 text-[0.48em] leading-[1.25] tracking-[-0.02em]" : ""}`}
          >
            {line}
          </span>
        ))}
      </h2>

      {scene.final ? (
        <div
          className={`mt-8 flex flex-wrap gap-3 ${
            scene.copySide === "center" ? "justify-center" : "justify-start"
          }`}
        >
          <Link
            href="/signup"
            className="pointer-events-auto inline-flex h-12 items-center justify-center rounded-full border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a,#ddb159_55%,#c99a3e)] px-7 text-[11px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline shadow-[0_12px_45px_rgba(221,177,89,0.3)] focus:outline-none focus:ring-2 focus:ring-[#f4d78a] focus:ring-offset-2 focus:ring-offset-black"
          >
            Start free
          </Link>
          <Link
            href="#how-it-works"
            className="pointer-events-auto inline-flex h-12 items-center justify-center rounded-full border border-white/25 bg-black/40 px-7 text-[11px] font-black uppercase tracking-[0.16em] !text-white no-underline backdrop-blur-md hover:border-[#ddb159]/60 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-black"
          >
            See how it works
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export const InsideEngineExperience = forwardRef<
  InsideEngineExperienceHandle,
  { metrics: LandingMetrics; className?: string }
>(function InsideEngineExperience({ metrics, className = "" }, forwardedRef) {
  const sequenceRef = useRef<InsideEngineSequenceHandle | null>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const cueRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(
    forwardedRef,
    () => ({
      setProgress(value: number) {
        const progress = clamp01(value);
        sequenceRef.current?.setProgress(progress);

        const cue = cueRef.current;
        if (cue) cue.style.opacity = String(1 - easeOut(segment(progress, 0.01, 0.075)));

        INSIDE_ENGINE_SCENES.forEach((scene, index) => {
          const element = sceneRefs.current[index];
          if (!element) return;

          const entering = easeOut(segment(progress, scene.start, scene.enterEnd));
          const leaving = scene.final
            ? 0
            : easeInOut(segment(progress, scene.exitStart, scene.end));
          const opacity = entering * (1 - leaving);
          const direction = scene.copySide === "right" ? 1 : scene.copySide === "left" ? -1 : 0;
          const x = (1 - entering) * direction * 34 + leaving * direction * -24;
          const y = (1 - entering) * 24 - leaving * 18;
          const scale = 0.975 + entering * 0.025 + leaving * 0.02;

          element.style.opacity = opacity.toFixed(4);
          element.style.visibility = opacity > 0.002 ? "visible" : "hidden";
          element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
          element.style.pointerEvents = scene.final && opacity > 0.5 ? "auto" : "none";
        });
      },
    }),
    [],
  );

  return (
    <div className={`absolute inset-0 bg-[#020806] ${className}`}>
      <InsideEngineSequence ref={sequenceRef} className="absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.36),transparent_24%,transparent_70%,rgba(0,0,0,0.52))]"
      />

      <div className="absolute inset-0 z-10">
        {INSIDE_ENGINE_SCENES.map((scene, index) => {
          const centered = scene.copySide === "center";
          const copyOnRight = scene.copySide === "right";

          return (
            <section
              key={scene.id}
              ref={(element) => {
                sceneRefs.current[index] = element;
              }}
              aria-label={scene.label}
              className="absolute inset-0 flex items-center px-[5vw] pb-[5vh] pt-[12vh] will-change-[transform,opacity]"
              style={{ opacity: 0, visibility: "hidden", pointerEvents: "none" }}
            >
              {centered ? (
                <div className="mx-auto w-full max-w-5xl">
                  <NarrativeCopy scene={scene} />
                </div>
              ) : (
                <div className="grid w-full grid-cols-2 items-center gap-[4vw]">
                  <div className={copyOnRight ? "order-2" : "order-1"}>
                    <NarrativeCopy scene={scene} />
                  </div>
                  <div
                    className={`${copyOnRight ? "order-1" : "order-2"} mx-auto w-full max-w-[700px]`}
                  >
                    {scene.product ? (
                      <ProductPanel product={scene.product} metrics={metrics} />
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div
        ref={cueRef}
        className="pointer-events-none absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="sl-mono text-[9px] font-black uppercase tracking-[0.38em] text-white/60">
          Scroll
        </span>
        <span className="sl-cue-anim flex h-9 w-[22px] items-start justify-center rounded-full border border-white/35 pt-1.5">
          <span className="h-2 w-[3px] rounded-full bg-[#ddb159]" />
        </span>
      </div>
    </div>
  );
});
