"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TradeLevels, TradeTrigger } from "@/lib/trading-levels";

type ExplanationModal = {
  title: string;
  value: string;
  meaning: string;
  reasoning: string;
  detail?: string;
  tone?: "neutral" | "positive" | "negative";
};

function recommendationStyle(rec: TradeLevels["recommendation"]) {
  switch (rec) {
    case "Strong Buy":
      return {
        bg: "bg-emerald-500",
        text: "text-white",
        glow: "bg-emerald-500/20",
      };
    case "Buy":
      return {
        bg: "bg-emerald-400",
        text: "text-[#072116]",
        glow: "bg-emerald-400/20",
      };
    case "Hold / Watch":
      return {
        bg: "bg-[#ddb159]",
        text: "text-[#072116]",
        glow: "bg-[#ddb159]/20",
      };
    case "Avoid":
      return {
        bg: "bg-red-500",
        text: "text-white",
        glow: "bg-red-500/20",
      };
  }
}

function TriggerIcon({ icon }: { icon: TradeTrigger["icon"] }) {
  if (icon === "target") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
      </svg>
    );
  }

  if (icon === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v5M12 18v.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function triggerToneStyle(tone: TradeTrigger["tone"]) {
  if (tone === "positive") {
    return {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: "text-emerald-700",
      text: "text-emerald-900",
    };
  }

  if (tone === "negative") {
    return {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: "text-red-700",
      text: "text-red-900",
    };
  }

  return {
    bg: "bg-[#072116]/4",
    border: "border-[#072116]/12",
    icon: "text-[#072116]/65",
    text: "text-[#072116]",
  };
}

function modalToneStyle(tone: ExplanationModal["tone"]) {
  if (tone === "positive") {
    return {
      chip: "border-emerald-300 bg-emerald-50 text-emerald-800",
      glow: "bg-emerald-400/15",
    };
  }

  if (tone === "negative") {
    return {
      chip: "border-red-300 bg-red-50 text-red-800",
      glow: "bg-red-400/15",
    };
  }

  return {
    chip: "border-[#ddb159]/35 bg-[#ddb159]/12 text-[#ddb159]",
    glow: "bg-[#ddb159]/15",
  };
}

function factorMeaning(label: string) {
  const key = label.toLowerCase();

  if (key === "ai score") {
    return "AI Score is StockGPT’s model score for the stock, combining ranking strength, market signals and supporting data into one conviction number.";
  }

  if (key === "rank") {
    return "Rank shows where this stock sits compared with the wider ranked universe. A lower number means the model currently sees it as a stronger opportunity.";
  }

  if (key === "risk/reward") {
    return "Risk/reward compares the planned upside to the planned downside. For example, 1:3 means the target upside is around three times the risk to the stop.";
  }

  if (key === "technical stop") {
    return "Technical stop is the price area where the trade idea would be considered invalid. It is designed to sit below an important support or trend level, not randomly below the entry.";
  }

  if (key === "technical target") {
    return "Technical target is the price area the trade plan is aiming for, usually based on resistance, measured moves or medium-term extension potential.";
  }

  if (key === "sector") {
    return "Sector shows the industry group the stock belongs to, because different sectors behave differently depending on rates, regulation, economic growth and volatility.";
  }

  if (key === "recent news") {
    return "Recent news measures whether linked articles over the recent period are positive, negative or neutral for the stock. It helps the model avoid ignoring fresh catalysts.";
  }

  return "This factor is one of the inputs StockGPT uses to explain why the trade plan looks attractive, risky or worth waiting on.";
}

function factorReasoning(label: string, value: string, note: string) {
  const key = label.toLowerCase();

  if (key === "ai score") {
    return `The current AI Score is ${value}. StockGPT labels this as “${note}”, which means the model is using this score as a major part of the trade conviction.`;
  }

  if (key === "rank") {
    return `The current rank is ${value}. The note “${note}” explains how strong that position is relative to the wider ranked stock universe.`;
  }

  if (key === "risk/reward") {
    return `The current risk/reward is ${value}. StockGPT describes it as “${note}”, meaning the planned upside is being compared directly against the downside to the stop-loss area.`;
  }

  if (key === "technical stop") {
    return `The technical stop reference is ${value}. StockGPT notes “${note}”, so this stop is being based on the nearest usable technical structure or a fallback when structure is not reliable enough.`;
  }

  if (key === "technical target") {
    return `The technical target reference is ${value}. StockGPT notes “${note}”, meaning the plan is looking for either a resistance checkpoint or a measured move beyond current levels.`;
  }

  if (key === "sector") {
    return `The sector is ${value}. StockGPT describes this as “${note}”, which affects how much normal volatility the trade plan allows before the setup is considered invalid.`;
  }

  if (key === "recent news") {
    return `Recent news is shown as ${value}. The note “${note}” tells you whether the latest linked article flow is positive, negative, neutral or simply being treated as neutral due to limited coverage.`;
  }

  return `Current value: ${value}. StockGPT’s note for this factor is “${note}”.`;
}

function triggerMeaning(trigger: TradeTrigger) {
  if (trigger.type === "take_profit") {
    return "A take-profit trigger is the level or situation where the plan would consider locking in gains rather than continuing to hold the full position.";
  }

  if (trigger.type === "stop_loss") {
    return "A stop-loss trigger is the point where the original trade thesis is considered broken and the plan suggests cutting or reducing exposure.";
  }

  if (trigger.type === "score_drop") {
    return "A score-drop trigger watches for weakening model conviction. Even if price has not moved much, a falling score can suggest the setup is deteriorating.";
  }

  if (trigger.type === "rank_drop") {
    return "A rank-drop trigger watches whether the stock is losing strength compared with other opportunities in the ranked universe.";
  }

  return "A review trigger is a scheduled check-in. It helps avoid holding a position without reassessing the latest price action, ranking, news and market conditions.";
}

function ClickHint() {
  return (
    <span className="pointer-events-none absolute right-2 top-2 rounded-full border border-[#072116]/10 bg-white/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#072116]/40 opacity-0 transition group-hover:opacity-100">
      Explain
    </span>
  );
}

function ExplanationPortal({
  modal,
  onClose,
}: {
  modal: ExplanationModal;
  onClose: () => void;
}) {
  const styles = modalToneStyle(modal.tone);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] overflow-hidden">
      <button
        type="button"
        aria-label="Close explanation"
        className="absolute inset-0 h-full w-full cursor-default bg-[#020805]/88 backdrop-blur-[30px] backdrop-saturate-50"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden px-3 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(132px+env(safe-area-inset-top))] sm:px-5 sm:pb-8 sm:pt-[calc(118px+env(safe-area-inset-top))] lg:pt-[calc(132px+env(safe-area-inset-top))]">
        <div
          className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[26px] border border-[#ddb159]/30 bg-[#061b12] text-[#faf6f0] shadow-[0_34px_110px_rgba(0,0,0,0.72)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`pointer-events-none hidden ${styles.glow}`}
          />

          <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-[#ddb159]/14 bg-[#04140c] p-4 pb-3 sm:p-6 sm:pb-4">
            <div className="min-w-0">
              <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[9px]">
                Trade Plan Explainer
              </p>

              <h3 className="mt-1 line-clamp-2 text-[20px] font-black leading-tight tracking-[-0.04em] sm:text-[24px]">
                {modal.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.045] px-3 py-1.5 text-[10px] font-black text-[#ddb159] shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition hover:bg-[#ddb159]/10 sm:text-[11px]"
            >
              Close
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-3 sm:p-6 sm:pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`max-w-full break-words rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] sm:text-[11px] ${styles.chip}`}
              >
                {modal.value}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] p-3 sm:p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159] sm:text-[10px]">
                What this means
              </p>

              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/76 sm:text-[14px]">
                {modal.meaning}
              </p>
            </div>

            <div className="mt-3 rounded-2xl border border-[#ddb159]/25 bg-[#ddb159]/10 p-3 sm:p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159] sm:text-[10px]">
                Why StockGPT chose this
              </p>

              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/76 sm:text-[14px]">
                {modal.reasoning}
              </p>
            </div>

            {modal.detail && (
              <p className="mt-4 text-[12px] font-medium leading-5 text-[#faf6f0]/55">
                {modal.detail}
              </p>
            )}

            <p className="mt-4 text-[10px] font-medium leading-relaxed text-[#faf6f0]/42">
              Educational explanation only. This is not personal financial
              advice and should not be used as the sole basis for an investment
              decision.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TradeSetupCard({
  levels,
  currency = "$",
}: {
  levels: TradeLevels;
  currency?: string;
}) {
  const [modal, setModal] = useState<ExplanationModal | null>(null);

  const recStyle = recommendationStyle(levels.recommendation);
  const showLevels = levels.recommendation !== "Avoid";

  return (
    <div className="relative max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${recStyle.glow}`}
      />

      <div className="relative flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            AI Trade Plan
          </p>

          <h3 className="mt-0.5 text-[20px] font-black tracking-[-0.03em]">
            Suggested Levels
          </h3>
        </div>

        <button
          type="button"
          onClick={() =>
            setModal({
              title: "AI Recommendation",
              value: levels.recommendation,
              meaning:
                "The recommendation is StockGPT’s overall trade stance after combining rank, score, news flow, technical structure and risk/reward.",
              reasoning:
                levels.recommendation === "Avoid"
                  ? "The model does not see enough signal strength to suggest trade levels, so it recommends waiting for a cleaner setup."
                  : `The current recommendation is ${levels.recommendation}. This reflects the strength of the AI signal and whether the planned upside is attractive enough compared with the downside risk.`,
              detail:
                "This should be used as an educational planning tool, not as personal financial advice.",
              tone:
                levels.recommendation === "Strong Buy" ||
                levels.recommendation === "Buy"
                  ? "positive"
                  : levels.recommendation === "Avoid"
                    ? "negative"
                    : "neutral",
            })
          }
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition hover:scale-[1.02] ${recStyle.bg} ${recStyle.text}`}
        >
          {levels.recommendation}
        </button>
      </div>

      {showLevels ? (
        <>
          <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() =>
                setModal({
                  title: "Entry",
                  value: `${currency}${levels.entry.toFixed(2)}`,
                  meaning:
                    "Entry is the suggested price area where the trade plan starts. It is the reference point used to calculate downside risk and upside target.",
                  reasoning: `StockGPT’s suggested entry is ${currency}${levels.entry.toFixed(
                    2,
                  )}. The stop loss and take-profit levels are calculated from this entry area, so it acts as the centre point of the trade plan.`,
                  detail:
                    "A real market price can move quickly. The entry level is a planning reference, not a guaranteed execution price.",
                  tone: "neutral",
                })
              }
              className="group relative rounded-xl border border-[#072116]/10 bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/70 hover:shadow-[0_8px_20px_rgba(7,33,22,0.12)]"
            >
              <ClickHint />

              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                Entry
              </p>

              <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em]">
                {currency}
                {levels.entry.toFixed(2)}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">
                Suggested
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({
                  title: "Stop Loss",
                  value: `${currency}${levels.stopLoss.toFixed(2)}`,
                  meaning:
                    "Stop loss is the downside level where the trade idea is considered wrong or too risky to continue holding.",
                  reasoning: `The stop loss is set at ${currency}${levels.stopLoss.toFixed(
                    2,
                  )}, which is ${levels.stopPct}% below the suggested entry. This level is designed to define the risk before entering the trade.`,
                  detail:
                    "A stop loss is not a prediction that the stock will fall. It is a risk-control boundary that says where the plan should be reviewed or exited.",
                  tone: "negative",
                })
              }
              className="group relative rounded-xl border border-red-200 bg-red-50/50 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-[0_8px_20px_rgba(127,29,29,0.12)]"
            >
              <ClickHint />

              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-red-700/70">
                Stop Loss
              </p>

              <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em] text-red-700">
                {currency}
                {levels.stopLoss.toFixed(2)}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-red-700/70">
                −{levels.stopPct}%
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({
                  title: "Take Profit",
                  value: `${currency}${levels.takeProfit.toFixed(2)}`,
                  meaning:
                    "Take profit is the upside target where the plan would consider locking in gains or reducing the position.",
                  reasoning: `The take-profit level is ${currency}${levels.takeProfit.toFixed(
                    2,
                  )}, which is ${levels.targetPct}% above the suggested entry. This is the reward side of the trade plan.`,
                  detail:
                    "The target is usually based on a mix of risk/reward, resistance areas and medium-term measured move potential.",
                  tone: "positive",
                })
              }
              className="group relative rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_8px_20px_rgba(6,95,70,0.12)]"
            >
              <ClickHint />

              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-emerald-700/70">
                Take Profit
              </p>

              <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em] text-emerald-700">
                {currency}
                {levels.takeProfit.toFixed(2)}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-emerald-700/70">
                +{levels.targetPct}%
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setModal({
                title: "Risk / Reward",
                value: `1 : ${levels.riskReward}`,
                meaning:
                  "Risk/reward compares how much upside the plan is targeting versus how much downside it is risking to the stop loss.",
                reasoning: `The current risk/reward is 1:${levels.riskReward}. This means the planned reward is about ${levels.riskReward} times the planned risk from entry to stop loss.`,
                detail:
                  "Higher risk/reward can be attractive, but it does not guarantee success. It simply means the target is meaningfully larger than the defined downside.",
                tone: "neutral",
              })
            }
            className="relative mt-3 flex w-full items-center justify-between rounded-xl bg-[#072116] px-4 py-2.5 text-left transition hover:-translate-y-0.5 hover:bg-[#0b2b1d] hover:shadow-[0_8px_20px_rgba(7,33,22,0.22)]"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#ddb159]/80">
              Risk / Reward
            </p>

            <p className="text-[14px] font-black text-[#ddb159]">
              1 : {levels.riskReward}
            </p>
          </button>

          {levels.plan && (
            <div className="relative mt-4 rounded-xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#fdf8ed,#faf6f0)] p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
                AI Projected Timeline
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: "Expected Return",
                      value: `${levels.plan!.expectedAnnualReturn}%/yr`,
                      meaning:
                        "Expected return is the model’s annualised estimate of the return potential implied by this setup.",
                      reasoning: `StockGPT estimates ${levels.plan!.expectedAnnualReturn}% per year for this plan. This is used to estimate whether the target is realistic over the projected holding period.`,
                      detail:
                        "It is not a guaranteed return. It is a planning assumption based on model confidence and target distance.",
                      tone: "positive",
                    })
                  }
                  className="rounded-lg border border-transparent p-1 text-left transition hover:border-[#ddb159]/35 hover:bg-white/60"
                >
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                    Expected Return
                  </p>

                  <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-emerald-700">
                    {levels.plan.expectedAnnualReturn}%/yr
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: "Target Date",
                      value: levels.plan!.expectedTargetDate,
                      meaning:
                        "Target date is the approximate month when the model thinks the take-profit level could be reached if the thesis plays out.",
                      reasoning: `The current projected target date is ${levels.plan!.expectedTargetDate}. This is calculated from the target distance and the model’s expected return assumption.`,
                      detail:
                        "This is an estimated planning window, not a deadline. Price can reach the target earlier, later or not at all.",
                      tone: "neutral",
                    })
                  }
                  className="rounded-lg border border-transparent p-1 text-left transition hover:border-[#ddb159]/35 hover:bg-white/60"
                >
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                    Target Date
                  </p>

                  <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em]">
                    {levels.plan.expectedTargetDate}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: "Hold Period",
                      value: levels.plan!.recommendedHoldPeriod,
                      meaning:
                        "Hold period is the rough amount of time the trade plan expects the thesis may need to develop.",
                      reasoning: `The recommended hold period is ${levels.plan!.recommendedHoldPeriod}. StockGPT uses this to frame the trade as a medium-term setup rather than a quick intraday move.`,
                      detail:
                        "The hold period should be reviewed if the AI score, rank, news flow or price structure changes materially.",
                      tone: "neutral",
                    })
                  }
                  className="rounded-lg border border-transparent p-1 text-left transition hover:border-[#ddb159]/35 hover:bg-white/60"
                >
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                    Hold Period
                  </p>

                  <p className="mt-0.5 text-[14px] font-black tracking-[-0.02em]">
                    {levels.plan.recommendedHoldPeriod}
                  </p>
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModal({
                    title: "AI Thesis",
                    value: "Medium-term setup",
                    meaning:
                      "The thesis is the plain-English explanation of why the trade plan exists.",
                    reasoning: levels.plan!.thesis,
                    detail:
                      "This combines model confidence, rank, score, sector behaviour, target, stop level and risk/reward into one summary.",
                    tone: "neutral",
                  })
                }
                className="mt-3 w-full rounded-lg border border-transparent p-1 text-left transition hover:border-[#ddb159]/35 hover:bg-white/60"
              >
                <p className="text-[12px] font-medium leading-relaxed text-[#072116]/75">
                  {levels.plan.thesis}
                </p>
              </button>

              <div className="mt-4">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
                  AI Action Plan — If This, Then That
                </p>

                <div className="mt-2 grid gap-2">
                  {levels.plan.triggers.map((trigger, i) => {
                    const tone = triggerToneStyle(trigger.tone);

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setModal({
                            title: trigger.condition,
                            value: trigger.action,
                            meaning: triggerMeaning(trigger),
                            reasoning: `Condition: ${trigger.condition}. Suggested action: ${trigger.action}.`,
                            detail:
                              "This trigger is designed to make the plan easier to follow by defining what to do before the event happens.",
                            tone: trigger.tone,
                          })
                        }
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(7,33,22,0.1)] ${tone.border} ${tone.bg}`}
                      >
                        <div className={`shrink-0 ${tone.icon}`}>
                          <TriggerIcon icon={trigger.icon} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[12px] font-black tracking-[-0.01em] ${tone.text}`}
                          >
                            {trigger.condition}
                          </p>

                          <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/60">
                            → {trigger.action}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() =>
            setModal({
              title: "No Trade Levels Suggested",
              value: "Avoid",
              meaning:
                "When StockGPT marks a setup as Avoid, it means the model does not currently see enough signal strength to justify suggesting entry, stop and target levels.",
              reasoning:
                "The AI recommends waiting for a better setup rather than forcing a trade with weak model support.",
              detail:
                "This can happen when rank, score, technical structure, recent news or risk/reward are not strong enough.",
              tone: "negative",
            })
          }
          className="relative mt-5 w-full rounded-xl border border-red-200 bg-red-50/50 p-4 text-center transition hover:-translate-y-0.5 hover:border-red-300"
        >
          <p className="text-[13px] font-bold text-red-700">
            Insufficient signal strength to suggest entry levels.
          </p>

          <p className="mt-1 text-[11px] font-semibold text-red-700/70">
            The AI recommends waiting for a better setup.
          </p>
        </button>
      )}

      <div className="relative mt-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          Built From
        </p>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {levels.factors.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() =>
                setModal({
                  title: f.label,
                  value: f.value,
                  meaning: factorMeaning(f.label),
                  reasoning: factorReasoning(f.label, f.value, f.note),
                  detail:
                    "This box is part of the explanation layer behind the AI Trade Plan. It helps show why the model produced the current setup rather than only showing a final number.",
                  tone:
                    f.label.toLowerCase() === "risk/reward" ||
                    f.label.toLowerCase() === "ai score" ||
                    f.label.toLowerCase() === "rank"
                      ? "positive"
                      : "neutral",
                })
              }
              className="group relative rounded-lg border border-[#072116]/8 bg-white/60 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/65 hover:bg-white hover:shadow-[0_8px_18px_rgba(7,33,22,0.1)]"
            >
              <ClickHint />

              <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                {f.label}
              </p>

              <p className="mt-0.5 truncate text-[12px] font-bold">
                {f.value}
              </p>

              <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/55">
                {f.note}
              </p>
            </button>
          ))}
        </div>
      </div>

      <p className="relative mt-4 text-[10px] font-medium leading-relaxed text-[#072116]/45">
        ⚠️ AI-generated trade plan based on quantitative factors. Not financial
        advice. Past performance does not guarantee future results.
      </p>

      {modal && (
        <ExplanationPortal modal={modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
