import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

// Render the real client components without a browser. Check the regressions
// where changing evidence views previously removed the main chart and exits.
const require = createRequire(import.meta.url);
const Module = require("node:module"), ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  if (request.startsWith("@/")) request = path.join(root, request.slice(2));
  return originalResolve.call(this, request, parent, ...args);
};
for (const suffix of [".ts", ".tsx"]) require.extensions[suffix] = (module, file) => {
  module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
};
require.extensions[".css"] = module => { module.exports = new Proxy({}, { get: (_target, key) => key === "__esModule" ? false : key }); };
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { ChartScanPreview } = require("../components/ChartScanPreview.tsx");
const { ChartScanAnalysis } = require("../components/ChartScanAnalysis.tsx");
const { ChartScannerWorkspace } = require("../components/ChartScannerWorkspace.tsx");
const { normaliseChartLayout, normaliseChartScan } = require("../lib/chart-scanner.ts");
const { CANDLE_PATTERNS, SCANNER_CAPABILITY_STATS, CANDLE_LOOKBACK } = require("../lib/chart-scan-candles.ts");
const { SCANNER_INDICATOR_CATALOG } = require("../lib/chart-scan-indicators.ts");
const plot = { x_pct: 5, y_pct: 8, width_pct: 80, height_pct: 64 };
const axis = { scale: "linear", ticks: [{ price: 91.5, y_pct: 16 }, { price: 89.5, y_pct: 32 }, { price: 87.5, y_pct: 48 }] };
const raw = { verdict: "bullish", confidence: 75, current_price: "87.5", price_series_type: "candles", chart_coverage: "full", summary: "Two separate troughs hold the same level.", indicator_checks: [], signals: [{ name: "Two troughs", kind: "structure", bias: "bullish", confidence: 75, evidence: "Two separate troughs have an intervening rally.", region_id: "price", source_image: 0, supported: true }], candle_audit: { present: [], absent: CANDLE_PATTERNS.map(pattern => pattern.id), unclear: [], not_applicable: [] }, trade_plan: { side: "long", entry: "87.5", stop_loss: "85.5", take_profit: "91.5", price_scale_readable: true }, overlay: { price_plot_confirmed: true, price_plot_box: plot, price_axis_confirmed: true, price_axis: axis } };
const make = (changes = {}) => normaliseChartScan({ ...raw, ...changes }, normaliseChartLayout({ price_series_type: "candles", price_plot_box: plot, price_axis: axis }, 1), true, null, undefined, raw);
const box1 = { x_pct: 20, y_pct: 50, width_pct: 10, height_pct: 12 }, box2 = { ...box1, x_pct: 45 };
const pattern = { name: "Double bottom", kind: "pattern", bias: "bullish", confidence: 80, evidence: "Two troughs have an intervening rally.", region_id: "price", source_image: 0, box: box1, boxes: [box1, box2] };
const supporting = { ...pattern, name: "RSI recovery", kind: "indicator", region_id: "indicator-1", source_image: 1, boxes: [box1] };
const preview = (result, props = {}) => renderToStaticMarkup(React.createElement(ChartScanPreview, { src: "/main.png", supportingSrc: "/support.png", result, ...props }));

