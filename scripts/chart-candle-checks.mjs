import assert from "node:assert/strict";
import test from "node:test";
import { CANDLE_PATTERNS, candlePatternId, hasCompleteCandleAudit, normaliseCandleAudit } from "../lib/chart-scan-candles.ts";
import { CHART_ANALYSIS_PROMPT, CHART_REVIEW_INSTRUCTION } from "../lib/chart-scanner-prompts.ts";
import { normaliseChartLayout, normaliseChartScan, isChartAnalysis } from "../lib/chart-scanner.ts";
import { scannerHaptic, scannerHapticMode, setScannerHaptics, subscribeScannerHaptics } from "../lib/chart-scan-haptics.ts";

const ids = CANDLE_PATTERNS.map(pattern => pattern.id);
const audit = (present = []) => ({ present, absent: ids.filter(id => !present.some(item => item.id === id)), unclear: [], not_applicable: [] });
const candle = (id = "bullish-engulfing", changes = {}) => ({ id, context_confirmed: true, candles_visible: 2, completed: true, confidence: 88,
  evidence: "The two latest bodies form an engulfing reversal after a visible decline.", frame_id: "price", localisation_confirmed: true, localisation_confidence: 90,
  evidence_boxes: [{ x_pct: 30, y_pct: 30, width_pct: 8, height_pct: 20 }], ...changes });
const plot = { x_pct: 5, y_pct: 8, width_pct: 80, height_pct: 64 };
const axis = { axis_id: "right", scale: "linear", ticks: [91.5, 89.5, 87.5, 85.5].map((price, index) => ({ row_id: `right-${index + 1}`, price })) };
const geometry = { axis_rows: axis.ticks.map((tick, index) => ({ id: tick.row_id, y_pct: 16 + index * 16 })), frames: [{ id: "price", source_image: 0, box: plot }], image_sizes: [{ width: 800, height: 500 }] };
const layout = normaliseChartLayout({ price_series_type: "candles", price_plot_box: plot, indicators: [], exclusions: [] }, 1);
const reading = (changes = {}) => ({ verdict: "bullish", confidence: 90, summary: "Buying pressure is improving after a declining swing.", price_series_type: "candles", chart_coverage: "full", current_price: "87.5", timeframe: "1h", candle_audit: audit([candle()]), signals: [], indicator_checks: [],
  trade_plan: { side: "long", entry: "87.5", stop_loss: "85.5", take_profit: "91.5", activation: "conditional", price_scale_readable: true, levels_basis: "structure" },
  overlay: { price_plot_confirmed: true, price_plot_box: plot, price_axis_confirmed: true, price_axis: axis }, ...changes });
const read = (final = reading(), first = reading(), mapped = layout, meta = geometry, reviewed = true) => normaliseChartScan(final, mapped, reviewed, null, { geometry: meta, candidate: first }, first);

