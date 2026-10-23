"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const noiseTickers = [
  "AAPL",
  "NVDA",
  "MSFT",
  "META",
  "TSLA",
  "AMZN",
  "GOOGL",
  "AVGO",
  "JPM",
  "LLY",
  "V",
  "UNH",
  "COST",
  "NFLX",
  "AMD",
  "CRM",
  "ORCL",
  "PLTR",
  "ADBE",
  "MA",
  "XOM",
  "WMT",
  "NKE",
  "BAC",
];

const rankedIdeas = [
  { ticker: "NVDA", thesis: "AI infrastructure strength", score: "94" },
  { ticker: "MSFT", thesis: "Quality, cash flow, platform depth", score: "91" },
  { ticker: "AVGO", thesis: "Momentum plus semiconductor demand", score: "88" },
  { ticker: "COST", thesis: "Defensive growth profile", score: "84" },
];

const scenes = [
  {
    eyebrow: "Market noise",
    title: "Every ticker is shouting.",
    copy: "StockGPT starts with the messy part: price moves, headlines, momentum, risk and fundamentals competing for attention.",
  },
  {
    eyebrow: "Signal scan",
    title: "The noise gets pulled into one model.",
    copy: "The system scores quality, growth, value, momentum, income and risk so the market starts to become readable.",
  },
  {
    eyebrow: "Ranked clarity",
    title: "Stronger research ideas rise out of the chaos.",
    copy: "Instead of opening ten tabs, users get a ranked starting point for what looks stronger, weaker or worth researching next.",
  },
  {
    eyebrow: "StockGPT workflow",
    title: "Rank, research, ask follow-ups.",
    copy: "The ranked list connects into stock pages, news context and Ask StockGPT so users can understand the reasoning before making their own decisions.",
  },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function MarketNoiseScrolly() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const anchor =
      document.querySelector(
        '.sg-page-soft > section:first-of-type + div[class*="sm:grid-cols-4"] + div',
      ) ?? document.querySelector(".sg-page-soft > section:first-of-type");

    if (!anchor) return;

    const portalHost = document.createElement("div");
    portalHost.setAttribute("data-stockgpt-market-noise-scrolly", "true");
    anchor.insertAdjacentElement("afterend", portalHost);
    setHost(portalHost);

    return () => {
      portalHost.remove();
      setHost(null);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!host || reducedMotion) return;

    const scroller = document.querySelector(".sg-landing");
    const section = host.querySelector("[data-market-noise-section]");
    if (!scroller || !section) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollerRect = scroller.getBoundingClientRect();
      const rect = section.getBoundingClientRect();
      const travel = rect.height - scrollerRect.height;
      const next = travel > 0 ? clamp((scrollerRect.top - rect.top) / travel) : 0;
      setProgress(next);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [host, reducedMotion]);

  const activeScene = reducedMotion ? 2 : Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
  const signalProgress = reducedMotion ? 1 : clamp((progress - 0.15) / 0.58);
  const clarityProgress = reducedMotion ? 1 : clamp((progress - 0.42) / 0.44);
  const chaosOpacity = reducedMotion ? 0.2 : clamp(1 - progress * 1.55, 0.08, 1);
  const lensScale = 0.72 + signalProgress * 0.55;
  const stormScale = reducedMotion ? 0.92 : 1 + progress * 0.58;

  const tickerLayout = useMemo(
    () =>
      noiseTickers.map((ticker, index) => {
        const orbit = index % 4;
        return {
          ticker,
          left: 8 + ((index * 19) % 86),
          top: 9 + ((index * 31) % 78),
          size: orbit === 0 ? "text-[13px]" : orbit === 1 ? "text-[11px]" : "text-[10px]",
          opacity: 0.42 + orbit * 0.14,
          rotation: -18 + ((index * 23) % 36),
          x: -44 + ((index * 29) % 88),
          y: -34 + ((index * 41) % 68),
        };
      }),
    [],
  );

  const lightRays = useMemo(() => Array.from({ length: 18 }, (_, index) => index), []);

  if (!host) return null;

  return createPortal(
    <section
      data-market-noise-section
      className="relative left-1/2 block w-screen -translate-x-1/2"
      style={{ height: reducedMotion ? "auto" : "360vh" }}
      aria-label="From market noise to ranked stocks"
    >
      <div className="sticky top-0 min-h-screen overflow-hidden bg-[#030d08] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(221,177,89,0.20),transparent_22%),radial-gradient(circle_at_24%_24%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_82%_28%,rgba(221,177,89,0.14),transparent_30%),linear-gradient(180deg,#04180f_0%,#030d08_48%,#071b11_100%)]" />
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(221,177,89,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(221,177,89,0.045)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,13,8,0.88)_0%,transparent_28%,transparent_72%,rgba(3,13,8,0.88)_100%)]" />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="marketBeam" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(221,177,89,0)" />
              <stop offset="46%" stopColor="rgba(221,177,89,0.7)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0)" />
            </linearGradient>
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {lightRays.map((ray) => {
            const y = 110 + ray * 42;
            const bend = ray % 2 === 0 ? 110 : -110;
            return (
              <path
                key={ray}
                d={`M ${-120 + ray * 9} ${y} C 360 ${y + bend}, 620 ${450 - bend * 0.22}, 720 450 S 1040 ${y - bend}, 1560 ${y + 60}`}
                stroke="url(#marketBeam)"
                strokeWidth={ray % 3 === 0 ? 2.2 : 1.1}
                fill="none"
                filter="url(#softGlow)"
                opacity={0.06 + signalProgress * 0.34}
                style={{ transform: `translateY(${(0.5 - progress) * (ray - 8) * 10}px)` }}
              />
            );
          })}
        </svg>

        <div
          className="absolute inset-0 transition-transform duration-500"
          style={{ transform: `scale(${stormScale}) rotate(${progress * -2.8}deg)` }}
        >
          {tickerLayout.map((item) => {
            const convergeX = (50 - item.left) * signalProgress;
            const convergeY = (50 - item.top) * signalProgress;
            const releaseX = item.x * clarityProgress;
            const releaseY = item.y * clarityProgress;
            return (
              <span
                key={item.ticker}
                className={[
                  "sg-data absolute font-black text-white/80 drop-shadow-[0_0_18px_rgba(221,177,89,0.22)]",
                  item.size,
                ].join(" ")}
                style={{
                  left: `${item.left}%`,
                  top: `${item.top}%`,
                  opacity: Math.max(0.06, item.opacity * chaosOpacity),
                  transform: `translate(${convergeX + releaseX}vw, ${convergeY + releaseY}vh) rotate(${item.rotation + progress * 36}deg) scale(${1 - signalProgress * 0.36})`,
                }}
              >
                {item.ticker}
              </span>
            );
          })}
        </div>

        <div className="absolute left-1/2 top-1/2 h-[min(86vw,720px)] w-[min(86vw,720px)] -translate-x-1/2 -translate-y-1/2 sm:h-[min(68vw,720px)] sm:w-[min(68vw,720px)]">
          <div
            className="absolute inset-0 rounded-full border border-[#ddb159]/20 bg-[radial-gradient(circle,rgba(221,177,89,0.22)_0%,rgba(16,185,129,0.09)_38%,transparent_68%)] blur-[0.5px] transition-all duration-500"
            style={{ opacity: 0.16 + signalProgress * 0.55, transform: `scale(${lensScale})` }}
          />
          <div
            className="absolute inset-[11%] rounded-full border border-white/10 bg-[conic-gradient(from_180deg,rgba(221,177,89,0.06),rgba(16,185,129,0.22),rgba(221,177,89,0.22),rgba(255,255,255,0.04),rgba(221,177,89,0.06))] shadow-[0_0_80px_rgba(221,177,89,0.18)] transition-all duration-500"
            style={{ opacity: 0.3 + signalProgress * 0.48, transform: `rotate(${progress * 110}deg) scale(${0.78 + signalProgress * 0.2})` }}
          />
          <div
            className="absolute inset-[25%] rounded-full border border-[#ddb159]/32 bg-[#061b12]/70 shadow-[0_0_90px_rgba(221,177,89,0.22),inset_0_0_56px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500"
            style={{ opacity: 0.48 + signalProgress * 0.42, transform: `scale(${0.72 + signalProgress * 0.3})` }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div
              className="text-center transition-all duration-500"
              style={{ opacity: 0.34 + signalProgress * 0.66, transform: `translateY(${(1 - signalProgress) * 24}px) scale(${0.9 + signalProgress * 0.1})` }}
            >
              <p className="sg-data text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159] sm:text-[11px] sm:tracking-[0.32em]">
                StockGPT signal engine
              </p>
              <p className="sg-heading mt-3 text-[40px] font-medium leading-none text-white sm:text-7xl lg:text-8xl">
                Rank the market
              </p>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-8 pt-32 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full border border-[#ddb159]/24 bg-[#ddb159]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159] backdrop-blur-md">
                {scenes[activeScene]?.eyebrow}
              </p>
              <h2 className="sg-heading mt-5 text-[46px] font-medium leading-[0.9] tracking-[-0.055em] text-white sm:text-[82px] lg:text-[112px]">
                From noise to ranked stocks.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/68 sm:text-lg sm:leading-8">
                {scenes[activeScene]?.copy}
              </p>
            </div>

            <div
              className="relative min-h-[220px] w-full max-w-xl transition-all duration-500 sm:min-h-[260px] lg:min-h-[360px]"
              style={{ opacity: 0.14 + clarityProgress * 0.86, transform: `translateY(${(1 - clarityProgress) * 46}px)` }}
            >
              {rankedIdeas.map((idea, index) => (
                <div
                  key={idea.ticker}
                  className="absolute left-0 right-0 rounded-[1.4rem] border border-[#ddb159]/20 bg-white/[0.075] px-4 py-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:rounded-[1.65rem] sm:px-5 sm:py-4"
                  style={{
                    top: `${index * 66}px`,
                    transform: `translateX(${(1 - clarityProgress) * (index % 2 === 0 ? 72 : -72)}px) rotate(${(1 - clarityProgress) * (index % 2 === 0 ? -4 : 4)}deg)`,
                    opacity: clarityProgress > index * 0.08 ? 1 : 0.14,
                  }}
                >
                  <div className="flex items-center justify-between gap-4 sm:gap-5">
                    <div>
                      <p className="sg-data text-xl font-black text-white sm:text-2xl">{idea.ticker}</p>
                      <p className="mt-1 text-xs font-semibold text-white/56 sm:text-sm">{idea.thesis}</p>
                    </div>
                    <div className="sg-data rounded-full border border-emerald-300/24 bg-emerald-300/10 px-3 py-1.5 text-base font-black text-emerald-200 sm:px-4 sm:py-2 sm:text-lg">
                      {idea.score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#030d08] via-[#030d08]/68 to-transparent" />
      </div>
    </section>,
    host,
  );
}
