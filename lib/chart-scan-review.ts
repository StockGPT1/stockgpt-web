import { positivePrice } from "./chart-scan-scenario.ts";

type Reading = Record<string, unknown>;
export type ChartReview = {
  agreement: "aligned" | "mixed" | "unavailable";
  headline: string;
  detail: string;
  counterargument: string;
  score_cap: number;
};

function object(value: unknown): Reading {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Reading : {};
}
function side(reading: Reading) {
  const plan = object(reading.trade_plan);
  return plan.side === "long" || plan.side === "short" ? plan.side
    : reading.verdict === "bullish" ? "long" : reading.verdict === "bearish" ? "short" : null;
}
function sentence(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 260) : "";
}

export function assessChartReview(candidate: Reading | undefined, final: Reading, reviewed: boolean): ChartReview {
  const counterargument = sentence(final.counterargument) || sentence(final.invalidation) ||
    "The move may fail before reaching the target. Wait for the price trigger and reassess if the stop is reached.";
  if (!reviewed) return {
    agreement: "unavailable", headline: "Second read unavailable", score_cap: 40, counterargument,
    detail: "Only one analysis completed. The score is reduced and chart highlights are withheld.",
  };
  const finalPlan = object(final.trade_plan);
  if (final.verdict === "bullish" && finalPlan.side === "short" || final.verdict === "bearish" && finalPlan.side === "long") return {
    agreement: "mixed", headline: "The direction needs confirmation", score_cap: 35, counterargument,
    detail: "The directional read and proposed trade conflict. The score is reduced; wait for a fresh price trigger before considering the scenario.",
  };
  if (candidate && side(candidate) && side(final) && side(candidate) !== side(final)) return {
    agreement: "mixed", headline: "The two reads disagree on direction", score_cap: 40, counterargument,
    detail: "The independent readers favour different directions. Treat this as a lower-confidence scenario and wait for the trigger.",
  };
  if (candidate) {
    const before = object(candidate.trade_plan), after = object(final.trade_plan);
    const entry = positivePrice(before.entry), stop = positivePrice(before.stop_loss);
    const risk = entry !== null && stop !== null ? Math.abs(entry - stop) : 0;
    const materiallyDifferent = ["entry", "stop_loss", "take_profit"].some(key => {
      const a = positivePrice(before[key]), b = positivePrice(after[key]);
      // Compare in units of risk as well as price: a tiny share-price difference
      // can be a large part of a tight stop. Rounding noise is not disagreement.
      return a !== null && b !== null && Math.abs(a - b) > Math.max(a * 0.0025, risk * 0.35);
    });
    const activationDisagrees = before.activation === "confirmed" && after.activation !== "confirmed" ||
      after.activation === "confirmed" && before.activation !== "confirmed";
    if (materiallyDifferent || activationDisagrees) return {
      agreement: "mixed", headline: materiallyDifferent ? "Risk levels need extra care" : "The entry still needs confirmation",
      score_cap: 55, counterargument,
      detail: materiallyDifferent ? "The readers differ on an entry or exit level. The second read's scenario is shown, with a reduced score."
        : "The readers differ on whether the setup has triggered. Wait for a fresh candle to confirm it.",
    };
  }
  return {
    agreement: "aligned", headline: "Independent chart read complete", score_cap: 95, counterargument,
    detail: "The second reader found no material disagreement with the proposed scenario. Agreement does not guarantee the trade will work.",
  };
}