test("the advertised checklist has 44 distinct named patterns with contextual rules", () => {
  assert.equal(ids.length, 44);
  assert.equal(new Set(ids).size, 44);
  assert.equal(new Set(CANDLE_PATTERNS.map(pattern => pattern.name)).size, 44);
  assert.ok(CANDLE_PATTERNS.every(pattern => pattern.rule.length > 40 && pattern.candles >= 1));
  for (const id of ids) assert.ok(CHART_ANALYSIS_PROMPT.includes(id), `analysis missing ${id}`);
  assert.match(CHART_REVIEW_INSTRUCTION, /ENTIRE mandatory candle checklist independently/);
});
test("API validation rejects a silently missing candle check, duplicate or invented pattern", () => {
  assert.equal(isChartAnalysis(reading(), true), true);
  for (const value of [undefined, { ...audit(), absent: ids.slice(1) }, { ...audit(), absent: [...ids, ids[0]] }, { ...audit(), absent: [...ids.slice(1), "invented-pattern"] }, { ...audit([candle()]), unclear: [ids[0]] }]) {
    assert.equal(hasCompleteCandleAudit(value, "candles"), false);
    assert.equal(isChartAnalysis(reading({ candle_audit: value }), true), false);
  }
});
test("line and unsupported charts require all candle ids to be explicitly inapplicable", () => {
  for (const series of ["price_line", "unknown", "unsupported"]) {
    assert.equal(hasCompleteCandleAudit(audit(), series), false);
    assert.equal(hasCompleteCandleAudit({ present: [], absent: [], unclear: [], not_applicable: ids }, series), true);
    const result = normaliseCandleAudit(audit([candle()]), series, true, audit([candle()]));
    assert.equal(result.applicable, false);
    assert.equal(result.detected, 0);
    assert.ok(result.checks.every(check => check.status === "not_applicable"));
  }
  assert.equal(hasCompleteCandleAudit({ present: [], absent: [], unclear: [], not_applicable: ids }, "candles"), false);
});
test("a shape without context, neighbouring candles or evidence cannot become an agreed pattern", () => {
  for (const changes of [{ context_confirmed: false }, { candles_visible: 1 }, { candles_visible: "2" }, { confidence: 59 }, { confidence: NaN }, { evidence: "A candle" }]) {
    const result = normaliseCandleAudit(audit([candle("bullish-engulfing", changes)]), "candles", true, audit([candle()]));
    assert.equal(result.checks[0].status, "unclear");
    assert.equal(result.detected, 0);
  }
});
test("the first reader must also establish context and confidence, not just name a pattern", () => {
  for (const changes of [{ context_confirmed: false }, { candles_visible: 1 }, { confidence: 20 }, { confidence: Infinity }, { evidence: "guess" }]) {
    assert.equal(normaliseCandleAudit(audit([candle()]), "candles", true, audit([candle("bullish-engulfing", changes)])).checks[0].status, "unconfirmed");
  }
});
test("one reader's pattern and an unavailable review stay visibly unconfirmed", () => {
  assert.equal(normaliseCandleAudit(audit([candle()]), "candles", true, audit()).checks[0].status, "unconfirmed");
  assert.equal(normaliseCandleAudit(audit([candle()]), "candles", false, audit([candle()])).checks[0].status, "unconfirmed");
});
test("a still-forming candle is disclosed and does not receive completed-pattern confidence", () => {
  const result = read(reading({ candle_audit: audit([candle("bullish-engulfing", { completed: false })]) }));
  assert.equal(result.candle_audit.checks[0].completed, false);
  assert.equal(result.signals[0].confidence, 65);
});
test("engulfing, hammer, inverted hammer, harami cross and doji star keep separate identities", () => {
  for (const [name, id] of [["Inverted hammer at support", "inverted-hammer"], ["Hammer at support", "hammer"], ["Bullish harami cross at the swing", "bullish-harami-cross"], ["Bullish harami at support", "bullish-harami"], ["Morning doji star", "morning-doji-star"], ["Morning star", "morning-star"], ["Dragonfly doji", "dragonfly-doji"]]) assert.equal(candlePatternId(null, name), id);
  assert.equal(candlePatternId(null, "Generic candlesticks"), null);
});
test("agreed candle checks become named findings with verified crop-local highlights", () => {
  const result = read();
  assert.equal(result.candle_audit.checked, 44);
  assert.equal(result.candle_audit.detected, 1);
  assert.equal(result.signals[0].name, "Bullish engulfing");
  assert.deepEqual(result.signals[0].boxes, [{ x_pct: 29, y_pct: 27.2, width_pct: 6.4, height_pct: 12.8 }]);
});
test("disagreeing candle positions, wrong frames and low localisation do not draw boxes", () => {
  for (const changes of [{ frame_id: "toolbar" }, { localisation_confidence: 79 }, { evidence_boxes: [{ x_pct: 70, y_pct: 30, width_pct: 8, height_pct: 20 }] }, { evidence_boxes: [{ x_pct: 99, y_pct: 30, width_pct: 8, height_pct: 20 }] }]) {
    const result = read(reading({ candle_audit: audit([candle("bullish-engulfing", changes)]) }));
    assert.equal(result.candle_audit.detected, 1);
    assert.equal(result.signals[0].boxes.length, 0);
  }
});
test("a candle check covering chart UI remains text-only", () => {
  const mapped = { ...layout, exclusions: [{ x_pct: 29, y_pct: 27.2, width_pct: 6.4, height_pct: 2 }] };
  assert.equal(read(reading(), reading(), mapped).signals[0].boxes.length, 0);
});
test("candle signals cannot evade an audit that did not establish that pattern", () => {
  const fake = { name: "Bullish engulfing", kind: "candle", bias: "bullish", confidence: 99, evidence: "The latest candle allegedly engulfs the previous one.", region_id: "price", source_image: 0, supported: true };
  assert.equal(read(reading({ candle_audit: audit(), signals: [fake] })).signals.length, 0);
});
test("a full candle roster cannot crowd a forming double bottom out of the finding list", () => {
  const candles = CANDLE_PATTERNS.slice(0, 16).map(pattern => candle(pattern.id, { candles_visible: pattern.candles }));
  const value = reading({ candle_audit: audit(candles), pattern_checks: [{ name: "Double bottom", status: "forming", evidence: "Two distinct troughs have an intervening rally.", two_swings_visible: true, intervening_swing_visible: true }] });
  assert.ok(read(value, value).signals.some(signal => signal.name === "Double bottom"));
});
test("incomplete or mostly unreadable candle coverage lowers setup confidence", () => {
  for (const checklist of [{ ...audit(), absent: ids.slice(0, 20) }, { ...audit(), absent: [], unclear: ids }]) {
    const result = read(reading({ candle_audit: checklist, signals: [{ name: "RSI recovery", kind: "structure", bias: "bullish", confidence: 99, evidence: "Buying pressure is improving.", region_id: "price", source_image: 0, supported: true }] }));
    assert.ok(result.stockgpt_score.value <= 55);
    assert.match(result.stockgpt_score.reasons.join(" "), /checklist incomplete|patterns could not be read/);
  }
});
test("verified numeric exits are visible even on a cautious estimated scenario", () => {
  const value = reading({ confidence: 10, overlay: { price_plot_confirmed: false, price_plot_box: plot, price_axis_confirmed: false, price_axis: axis } });
  const result = read(value, value);
  assert.equal(result.overlay.calibration_status, "matched");
  assert.deepEqual(result.overlay.trade_lines.map(line => [line.kind, line.price, line.y_pct]), [["entry", "87.50", 48], ["stop", "85.50", 64], ["target", "91.50", 16]]);
});
test("UI crossing one segment does not remove an entire stop or target line", () => {
  const exclusion = { x_pct: 12, y_pct: 63, width_pct: 6, height_pct: 2 };
  const result = read(reading(), reading(), { ...layout, exclusions: [exclusion] });
  assert.ok(result.overlay.trade_lines.some(line => line.kind === "stop" && line.y_pct === 64));
  assert.ok(result.overlay.exclusions.includes(exclusion));
});
test("off-screen exits are listed explicitly and never clamped to the image edge", () => {
  const value = reading({ trade_plan: { ...reading().trade_plan, take_profit: "101.5" } });
  const result = read(value, value);
  assert.equal(result.trade_plan.take_profit, "101.50");
  assert.deepEqual(result.overlay.off_chart_levels, [{ kind: "target", price: "101.50" }]);
  assert.ok(!result.overlay.trade_lines.some(line => line.kind === "target"));
});
test("unreadable or mismatched labels never produce guessed exit lines or false off-screen claims", () => {
  for (const ticks of [[], [{ row_id: "right-1", price: 91.5 }], axis.ticks.map(tick => ({ ...tick, price: tick.price + 2 }))]) {
    const result = read(reading({ overlay: { ...reading().overlay, price_axis: { ...axis, ticks } } }));
    assert.deepEqual(result.overlay.trade_lines, []);
    assert.deepEqual(result.overlay.off_chart_levels, []);
    assert.equal(result.overlay.calibration_status, "unavailable");
  }
});

