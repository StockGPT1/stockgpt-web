import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
const source = fs.readFileSync(new URL("../components/StockChart.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Run the component's actual event handlers. Minimal hooks retain state and refs
// between renders; the browser stub lets us verify queued pointer cancellation.
function chartHarness(overrides = {}) {
  const slots = [], effects = [], frames = new Map(), scrubbed = [], haptics = [];
  let cursor = 0, frameId = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useEffect: (effect) => { effects.push(effect); },
    useId: () => "chart-test",
  };
  const chartModule = { exports: {} };
  const imports = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "@/components/RouletteNumber") return { RouletteNumber: () => null };
    if (name === "@/lib/ios-native") return { nativeHaptic: (style) => haptics.push(style) };
    throw new Error(`Unexpected chart dependency ${name}`);
  };
  new Function("require", "module", "exports", compiled)(imports, chartModule, chartModule.exports);
  const points = [
    { date: "2026-10-01T00:00:00Z", close: 100, basis: 90, pnl: 10, pnlPct: 11.11 },
    { date: "2026-10-02T00:00:00Z", close: 130, basis: 110, pnl: 20, pnlPct: 18.18 },
    { date: "2026-10-10T00:00:00Z", close: 120, basis: 110, pnl: 10, pnlPct: 9.09 },
  ];
  const props = { ticker: "Portfolio", data: { "1M": points }, initialRange: "1M", compact: true, appearance: "portfolio", color: "#f2c35f", onScrub: (point, context) => scrubbed.push({ point, context }), ...overrides };
  globalThis.window = {
    requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  function render() {
    cursor = 0;
    const tree = chartModule.exports.StockChart(props);
    const svg = find(tree, (node) => node.type === "svg");
    svg.props.ref.current = { getBoundingClientRect: () => ({ left: 0, width: 800 }) };
    return { tree, svg };
  }
  function flush() {
    const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback());
  }
  return { render, flush, frames, points, props, scrubbed, haptics, effects };
}

function all(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => all(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}
function find(tree, predicate) { return all(tree, predicate)[0]; }
function key(svg, keyName) {
  let prevented = false;
  svg.props.onKeyDown({ key: keyName, preventDefault: () => { prevented = true; } });
  return prevented;
}

test("portfolio scrub uses the nearest timestamp and returns the original value and PnL", () => {
  const chart = chartHarness();
  const { svg } = chart.render();
  // The middle point is at 1/9 of the time span, not halfway through the chart.
  svg.props.onPointerDown({ clientX: 100, isPrimary: true, button: 0 });
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[1]);
  assert.deepEqual(chart.scrubbed.at(-1).context, { range: "1M" });
  svg.props.onPointerMove({ clientX: 792 });
  chart.flush();
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2]);
  assert.equal(chart.scrubbed.at(-1).point.pnl, 10);
  assert.deepEqual(chart.haptics, ["light"]);
  svg.props.onPointerUp({ clientX: 792 });
  assert.equal(chart.scrubbed.at(-1).point, null);
});

test("keyboard scrubbing selects actual points, respects bounds, and resets on Escape", () => {
  const chart = chartHarness();
  let { svg } = chart.render();
  assert.equal(key(svg, "ArrowLeft"), true);
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[1]);
  ({ svg } = chart.render());
  key(svg, "Home");
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[0]);
  ({ svg } = chart.render());
  key(svg, "ArrowLeft");
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[0]);
  key(svg, "End");
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2]);
  ({ svg } = chart.render());
  key(svg, "ArrowRight");
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2]);
  key(svg, "Escape");
  assert.equal(chart.scrubbed.at(-1).point, null);
  assert.equal(key(svg, "Tab"), false);
  assert.deepEqual(chart.haptics, []);
});

test("blur and pointer cancellation prevent queued moves from restoring a stale value", () => {
  for (const event of ["onBlur", "onPointerCancel"]) {
    const chart = chartHarness();
    const { svg } = chart.render();
    svg.props.onPointerMove({ clientX: 100 });
    assert.equal(chart.frames.size, 1);
    svg.props[event]();
    assert.equal(chart.frames.size, 0);
    chart.flush();
    assert.deepEqual(chart.scrubbed.map((entry) => entry.point), [null]);
  }
});

test("keyboard selection cancels a pending pointer move before announcing its point", () => {
  const chart = chartHarness();
  const { svg } = chart.render();
  svg.props.onPointerMove({ clientX: 792 });
  key(svg, "Home");
  assert.equal(chart.frames.size, 0);
  chart.flush();
  assert.deepEqual(chart.scrubbed.map((entry) => entry.point), [chart.points[0]]);
});

test("portfolio appearance uses accurate currency text, scrolling, and unsmoothed line geometry", () => {
  const chart = chartHarness({ formatValue: (value) => `£${value.toFixed(2)}` });
  let { tree, svg } = chart.render();
  assert.equal(svg.props.role, "slider");
  assert.equal(svg.props.tabIndex, 0);
  assert.ok(svg.props.className.includes("touch-pan-y"));
  assert.match(svg.props["aria-valuetext"], /£120\.00/);
  const line = find(tree, (node) => node.props?.className === "sg-stock-chart-line");
  assert.equal(line.props.strokeWidth, 2);
  assert.equal(line.props.vectorEffect, "non-scaling-stroke");
  assert.equal(line.props.style, undefined);
  assert.match(line.props.d, /^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
  const stops = all(tree, (node) => node.type === "stop");
  assert.deepEqual(stops.map((node) => node.props.stopOpacity), ["0.08", "0"]);
  const guide = find(tree, (node) => node.type === "line" && node.props.strokeDasharray === "2 5");
  assert.ok(Math.abs(guide.props.y1 - Number(line.props.d.split(" ")[2])) < 0.005);
  assert.equal(all(tree, (node) => node.type === "circle").length, 1);
  key(svg, "Home");
  ({ tree, svg } = chart.render());
  assert.match(svg.props["aria-valuetext"], /£100\.00/);
  assert.equal(svg.props["aria-valuenow"], 0);
  assert.equal(all(tree, (node) => node.type === "circle").length, 2);
  assert.equal(all(tree, (node) => node.props?.className?.includes("bottom-3")).length, 0);
});

test("default stock charts preserve their existing frame, touch and glow behavior", () => {
  const chart = chartHarness({ appearance: "default", ticker: "AAPL", compact: false });
  const { tree, svg } = chart.render();
  assert.ok(svg.props.className.includes("touch-none"));
  assert.equal(svg.props.role, undefined);
  assert.equal(svg.props.onKeyDown, undefined);
  assert.equal(svg.props.onBlur, undefined);
  assert.equal(svg.props.tabIndex, undefined);
  const line = find(tree, (node) => node.props?.className === "sg-stock-chart-line");
  assert.equal(line.props.vectorEffect, undefined);
  assert.match(line.props.style.filter, /drop-shadow/);
  assert.equal(all(tree, (node) => node.type === "linearGradient").length, 0);
});
