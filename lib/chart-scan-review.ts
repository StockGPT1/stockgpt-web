import { positivePrice } from "./chart-scan-scenario.ts";
import { chartTimeframeMinutes } from "./chart-scan-timeline.ts";

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
function directionConflict(reading: Reading) {
  const plan = object(reading.trade_plan);
  return reading.verdict === "bullish" && plan.side === "short" || reading.verdict === "bearish" && plan.side === "long";
}
function ticker(value: unknown) {
  const text = sentence(value).toUpperCase();
  if (!text || /^(NULL|UNKNOWN|N\/A|NONE)$/.test(text)) return null;
  // Case, cashtags and exchange prefixes do not change the ticker. Leave
  // obvious prose and unknown formats out of the comparison.
  const symbol = text.replace(/^\$/, "").replace(/^[A-Z][A-Z0-9_]{1,15}:/, "");
  return /^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol) ? symbol : null;
}

export function assessChartReview(candidate: Reading | undefined, final: Reading, reviewed: boolean): ChartReview {
  const counterargument = sentence(final.counterargument) || sentence(final.invalidation) ||
    "The move may fail before reaching the target. Wait for the price trigger and reassess if the stop is reached.";
  if (!reviewed) return {
    agreement: "unavailable", headline: "Second read unavailable", score_cap: 40, counterargument,
    detail: "Only one analysis completed. The score is reduced and chart highlights are withheld.",
  };
  if (directionConflict(final) || candidate && directionConflict(candidate)) return {
    agreement: "mixed", headline: "The direction needs confirmation", score_cap: 35, counterargument,
    detail: "The directional read and proposed trade conflict. The score is reduced; wait for a fresh price trigger before considering the scenario.",
  };
  if (candidate && ["candles", "price_line"].includes(String(candidate.price_series_type)) &&
    ["candles", "price_line"].includes(String(final.price_series_type)) && candidate.price_series_type !== final.price_series_type) return {
    agreement: "mixed", headline: "The chart type needs confirmation", score_cap: 40, counterargument,
    detail: "The readers differ on whether the chart shows candles or a price line. Keep the directional scenario tentative; candle findings need a clearer view.",
  };
  if (candidate && side(candidate) && side(final) && side(candidate) !== side(final)) return {
    agreement: "mixed", headline: "The two reads disagree on direction", score_cap: 40, counterargument,
    detail: "The independent readers favour different directions. Treat this as a lower-confidence scenario and wait for the trigger.",
  };
  if (candidate) {
    const firstTicker = ticker(candidate.ticker), secondTicker = ticker(final.ticker);
    // Share-class punctuation varies between chart providers (BRK.B/BRK-B).
    // Only compare distinct symbols, not an ambiguous punctuation convention.
    if (firstTicker && secondTicker && firstTicker !== secondTicker &&
      firstTicker.replace(/[._-]/g, "") !== secondTicker.replace(/[._-]/g, "")) return {
      agreement: "mixed", headline: "The chart symbol needs confirmation", score_cap: 40, counterargument,
      detail: "The readers identified different ticker symbols. Check that the uploaded images show the same instrument before using these levels.",
    };
    const firstMinutes = chartTimeframeMinutes(candidate.timeframe), secondMinutes = chartTimeframeMinutes(final.timeframe);
    if (firstMinutes !== null && secondMinutes !== null && Math.abs(firstMinutes - secondMinutes) > 1e-9) return {
      agreement: "mixed", headline: "The chart timeframe needs confirmation", score_cap: 40, counterargument,
      detail: "The readers read different candle timeframes. The second read's timing is shown with a reduced score; confirm the chart interval before using the scenario.",
    };
    const before = object(candidate.trade_plan), after = object(final.trade_plan);
    const priceReadDisagrees = ["entry", "stop_loss", "take_profit"].some(key =>
      (positivePrice(before[key]) === null) !== (positivePrice(after[key]) === null));
    if (priceReadDisagrees) return {
      agreement: "mixed", headline: "Only one reader could price every level", score_cap: 55, counterargument,
      detail: "An entry or exit price could not be read by both readers. The second read's scenario is shown with a reduced score; check its levels against the chart.",
    };
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
    if ((candidate.verdict === "inconclusive") !== (final.verdict === "inconclusive")) return {
      agreement: "mixed", headline: "The directional edge is still developing", score_cap: 55, counterargument,
      detail: "One reader found the direction inconclusive. The second read's lean is shown with a reduced score; wait for the price trigger before considering it.",
    };
  }
  return {
    agreement: "aligned", headline: "Independent chart read complete", score_cap: 95, counterargument,
    detail: "The second reader found no material disagreement with the proposed scenario. Agreement does not guarantee the trade will work.",
  };
}
