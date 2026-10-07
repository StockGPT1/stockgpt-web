import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { buildChartImageGuides, detectAxisLabelBands } from "../lib/chart-scan-images.ts";
import { pixelAnchoredAxis, cropBoxToImage, matchedEvidenceBoxes } from "../lib/chart-scan-coordinates.ts";
import { calibratePriceAxis, priceToY } from "../lib/chart-scan-scenario.ts";
import { normaliseChartLayout, normaliseChartScan } from "../lib/chart-scanner.ts";
import { buildScanTimeline, chartTimeframeMinutes } from "../lib/chart-scan-timeline.ts";

const plot = { x_pct: 5, y_pct: 8, width_pct: 80, height_pct: 64 };
const labelledChart = (dark = false, inverted = false) => Buffer.from(`<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="${dark ? '#131722' : 'white'}"/>${[91.5,89.5,87.5,85.5].map((p, i) => { const y = 80 + i * 80; return `<path d="M40 ${y}H680" stroke="${dark ? '#252a35' : '#e5e7eb'}"/><text x="690" y="${y + 6}" font-family="sans-serif" font-size="18" fill="${dark ? 'white' : '#111827'}">${inverted ? 85.5 + i * 2 : p}</text>`; }).join('')}<path d="M70 160L140 300L220 220L320 300L420 190L510 260L620 160" fill="none" stroke="#10b981" stroke-width="3"/></svg>`);
const rawLayout = { price_series_type: "price_line", price_plot_box: plot, indicators: [], exclusions: [] };

test("real light/dark price-label pixels place 87.5 on its row, never on 89.5", async () => {
  for (const dark of [false, true]) {
    const pixels = await sharp(labelledChart(dark)).png().toBuffer();
    const bundle = await buildChartImageGuides([pixels], normaliseChartLayout(rawLayout, 1));
    const rows = bundle.geometry.axis_rows.filter(row => row.id.startsWith("right-"));
    assert.equal(rows.length, 4);
    const reading = { axis_id: "right", scale: "linear", ticks: rows.map((row, i) => ({ row_id: row.id, price: 91.5 - i * 2, y_pct: 1 })) };
    const axis = pixelAnchoredAxis(reading, bundle.geometry.axis_rows);
    const calibration = calibratePriceAxis(axis, axis);
    const y = priceToY(87.5, calibration, plot.y_pct, plot.height_pct);
    assert.ok(Math.abs(y * 5 - 240) <= 3, `87.5 must be at its printed row, got ${y * 5}px`);
    assert.ok(Math.abs(y - rows[1].y_pct) > 15, "87.5 must not use the 89.5 label row");
    assert.equal(bundle.geometry.frames[0].id, "price");
    assert.ok(bundle.guides.length >= 2);
  }
});

test("pixel labels retain correct orientation on inverted axes", async () => {
  const image = await sharp(labelledChart(false, true)).png().toBuffer();
  const { geometry } = await buildChartImageGuides([image], normaliseChartLayout(rawLayout, 1));
  const rows = geometry.axis_rows.filter(row => row.id.startsWith("right-"));
  const axis = pixelAnchoredAxis({ scale: "linear", ticks: rows.map((row, i) => ({ row_id: row.id, price: 85.5 + i * 2 })) }, rows);
  assert.ok(Math.abs(priceToY(87.5, calibratePriceAxis(axis, axis), 8, 64) * 5 - 160) <= 3);
});

test("unknown row ids and model-supplied y coordinates cannot move price anchors", () => {
  const rows = [{ id: "right-1", y_pct: 20 }, { id: "right-2", y_pct: 40 }, { id: "right-3", y_pct: 60 }];
  const ticks = rows.map((row, i) => ({ row_id: row.id, price: 91.5 - i * 2, y_pct: 99 }));
  assert.deepEqual(pixelAnchoredAxis({ scale: "linear", ticks }, rows).ticks.map(tick => tick.y_pct), [20,40,60]);
  assert.equal(pixelAnchoredAxis({ ticks: [{ row_id: "made-up", price: 87.5, y_pct: 60 }] }, rows).ticks.length, 0);
});

test("solid backgrounds and gridline-only strips never become label anchors", () => {
  const width = 90, height = 300, pixels = new Uint8Array(width * height).fill(20);
  for (const y of [30, 100, 200]) for (let x = 0; x < width; x++) pixels[y * width + x] = 220;
  assert.deepEqual(detectAxisLabelBands(pixels, width, height, 1), []);
});