test("native strong, light and disabled feedback persist and respect the selected strength", () => {
  const messages = [], saved = new Map(), originalWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }, webkit: { messageHandlers: { stockgptNative: { postMessage: message => messages.push(message) } } }, addEventListener() {}, removeEventListener() {} };
  try {
    let changes = 0;
    const unsubscribe = subscribeScannerHaptics(() => changes++);
    setScannerHaptics("strong"); messages.length = 0;
    assert.equal(scannerHapticMode(), "strong");
    scannerHaptic("scan"); scannerHaptic(); scannerHaptic("open"); scannerHaptic("complete"); scannerHaptic("warning");
    assert.deepEqual(messages.map(message => message.style), ["heavy", "heavy", "heavy", "success", "warning"]);
    setScannerHaptics("light"); messages.length = 0;
    scannerHaptic("open"); scannerHaptic();
    assert.deepEqual(messages.map(message => message.style), ["medium", "light"]);
    setScannerHaptics("off"); messages.length = 0;
    assert.equal(scannerHaptic("scan"), false);
    assert.equal(scannerHaptic("complete"), false);
    assert.equal(messages.length, 0);
    assert.equal(saved.get("stockgpt.scanner.haptics"), "off");
    assert.equal(changes, 3); unsubscribe();
  } finally { globalThis.window = originalWindow; }
});
test("blocked storage and a missing native bridge do not break scanning", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } };
  try { setScannerHaptics("strong"); assert.equal(scannerHapticMode(), "strong"); assert.equal(scannerHaptic("scan"), false); }
  finally { globalThis.window = originalWindow; }
  assert.equal(scannerHaptic("scan"), false);
});
