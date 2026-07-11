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
];

const rankedStocks = [
  { ticker: "NVDA", label: "AI infrastructure", score: 94, tone: "Strong" },
  { ticker: "MSFT", label: "Quality compounder", score: 91, tone: "Strong" },
  { ticker: "AVGO", label: "Semiconductor momentum", score: 88, tone: "Review" },
  { ticker: "COST", label: "Defensive quality", score: 84, tone: "Watch" },
];

const steps = [
  {
    eyebrow: "Market noise",
    title: "Start with the whole market shouting at once.",
    copy: "Prices move, headlines compete for attention and every ticker looks urgent. StockGPT starts by gathering the noise into one research workflow.",
  },
  {
    eyebrow: "Score the signals",
    title: "Separate hype from research priority.",
    copy: "Stocks are scored across quality, growth, value, momentum, income and risk signals before they reach the ranked view.",
  },
  {
    eyebrow: "Ranked stocks",
    title: "The strongest ideas rise to the top.",
    copy: "Instead of starting from scratch, users land on a ranked list that shows what looks stronger, weaker or worth researching next.",
  },
  {
    eyebrow: "Research workflow",
    title: "Open a stock, read the context, then ask follow-ups.",
    copy: "Rankings connect into stock pages, news context and Ask StockGPT so users can understand the reasoning before making their own decisions.",
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
    const landingRoot = document.querySelector(".sg-page-soft");
    const tickerSection = document.querySelector(
      '.sg-page-soft > section:first-of-type + div[class*="sm:grid-cols-4"] + div',
    );

    if (!landingRoot || !tickerSection) return;

    const portalHost = document.createElement("div");
    portalHost.setAttribute("data-stockgpt-market-noise-scrolly", "true");
    tickerSection.insertAdjacentElement("afterend", portalHost);
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

  const activeStep = reducedMotion ? 2 : Math.min(steps.length - 1, Math.floor(progress * steps.length));
  const localProgress = reducedMotion ? 1 : clamp(progress * (steps.length - 1));
  const chaosOpacity = reducedMotion ? 0.16 : clamp(1 - progress * 1.55, 0.08, 1);
  const rankOpacity = reducedMotion ? 1 : clamp((progress - 0.28) / 0.42, 0, 1);
  const beamScale = reducedMotion ? 1 : 0.2 + clamp(progress * 1.35, 0, 1) * 0.8;

  const tickerLayout = useMemo(
    () =>
      noiseTickers.map((ticker, index) => ({
        ticker,
        left: `${8 + ((index * 23) % 82)}%`,
        top: `${10 + ((index * 37) % 76)}%`,
        delay: `${index * 65}ms`,
        lift: index % 2 === 0 ? -1 : 1,
      })),
    [],
  );

  if (!host) return null;

  return createPortal(
    <section
      data-market-noise-section
      className="relative mx-auto hidden max-w-7xl px-4 py-6 sm:block sm:px-6 lg:px-8"
      style={{ height: reducedMotion ? "auto" : "320vh" }}
      aria-label="From market noise to ranked stocks"
    >
      <div className="sticky top-[96px] overflow-hidden rounded-[2.25rem] border border-[#dfe5dc] bg-[#061b12] p-6 text-white shadow-[0_28px_90px_rgba(7,27,17,0.16)] sm:p-8 lg:top-[112px] lg:grid lg:min-h-[calc(100vh-140px)] lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(221,177,89,0.18),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(15,159,93,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.045),transparent_46%)]" />
        <div className="relative z-10">
          <p className="inline-flex rounded-full border border-[#ddb159]/28 bg-[#ddb159]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#ddb159]">
            {steps[activeStep]?.eyebrow}
          </p>
          <h2 className="sg-heading mt-5 max-w-xl text-[42px] font-medium leading-[0.98] text-white sm:text-6xl lg:text-7xl">
            From market noise to ranked stocks.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/68">
            {steps[activeStep]?.copy}
          </p>

          <div className="mt-7 grid gap-3">
            {steps.map((step, index) => (
              <div
                key={step.eyebrow}
                className="rounded-2xl border px-4 py-3 transition-all duration-300"
                style={{
                  borderColor: index === activeStep ? "rgba(221,177,89,0.46)" : "rgba(255,255,255,0.08)",
                  background: index === activeStep ? "rgba(221,177,89,0.10)" : "rgba(255,255,255,0.035)",
                  opacity: index <= activeStep ? 1 : 0.42,
                }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                  0{index + 1} / {step.eyebrow}
                </p>
                <p className="mt-1 text-sm font-black leading-6 text-white">{step.title}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8 min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#03140d] p-4 lg:mt-0">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(221,177,89,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(221,177,89,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />

          {tickerLayout.map((item, index) => (
            <div
              key={item.ticker}
              className="absolute rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-all duration-500"
              style={{
                left: item.left,
                top: item.top,
                opacity: chaosOpacity,
                transform: `translate(-50%, -50%) translateY(${item.lift * localProgress * 42}px) scale(${1 - localProgress * 0.18})`,
                transitionDelay: item.delay,
              }}
            >
              <span className="sg-data">{item.ticker}</span>
            </div>
          ))}

          <div
            className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/24 bg-[#ddb159]/10 blur-[1px] transition-all duration-500"
            style={{
              opacity: clamp(progress * 1.2, 0.08, 0.42),
              transform: `translate(-50%, -50%) scale(${beamScale})`,
            }}
          />

          <div
            className="absolute inset-x-4 bottom-4 top-4 grid content-end gap-3 transition-all duration-500"
            style={{ opacity: rankOpacity, transform: `translateY(${(1 - rankOpacity) * 28}px)` }}
          >
            <div className="rounded-[1.5rem] border border-[#ddb159]/24 bg-[#071f15]/92 p-4 shadow-[0_22px_54px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                    StockGPT ranked output
                  </p>
                  <p className="mt-1 text-xl font-black text-white">Research priorities</p>
                </div>
                <div className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  Sorted
                </div>
              </div>

              <div className="grid gap-2">
                {rankedStocks.map((stock, index) => (
                  <div
                    key={stock.ticker}
                    className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.055] p-3"
                    style={{ transform: `translateY(${Math.max(0, 1 - rankOpacity) * (18 + index * 8)}px)` }}
                  >
                    <div className="sg-data text-sm font-black text-[#ddb159]">#{index + 1}</div>
                    <div>
                      <p className="sg-data text-base font-black text-white">{stock.ticker}</p>
                      <p className="text-xs font-semibold text-white/48">{stock.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="sg-data text-lg font-black text-emerald-300">{stock.score}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/42">{stock.tone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>,
    host,
  );
}