const frame = { id: "price", source_image: 0, box: plot };
const troughs = [{ x_pct: 14, y_pct: 70, width_pct: 10, height_pct: 20 }, { x_pct: 43, y_pct: 70, width_pct: 10, height_pct: 20 }];
test("crop-local troughs convert to full-image boxes on the actual two troughs", () => {
  assert.deepEqual(cropBoxToImage(troughs[0], frame), { x_pct: 16.200000000000003, y_pct: 52.8, width_pct: 8, height_pct: 12.8 });
  const agreed = matchedEvidenceBoxes(troughs, troughs.map(b => ({ ...b, x_pct: b.x_pct + 1 })), frame);
  assert.equal(agreed.length, 2);
  assert.ok(agreed.every(b => b.y_pct > plot.y_pct && b.y_pct + b.height_pct <= plot.y_pct + plot.height_pct));
  assert.ok(agreed[0].x_pct < agreed[1].x_pct);
});
test("off-screen, wrong-frame and disagreement boxes fail rather than being clamped", () => {
  assert.equal(cropBoxToImage({ ...troughs[0], x_pct: 99 }, frame), null);
  assert.equal(cropBoxToImage({ ...troughs[0], y_pct: "70" }, frame), null);
  assert.deepEqual(matchedEvidenceBoxes(troughs, [{ ...troughs[0], x_pct: 75 }], frame), []);
});

const pattern = { name: "Double bottom", status: "forming", evidence: "Two troughs separated by an intervening rally.", two_swings_visible: true, intervening_swing_visible: true, frame_id: "price", evidence_boxes: troughs, localisation_confirmed: true, localisation_confidence: 90 };
const analysis = { verdict: "bullish", confidence: 70, price_series_type: "price_line", summary: "Two troughs are forming.", current_price: "87.5", timeframe: "1h", signals: [], indicator_checks: [], pattern_checks: [pattern], trade_plan: { entry: "87.5", stop_loss: "85.5", take_profit: "91.5", price_scale_readable: true }, overlay: { price_plot_confirmed: true, price_plot_box: plot, price_axis_confirmed: true, price_axis: { axis_id: "right", scale: "linear", ticks: [{ row_id: "right-1", price: 91.5 }, { row_id: "right-2", price: 89.5 }, { row_id: "right-3", price: 87.5 }] } } };
const geometry = { axis_rows: [{ id: "right-1", y_pct: 16 }, { id: "right-2", y_pct: 32 }, { id: "right-3", y_pct: 48 }], frames: [frame], image_sizes: [{ width: 800, height: 500 }] };
const finalRead = (value = analysis, meta = geometry) => normaliseChartScan(value, normaliseChartLayout(rawLayout, 1), true, null, { geometry: meta, candidate: analysis });

test("normalised result couples exact open price to native row and preserves two trough highlights", () => {
  const result = finalRead();
  assert.equal(result.overlay.trade_lines.find(line => line.kind === "entry").price, "87.50");
  assert.equal(result.overlay.trade_lines.find(line => line.kind === "entry").y_pct, 48);
  assert.equal(result.signals[0].boxes.length, 2);
  assert.deepEqual(result.overlay.image_sizes, geometry.image_sizes);
});
test("server geometry never falls back to guessed percentages when native rows are missing", () => {
  const result = finalRead({ ...analysis, overlay: { ...analysis.overlay, price_axis: { scale: "linear", ticks: [{ price: 91.5, y_pct: 16 }, { price: 89.5, y_pct: 32 }, { price: 87.5, y_pct: 48 }] } } }, { ...geometry, axis_rows: [] });
  assert.equal(result.overlay.calibration_status, "unavailable");
  assert.deepEqual(result.overlay.trade_lines, []);
  assert.ok(result.trade_plan.stop_loss && result.trade_plan.take_profit);
});
test("a finding naming a nonexistent crop gets no highlight", () => {
  const result = finalRead({ ...analysis, pattern_checks: [{ ...pattern, frame_id: "other-pane" }] });
  assert.deepEqual(result.signals[0].boxes, []);
});

test("timeline converts valid candle ranges to chart time with explicit entry/target origins", () => {
  const timeline = buildScanTimeline({ entry_min_bars: 1, entry_max_bars: 3, target_min_bars: 6, target_max_bars: 12, reassess_bars: 5, basis: "Visible swings take about six bars." }, "1h", false, false);
  assert.match(timeline.entry, /Next 1–3 candles · 1h–3h/);
  assert.match(timeline.target, /6–12 candles · 6h–12h.*after entry/);
  assert.match(timeline.reassess, /after 5 candles/);
  assert.equal(timeline.quality, "estimated");
});
test("unreadable timeframes retain candle counts, and invalid timing is explicitly illustrative", () => {
  const value = { entry_min_bars: 1, entry_max_bars: 2, target_min_bars: 5, target_max_bars: 10, reassess_bars: 4 };
  assert.ok(!buildScanTimeline(value, null, false, false).entry.includes("chart time"));
  for (const raw of [{}, { ...value, target_min_bars: 20 }, { ...value, entry_min_bars: "1" }, { ...value, reassess_bars: 0 }]) assert.equal(buildScanTimeline(raw, "1h", false, false).quality, "illustrative");
  assert.equal(chartTimeframeMinutes("1M"), null);
  assert.equal(chartTimeframeMinutes("15m"), 15);
  assert.equal(chartTimeframeMinutes("4h"), 240);
  assert.equal(chartTimeframeMinutes("Daily"), 1440);
});