test("selecting a supporting indicator keeps the primary chart and all visible Open/SL/TP lines", () => {
  const result = make(); result.signals = [pattern, supporting];
  const html = preview(result, { focusedSignal: 1 });
  const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(images.slice(0, 2), ["/main.png", "/support.png"]);
  for (const text of ["Open 87.50", "SL 85.50", "TP 91.50"]) assert.ok(html.includes(text), `missing ${text}`);
  assert.ok(html.includes("Indicator close-up"));
  assert.ok(!html.includes("Hide plan"));
});
test("both verified trough boxes are translucent and visible on the initial result", () => {
  const result = make(); result.signals = [pattern];
  const html = preview(result);
  assert.ok(html.includes('fill-opacity="0.2"'));
  assert.ok(html.includes('x="20" y="50" width="10" height="12"'));
  assert.ok(html.includes('x="45" y="50" width="10" height="12"'));
  assert.ok(html.includes("Patterns on"));
});
test("chart UI is masked locally while calibrated exit lines remain available", () => {
  const result = make(); result.overlay.exclusions = [box1];
  const html = preview(result);
  assert.ok(html.includes('<mask'));
  assert.ok(html.includes('width="10" height="12" fill="black"'));
  assert.ok(html.includes('mask="url('));
  assert.ok(html.includes("SL 85.50"));
});
test("off-screen targets have explicit labels and unreadable scales explain how to restore accurate lines", () => {
  const result = make({ trade_plan: { ...raw.trade_plan, take_profit: "101.5" } });
  assert.ok(preview(result).includes("TP 101.50 · outside screenshot"));
  const unclear = make({ overlay: { ...raw.overlay, price_axis: { scale: "unknown", ticks: [] } } });
  assert.ok(preview(unclear).includes("use a clearer screenshot to place them accurately"));
});
test("the landing screen has Beta and the capability catalog without haptic intensity controls", () => {
  const html = renderToStaticMarkup(React.createElement(ChartScannerWorkspace));
  for (const text of ["Beta", "How it works", "Read the candles.", "See the trade.", "Scan my screenshot", "50+ candle patterns"]) assert.ok(html.includes(text), `missing ${text}`);
  for (const pattern of CANDLE_PATTERNS) assert.ok(html.includes(pattern.name), `missing ${pattern.name}`);
  assert.ok(html.includes('role="tablist"'));
  assert.ok(!html.includes('Scanner haptic strength'));
  assert.ok(html.includes('data-native-haptics="managed"'));
});
test("landing indicator claims reflect the recognisable catalog and readable candle limit", () => {
  const html = renderToStaticMarkup(React.createElement(ChartScannerWorkspace));
  for (const stat of SCANNER_CAPABILITY_STATS) {
    assert.ok(html.includes(`>${stat.value}</strong><span>${stat.label}</span><small>${stat.detail}</small>`), `missing ${stat.value} ${stat.label}`);
  }
  assert.ok(html.includes(`50+ candle patterns and ${SCANNER_INDICATOR_CATALOG.length} named technical indicators`));
  assert.ok(html.includes(`looking back up to ${CANDLE_LOOKBACK} readable completed candles`));
  assert.ok(html.includes("Indicators need visible labels and plots; hidden values are never calculated"));
  assert.ok(!html.includes("possible checks"));
});
test("a result exposes its complete candle audit alongside plain-language prices, timing and contrary evidence", () => {
  const result = make();
  const html = renderToStaticMarkup(React.createElement(ChartScanAnalysis, { result, src: "/main.png", supportingSrc: null, askHref: "/ask-stockgpt", onReset() {}, onAddContext() {}, onReference() {} }));
  for (const text of ["Open / entry", "Stop loss", "Take profit", "StockGPT Score", "When could it happen?", "What could spoil the trade?", "44 / 44", "See all 44 pattern checks"]) assert.ok(html.includes(text), `missing ${text}`);
  assert.ok(!/NaN|undefined/.test(html));
});

test("an inconclusive chart cannot be advertised as a bullish or bearish finding from its fallback plan side", () => {
  const result = make(); result.verdict = "inconclusive"; result.trade_plan.levels_basis = "estimated";
  const html = renderToStaticMarkup(React.createElement(ChartScanAnalysis, { result, src: "/main.png", supportingSrc: null, askHref: "/ask-stockgpt", onReset() {}, onAddContext() {}, onReference() {} }));
  assert.ok(html.includes("No clear edge"));
  assert.ok(html.includes("Mixed chart evidence"));
  assert.ok(!html.includes("Upward bias"));
  assert.ok(!html.includes("Downward bias"));
});
test("missing defensible exit prices do not claim that the screenshot price is unreadable", () => {
  const result = make(); result.trade_plan.stop_loss = null; result.trade_plan.take_profit = null;
  const html = renderToStaticMarkup(React.createElement(ChartScanAnalysis, { result, src: "/main.png", supportingSrc: null, askHref: "/ask-stockgpt", onReset() {}, onAddContext() {}, onReference() {} }));
  assert.ok(html.includes("Not established"));
  assert.ok(!html.includes("Price not readable"));
});
test("nearby entry and exit lines put compact labels in separate horizontal lanes", () => {
  const result = make(); result.overlay.trade_lines = [
    { kind: "entry", price: "87.50", y_pct: 48 },
    { kind: "stop", price: "87.49", y_pct: 48.1 },
    { kind: "target", price: "87.51", y_pct: 47.9 },
  ];
  const html = preview(result);
  const labels = [...html.matchAll(/style="top:[^;]+;left:([^;]+);[^"]*"[^>]*>(Open|SL|TP)<\/span>/g)];
  assert.ok(labels.length >= 3);
  assert.equal(new Set(labels.slice(0, 3).map(match => match[1])).size, 3);
  for (const value of ["Open 87.50", "SL 87.49", "TP 87.51"]) assert.ok(html.includes(value));
});
