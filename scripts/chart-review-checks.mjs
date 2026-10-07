import assert from "node:assert/strict";
import test from "node:test";
import { assessChartReview } from "../lib/chart-scan-review.ts";
import { visionSettings, SCAN_DEADLINE_MS } from "../lib/chart-scan-vision.ts";
import { stockGPTScore, buildTradeScenario } from "../lib/chart-scan-scenario.ts";
import { runGroundedChartScan } from "../lib/chart-scanner.ts";

const reading = {
  verdict: "bullish", confidence: 99, summary: "Two troughs hold support.",
  chart_coverage: "full", price_series_type: "candles", indicator_checks: [],
  counterargument: "Price is still under the neckline, so the bounce may fail.",
  signals: [{ name: "Two troughs at support", kind: "structure", bias: "bullish", confidence: 90, evidence: "Two separate troughs hold the same visible level.", region_id: "price", source_image: 0, supported: true }],
  trade_plan: { side: "long", activation: "confirmed", price_scale_readable: true, levels_basis: "structure", entry: "100", stop_loss: "95", take_profit: "110" },
};

test("independent opposite directions cap the score and remove confirmed activation", async () => {
  const other = { ...reading, verdict: "bearish", signals: [{ ...reading.signals[0], bias: "bearish" }], trade_plan: { ...reading.trade_plan, side: "short", entry: "100", stop_loss: "105", take_profit: "90" } };
  const result = await runGroundedChartScan({
    locate: async () => ({ value: { price_series_type: "candles" }, model: "mapper" }),
    analyse: async () => ({ value: reading, model: "first" }),
    review: async () => ({ value: other, model: "second" }),
  }, 1);
  assert.equal(result.result.review.agreement, "mixed");
  assert.equal(result.result.trade_plan.side, "short");
  assert.equal(result.result.trade_plan.status, "conditional");
  assert.match(result.result.confirmation, /fresh candle/);
  assert.ok(result.result.stockgpt_score.value <= 40);
  assert.ok(result.result.trade_plan.entry_value > result.result.trade_plan.target_value);
});

test("material entry or exit differences are shown even when the direction agrees", () => {
  const result = assessChartReview(reading, { ...reading, trade_plan: { ...reading.trade_plan, entry: "102" } }, true);
  assert.equal(result.agreement, "mixed");
  assert.equal(result.score_cap, 55);
  assert.match(result.detail, /entry or exit/);
});
test("a trade direction that contradicts its own verdict is never high-confidence", () => {
  const result = assessChartReview(reading, { ...reading, trade_plan: { ...reading.trade_plan, side: "short" } }, true);
  assert.equal(result.agreement, "mixed");
  assert.equal(result.score_cap, 35);
});
test("rounding noise and equivalent currency formatting do not manufacture disagreement", () => {
  assert.equal(assessChartReview(reading, { ...reading, trade_plan: { ...reading.trade_plan, entry: "$100.01" } }, true).agreement, "aligned");
});
test("trigger disagreement is conditional even with identical numeric prices", () => {
  const result = assessChartReview(reading, { ...reading, trade_plan: { ...reading.trade_plan, activation: "conditional" } }, true);
  assert.equal(result.agreement, "mixed");
  assert.match(result.detail, /triggered/);
});
test("missing numeric prices never become zero-price comparison anchors", () => {
  const empty = { ...reading, trade_plan: { side: "long", entry: null, stop_loss: null, take_profit: null } };
  assert.equal(assessChartReview(empty, empty, true).agreement, "aligned");
});
test("unavailable review remains explicit and keeps a concrete caution", () => {
  const result = assessChartReview(reading, reading, false);
  assert.equal(result.agreement, "unavailable");
  assert.equal(result.score_cap, 40);
  assert.equal(result.counterargument, reading.counterargument);
  assert.match(assessChartReview(reading, {}, false).counterargument, /may fail/);
});
test("three versions of price evidence do not count as three independent confirmations", () => {
  const signals = ["structure", "pattern", "candle"].map(kind => ({ kind, name: `Visible ${kind}`, bias: "bullish", confidence: 90 }));
  const plan = buildTradeScenario(reading, { usable: true, reviewed: true, signals, patterns: [] });
  const oneFamily = stockGPTScore(99, plan, true, signals, []);
  const diverse = stockGPTScore(99, plan, true, [...signals, { kind: "indicator", name: "RSI recovery", bias: "bullish", confidence: 90 }], []);
  assert.ok(oneFamily.value <= 70);
  assert.ok(diverse.value > oneFamily.value);
  assert.match(oneFamily.reasons.join(" "), /1 evidence family/);
});
test("RSI and MACD support share the momentum family rather than inflate the score", () => {
  const a = { kind: "indicator", name: "RSI recovery", bias: "bullish", confidence: 90 };
  const plan = buildTradeScenario(reading, { usable: true, reviewed: true, signals: [a], patterns: [] });
  assert.equal(stockGPTScore(90, plan, true, [a], []).value,
    stockGPTScore(90, plan, true, [a, { ...a, name: "MACD recovery" }], []).value);
});
test("request budgets reserve visible JSON output and never exceed the route deadline", () => {
  const layout = visionSettings("layout", SCAN_DEADLINE_MS);
  const analysis = visionSettings("analysis", SCAN_DEADLINE_MS - layout.timeout);
  const review = visionSettings("review", SCAN_DEADLINE_MS - layout.timeout - analysis.timeout);
  assert.ok(layout.timeout + analysis.timeout + review.timeout < SCAN_DEADLINE_MS);
  assert.equal(analysis.reasoning.effort, "low");
  assert.equal(analysis.reasoning.exclude, true);
  assert.ok(analysis.max_tokens >= 8000);
  assert.equal(visionSettings("review", 12_000).canRequest, false);
  assert.equal(visionSettings("analysis", -1).timeout, 0);
});
test("an analysis retry leaves at least half its remaining budget to the other reader", () => {
  const retry = visionSettings("analysis", 60_000, true);
  assert.ok(retry.timeout < 30_000);
  assert.ok(visionSettings("review", 60_000 - retry.timeout).canRequest);
});

test("partial or unclear screenshots cannot receive the highest-confidence score", async () => {
  for (const chart_coverage of ["partial", "unclear"]) {
    const result = await runGroundedChartScan({
      locate: async () => ({ value: { price_series_type: "candles" }, model: "mapper" }),
      analyse: async () => ({ value: { ...reading, chart_coverage }, model: "first" }),
      review: async () => ({ value: { ...reading, chart_coverage }, model: "second" }),
    }, 1);
    assert.ok(result.result.stockgpt_score.value <= (chart_coverage === "partial" ? 65 : 50));
    assert.ok(result.result.stockgpt_score.reasons.some(reason => /chart.*missing|coverage.*unclear/.test(reason)));
  }
});
