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
const { CANDLE_PATTERNS } = require("../lib/chart-scan-candles.ts");
const plot = { x_pct: 5, y_pct: 8, width_pct: 80, height_pct: 64 };
const axis = { scale: "linear", ticks: [{ price: 91.5, y_pct: 16 }, { price: 89.5, y_pct: 32 }, { price: 87.5, y_pct: 48 }] };
const raw = { verdict: "bullish", confidence: 75, current_price: "87.5", price_series_type: "candles", chart_coverage: "full", summary: "Two separate troughs hold the same level.", indicator_checks: [], signals: [{ name: "Two troughs", kind: "structure", bias: "bullish", confidence: 75, evidence: "Two separate troughs have an intervening rally.", region_id: "price", source_image: 0, supported: true }], candle_audit: { present: [], absent: CANDLE_PATTERNS.map(pattern => pattern.id), unclear: [], not_applicable: [] }, trade_plan: { side: "long", entry: "87.5", stop_loss: "85.5", take_profit: "91.5", price_scale_readable: true }, overlay: { price_plot_confirmed: true, price_plot_box: plot, price_axis: axis } };
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
test("the landing screen has Beta, the capability catalog and an accessible native feedback preference", () => {
  const html = renderToStaticMarkup(React.createElement(ChartScannerWorkspace));
  for (const text of ["Beta", "How it works", "Read the candles.", "See the trade.", "Scan my screenshot", "44 patterns", "Strong", "Light", "Off", "Scanner haptic strength"]) assert.ok(html.includes(text), `missing ${text}`);
  for (const pattern of CANDLE_PATTERNS) assert.ok(html.includes(pattern.name), `missing ${pattern.name}`);
  assert.ok(html.includes('role="tablist"'));
});
test("a result exposes its complete candle audit alongside plain-language prices, timing and contrary evidence", () => {
  const result = make();
  const html = renderToStaticMarkup(React.createElement(ChartScanAnalysis, { result, src: "/main.png", supportingSrc: null, askHref: "/ask-stockgpt", onReset() {}, onAddContext() {}, onReference() {} }));
  for (const text of ["Open / entry", "Stop loss", "Take profit", "StockGPT Score", "When could it happen?", "What could spoil the trade?", "44 / 44", "See all 44 pattern checks"]) assert.ok(html.includes(text), `missing ${text}`);
  assert.ok(!/NaN|undefined/.test(html));
});
