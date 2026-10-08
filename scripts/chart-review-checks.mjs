import assert from "node:assert/strict";
import test from "node:test";
import { assessChartReview } from "../lib/chart-scan-review.ts";
import { visionSettings, SCAN_DEADLINE_MS } from "../lib/chart-scan-vision.ts";
import { stockGPTScore, buildTradeScenario } from "../lib/chart-scan-scenario.ts";
import { normaliseChartLayout, normaliseChartScan, runGroundedChartScan } from "../lib/chart-scanner.ts";
import { CANDLE_PATTERNS, normaliseCandleAudit } from "../lib/chart-scan-candles.ts";

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
test("an inconsistent first reader cannot falsely confirm the second reader", () => {
  const first = { ...reading, trade_plan: { ...reading.trade_plan, side: "short" } };
  const result = assessChartReview(first, reading, true);
  assert.equal(result.agreement, "mixed");
  assert.equal(result.score_cap, 35);
});
test("a directional lean survives inconclusive first evidence with a reduced score", async () => {
  const result = await runGroundedChartScan({
    locate: async () => ({ value: { price_series_type: "candles" }, model: "mapper" }),
    analyse: async () => ({ value: { ...reading, verdict: "inconclusive" }, model: "first" }),
    review: async () => ({ value: reading, model: "second" }),
  }, 1);
  assert.equal(result.result.verdict, "bullish");
  assert.equal(result.result.review.agreement, "mixed");
  assert.equal(result.result.trade_plan.status, "conditional");
  assert.ok(result.result.stockgpt_score.value <= 55);
});
test("opposing candle and price-line readings cannot be labelled aligned", () => {
  const result = assessChartReview({ ...reading, price_series_type: "price_line" }, reading, true);
  assert.equal(result.agreement, "mixed");
  assert.equal(result.score_cap, 40);
  assert.match(result.headline, /chart type/);
});
test("known ticker disagreement is surfaced while formatting and unreadable symbols are ignored", () => {
  for (const [first, second] of [["aapl", "AAPL"], ["$AAPL", "NASDAQ:AAPL"], ["BRK.B", "BRK-B"], [null, "AAPL"], ["unknown", "AAPL"], ["N/A", "AAPL"], ["Apple Inc.", "AAPL"]]) {
    assert.equal(assessChartReview({ ...reading, ticker: first }, { ...reading, ticker: second }, true).agreement, "aligned");
  }
  const result = assessChartReview({ ...reading, ticker: "NASDAQ:AAPL" }, { ...reading, ticker: "MSFT" }, true);
  assert.equal(result.agreement, "mixed");
  assert.equal(result.score_cap, 40);
  assert.match(result.headline, /symbol/);
});
test("equivalent candle timeframes agree and unreadable intervals do not manufacture disagreement", () => {
  for (const [first, second] of [["1h", "60m"], ["1d", "24h"], ["daily", "1440m"], ["0.5 hours", "30min"], [null, "1h"], ["unknown", "1h"], ["1M", "1h"]]) {
    assert.equal(assessChartReview({ ...reading, timeframe: first }, { ...reading, timeframe: second }, true).agreement, "aligned");
  }
});
test("known timeframe disagreement reduces certainty without dropping a supported direction", async () => {
  const result = await runGroundedChartScan({
    locate: async () => ({ value: { price_series_type: "candles" }, model: "mapper" }),
    analyse: async () => ({ value: { ...reading, timeframe: "1h" }, model: "first" }),
    review: async () => ({ value: { ...reading, timeframe: "1d" }, model: "second" }),
  }, 1);
  assert.equal(result.result.review.agreement, "mixed");
  assert.equal(result.result.review.score_cap, 40);
  assert.equal(result.result.verdict, "bullish");
  assert.equal(result.result.trade_plan.status, "conditional");
  assert.ok(result.result.stockgpt_score.value <= 40);
});
test("an exit read by only one model is uncertainty rather than numeric agreement", () => {
  for (const field of ["entry", "stop_loss", "take_profit"]) {
    const first = { ...reading, trade_plan: { ...reading.trade_plan, [field]: null } };
    for (const pair of [[first, reading], [reading, first]]) {
      const result = assessChartReview(...pair, true);
      assert.equal(result.agreement, "mixed");
      assert.equal(result.score_cap, 55);
    }
  }
});
test("both readers must identify a closed candle formation before completion is claimed", () => {
  const present = { id: "bullish-engulfing", context_confirmed: true, candles_visible: 2, completed: true,
    confidence: 88, evidence: "The two latest bodies engulf after a visible decline." };
  const audit = item => ({ present: [item], absent: CANDLE_PATTERNS.map(pattern => pattern.id).filter(id => id !== present.id), unclear: [], not_applicable: [] });
  for (const completed of [false, undefined]) {
    const result = normaliseCandleAudit(audit(present), "candles", true, audit({ ...present, completed }));
    assert.equal(result.checks[0].status, "detected");
    assert.equal(result.checks[0].completed, false);
  }
  assert.equal(normaliseCandleAudit(audit(present), "candles", true, audit(present)).checks[0].completed, true);
  assert.equal(normaliseCandleAudit(audit(present), "candles", false, audit(present)).checks[0].completed, false);
});
test("a model cannot bypass the forming candle cap by repeating it in signals", () => {
  const present = { id: "bullish-engulfing", context_confirmed: true, candles_visible: 2, completed: true,
    confidence: 88, evidence: "The two latest bodies engulf after a visible decline." };
  const audit = item => ({ present: [item], absent: CANDLE_PATTERNS.map(pattern => pattern.id).filter(id => id !== present.id), unclear: [], not_applicable: [] });
  const first = { ...reading, candle_audit: audit({ ...present, completed: false }) };
  const final = { ...reading, candle_audit: audit(present), signals: [{ ...reading.signals[0], name: "Bullish engulfing", kind: "candle", confidence: 99 }] };
  const result = normaliseChartScan(final, normaliseChartLayout({ price_series_type: "candles" }, 1), true, null, undefined, first);
  assert.equal(result.candle_audit.checks[0].completed, false);
  assert.equal(result.signals[0].confidence, 65);
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
test("readable estimated risk levels do not receive the same estimate penalty twice", () => {
  const signals = [{ kind: "structure", name: "Support holds after a pullback", bias: "bullish", confidence: 75 }];
  const estimatedReading = { ...reading, confidence: 75, trade_plan: { ...reading.trade_plan, levels_basis: "estimated" } };
  const plan = buildTradeScenario(estimatedReading, { usable: true, reviewed: true, signals, patterns: [] });
  assert.equal(plan.status, "estimated");
  const score = stockGPTScore(75, plan, true, signals, []);
  assert.equal(score.value, 52);
  assert.match(score.reasons.join(" "), /Risk levels include estimates/);
  assert.equal(stockGPTScore(99, plan, true, signals, []).value, 60);
  assert.ok(stockGPTScore(35, plan, true, signals, []).value < 50);
  assert.ok(stockGPTScore(99, plan, false, signals, []).value <= 40);
});
test("strong reviewed evidence can exceed 50 without manufacturing an 80-plus score", () => {
  const price = { kind: "structure", name: "Confirmed support reaction", bias: "bullish", confidence: 85 };
  const momentum = { kind: "indicator", name: "RSI recovery", bias: "bullish", confidence: 85 };
  const plan = buildTradeScenario(reading, { usable: true, reviewed: true, signals: [price, momentum], patterns: [] });
  const score = stockGPTScore(85, plan, true, [price, momentum], []);
  assert.equal(score.value, 75);
  const opposed = stockGPTScore(85, plan, true, [price, momentum,
    { kind: "volume", name: "Weak participation on the bounce", bias: "bearish", confidence: 85 }], []);
  assert.ok(opposed.value < score.value);
  assert.ok(stockGPTScore(35, plan, true, [price], []).value < 50);
  assert.ok(stockGPTScore(99, plan, true, [], []).value <= 35);
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