test("pattern geometry survives when the same pattern is also listed as a signal", () => {
  const signal = { name: "Double bottom forming", kind: "pattern", bias: "bullish", confidence: 70, evidence: pattern.evidence, region_id: "price", source_image: 0, supported: true };
  const result = finalRead({ ...analysis, signals: [signal] });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].boxes.length, 2);
});

test("supplementary indicator highlights stay in the supporting image's coordinate frame", () => {
  const pane = { x_pct: 10, y_pct: 50, width_pct: 80, height_pct: 30 };
  const mapped = normaliseChartLayout({ ...rawLayout, indicators: [{ name: "RSI", source_image: 1, placement: "panel", readable: true, box: pane }] }, 2);
  const signal = { name: "RSI recovers above 50", kind: "indicator", bias: "bullish", confidence: 70, evidence: "RSI rises above its midline in the supporting image.", region_id: "indicator-1", source_image: 1, supported: true, frame_id: "indicator-1", localisation_confirmed: true, localisation_confidence: 92, evidence_boxes: [{ x_pct: 40, y_pct: 20, width_pct: 20, height_pct: 40 }] };
  const candidate = { ...analysis, signals: [signal], indicator_checks: [{ id: "indicator-1", name: "RSI", status: "readable", finding: signal.evidence }] };
  const result = normaliseChartScan(candidate, mapped, true, null, { candidate, geometry: { ...geometry, frames: [...geometry.frames, { id: "indicator-1", source_image: 1, box: pane }], image_sizes: [{ width: 800, height: 500 }, { width: 600, height: 400 }] } });
  assert.equal(result.signals[0].source_image, 1);
  assert.equal(result.signals[0].boxes.length, 1);
  assert.equal(result.signals[0].boxes[0].y_pct, 56);
});

test("independent readers can agree on a location without copying a finding's wording", () => {
  const signal = { name: "Support holds at the swing low", kind: "structure", bias: "bullish", confidence: 70, evidence: "Buying holds the same visible low.", region_id: "price", source_image: 0, supported: true, frame_id: "price", localisation_confirmed: true, localisation_confidence: 92, evidence_boxes: [troughs[0]] };
  const candidate = { ...analysis, signals: [signal], pattern_checks: [] };
  const result = normaliseChartScan({ ...candidate, signals: [{ ...signal, name: "Buyers defend the recent low" }] }, normaliseChartLayout(rawLayout, 1), true, null, { geometry, candidate });
  assert.equal(result.signals[0].boxes.length, 1);
});
test("pattern labels can differ in forming/confirmed wording while matching both actual troughs", () => {
  const result = finalRead({ ...analysis, pattern_checks: [{ ...pattern, name: "Double bottom forming" }] });
  assert.equal(result.signals[0].boxes.length, 2);
});
test("different candle families cannot confirm each other's overlapping locations", () => {
  const candle = { name: "Bullish hammer", kind: "candle", bias: "bullish", confidence: 70, evidence: "The latest body has a long lower wick.", region_id: "price", source_image: 0, supported: true, frame_id: "price", localisation_confirmed: true, localisation_confidence: 92, evidence_boxes: [troughs[0]] };
  const candidate = { ...analysis, price_series_type: "candles", signals: [candle], pattern_checks: [] };
  const mapped = normaliseChartLayout({ ...rawLayout, price_series_type: "candles" }, 1);
  const result = normaliseChartScan({ ...candidate, signals: [{ ...candle, name: "Bullish engulfing" }] }, mapped, true, null, { geometry, candidate });
  assert.equal(result.signals[0].boxes.length, 0);
});
test("a low-confidence first localisation cannot authorise the second reader's highlight", () => {
  const candidate = { ...analysis, pattern_checks: [{ ...pattern, localisation_confidence: 30 }] };
  const result = normaliseChartScan(analysis, normaliseChartLayout(rawLayout, 1), true, null, { geometry, candidate });
  assert.equal(result.signals[0].boxes.length, 0);
});
test("opposite interpretations of the same candle cannot confirm a highlight", () => {
  const candle = { name: "Bullish engulfing", kind: "candle", bias: "bullish", confidence: 70, evidence: "The green body covers the prior red body.", region_id: "price", source_image: 0, supported: true, frame_id: "price", localisation_confirmed: true, localisation_confidence: 92, evidence_boxes: [troughs[0]] };
  const candidate = { ...analysis, price_series_type: "candles", signals: [candle], pattern_checks: [] };
  const mapped = normaliseChartLayout({ ...rawLayout, price_series_type: "candles" }, 1);
  const result = normaliseChartScan({ ...candidate, signals: [{ ...candle, name: "Bearish engulfing", bias: "bearish" }] }, mapped, true, null, { geometry, candidate });
  assert.equal(result.signals[0].boxes.length, 0);
});
