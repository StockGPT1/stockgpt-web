import assert from "node:assert/strict";
import test from "node:test";
import { SCANNER_INDICATOR_CATALOG, resolveScannerIndicator, indicatorEvidenceGuidance, INDICATOR_LAYOUT_PROMPT, INDICATOR_ANALYSIS_GUIDANCE } from "../lib/chart-scan-indicators.ts";
import { CANDLE_PATTERNS } from "../lib/chart-scan-candles.ts";
import { CHART_LAYOUT_PROMPT, CHART_ANALYSIS_PROMPT, CHART_REVIEW_INSTRUCTION } from "../lib/chart-scanner-prompts.ts";

test("advertised indicator scope consists of distinct named non-candle types", () => {
  assert.ok(SCANNER_INDICATOR_CATALOG.length >= 101);
  assert.equal(new Set(SCANNER_INDICATOR_CATALOG.map(item => item.id)).size, SCANNER_INDICATOR_CATALOG.length);
  assert.equal(new Set(SCANNER_INDICATOR_CATALOG.map(item => item.name)).size, SCANNER_INDICATOR_CATALOG.length);
  const aliasOwners = new Map();
  const candleNames = new Set(CANDLE_PATTERNS.map(item => item.name.toLowerCase()));
  for (const item of SCANNER_INDICATOR_CATALOG) {
    assert.ok(item.evidence.length >= 70 && item.category, `missing visual guidance for ${item.name}`);
    assert.ok(!candleNames.has(item.name.toLowerCase()), `candle counted as indicator: ${item.name}`);
    for (const label of [item.name, ...item.aliases]) {
      const key = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
      assert.ok(!aliasOwners.has(key) || aliasOwners.get(key) === item.id, `alias collision: ${label}`);
      aliasOwners.set(key, item.id);
      assert.equal(resolveScannerIndicator(label)?.id, item.id, `unresolvable name: ${label}`);
    }
  }
  for (const name of ["Volume", "RSI", "MACD", "Stochastic", "EMA", "SMA", "VWAP", "Bollinger Bands", "Ichimoku"]) {
    assert.equal(resolveScannerIndicator(name)?.name, name);
  }
});

test("aliases and period variants do not inflate indicator identity", () => {
  for (const [label, expected] of [
    ["RSI (14, close)", "rsi"], ["RSI_14", "rsi"], ["EMA20", "ema"],
    ["MACD 12 26 close 9", "macd"], ["StochRSI", "stochastic-rsi"],
    ["Slow Stochastic", "stochastic"], ["Fast Stochastic", "stochastic"],
    ["ROCR100", "roc"], ["RMA", "smma"], ["Aroon Oscillator", "aroon"],
    ["PVT", "price-volume-trend"], ["VPT", "price-volume-trend"],
    ["Anchored VWAP", "vwap"], ["Fixed Range Volume Profile", "volume-profile"],
    ["SMI Ergodic", "true-strength"], ["Trend Strength Index", "trend-strength"],
  ]) assert.equal(resolveScannerIndicator(label)?.id, expected, label);
});

test("ambiguous abbreviations and finding prose cannot invent indicator identity", () => {
  for (const label of ["RVI", "TSI", "SMI", "MA", "Moving Average", "Blue line", "RSI recovery", "Maybe MACD", "Hammer", "ADX bullish", null, {}, "RSI".repeat(80)]) {
    assert.equal(resolveScannerIndicator(label), null, String(label));
  }
  assert.equal(resolveScannerIndicator("Relative Vigor Index")?.id, "relative-vigor");
  assert.equal(resolveScannerIndicator("Relative Volatility Index")?.id, "relative-volatility");
  assert.equal(resolveScannerIndicator("Stochastic Momentum Index")?.id, "stochastic-momentum");
});

test("catalog is included for recognition while analysis remains evidence-based and bounded", () => {
  for (const item of SCANNER_INDICATOR_CATALOG) assert.ok(CHART_LAYOUT_PROMPT.includes(item.name));
  assert.ok(CHART_LAYOUT_PROMPT.includes(INDICATOR_LAYOUT_PROMPT));
  assert.ok(CHART_LAYOUT_PROMPT.includes("up to 10 visible regions"));
  assert.ok(CHART_ANALYSIS_PROMPT.includes(INDICATOR_ANALYSIS_GUIDANCE));
  assert.ok(CHART_ANALYSIS_PROMPT.includes("visible indicator label AND its plotted evidence"));
  assert.ok(CHART_ANALYSIS_PROMPT.includes("Do not output a checklist of every catalog type"));
  assert.ok(CHART_ANALYSIS_PROMPT.includes('"name":"exact visible label or null"'));
  assert.ok(CHART_REVIEW_INSTRUCTION.includes("inventory are hypotheses, not confirmation"));
  assert.ok(CHART_REVIEW_INSTRUCTION.includes("Do not calculate absent indicator values"));
});

test("targeted guidance excludes unknown labels, deduplicates aliases and caps visible scope", () => {
  const one = indicatorEvidenceGuidance(["RSI", "RSI_14", "Relative Strength Index", "Blue line"]);
  assert.equal(one, `RSI: ${resolveScannerIndicator("RSI").evidence}`);
  const many = indicatorEvidenceGuidance(SCANNER_INDICATOR_CATALOG.map(item => item.name));
  assert.equal(many.split("\n").length, 10);
  assert.ok(many.length < 2200);
  assert.equal(indicatorEvidenceGuidance(["not present", null, {}]), "");
});
