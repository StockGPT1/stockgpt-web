import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
const RouletteNumber = () => null;
const source = fs.readFileSync(new URL("../components/StockChart.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Run the component's actual event handlers. Minimal hooks retain state and refs
// between renders; the browser stub lets us verify queued pointer cancellation.
function chartHarness(overrides = {}) {
  const slots = [], pendingEffects = new Map(), frames = new Map(), scrubbed = [], haptics = [];
  const listeners = new Map(), listenerCapture = new Map(), listenerCalls = [], captured = new Set(), captureCalls = [], releaseCalls = [];
  let cursor = 0, frameId = 0, changed = false, latestSvg, latestFrame;
  const equalDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  class DomNode {}
  const descendant = new DomNode(), outside = new DomNode();
  const target = Object.assign(new DomNode(), {
    getBoundingClientRect: () => ({ left: 0, width: 800 }),
    contains: (node) => node === target || node === descendant,
    setPointerCapture: (id) => { captured.add(id); captureCalls.push(id); },
    hasPointerCapture: (id) => captured.has(id),
    releasePointerCapture: (id) => { captured.delete(id); releaseCalls.push(id); },
  });
  const frameTarget = Object.assign(new DomNode(), { contains: (node) => node === frameTarget || target.contains(node) });
  globalThis.Node = DomNode;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; changed = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useCallback: (callback, deps) => hooks.useMemo(() => callback, deps),
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { deps, cleanup, effectSlot: true };
        pendingEffects.set(index, effect);
      }
    },
    useId: () => { cursor++; return "chart-test"; },
  };
  const chartModule = { exports: {} };
  const imports = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "@/components/RouletteNumber") return { RouletteNumber };
    if (name === "@/lib/ios-native") return { nativeHaptic: (style) => haptics.push(style) };
    if (name === "@/components/ChartTimeframes.module.css") return { __esModule: true, default: { ranges: "shared-ranges", range: "shared-range" } };
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
  globalThis.document = {
    addEventListener(type, listener, options) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      if (!listenerCapture.has(type)) listenerCapture.set(type, new Map());
      listeners.get(type).add(listener);
      listenerCapture.get(type).set(listener, options === true || options?.capture === true);
      listenerCalls.push({ type, options });
    },
    removeEventListener(type, listener, options) {
      if (listenerCapture.get(type)?.get(listener) === (options === true || options?.capture === true)) {
        listeners.get(type)?.delete(listener);
        listenerCapture.get(type).delete(listener);
      }
    },
  };
  function render() {
    for (let attempt = 0; attempt < 25; attempt++) {
      cursor = 0; changed = false;
      const tree = chartModule.exports.StockChart(props);
      const svg = find(tree, (node) => node.type === "svg");
      const frame = find(tree, (node) => node.props?.className?.includes("sg-stock-chart-frame"));
      if (svg) svg.props.ref.current = target;
      else if (latestSvg) latestSvg.props.ref.current = null;
      if (frame?.props.ref) frame.props.ref.current = frameTarget;
      else if (latestFrame?.props.ref) latestFrame.props.ref.current = null;
      latestSvg = svg;
      latestFrame = frame;
      const effects = [...pendingEffects.entries()]; pendingEffects.clear();
      for (const [index, effect] of effects) {
        slots[index].cleanup?.();
        slots[index].cleanup = effect();
      }
      if (!changed) return { tree, svg };
    }
    throw new Error("Chart did not settle after effect state updates");
  }
  function flush() {
    const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback());
  }
  function dispatchDocument(type, overrides = {}) {
    const event = { cancelable: true, defaultPrevented: false, target,
      touches: touchList(), changedTouches: touchList(),
      preventDefault() { if (this.cancelable) this.defaultPrevented = true; }, ...overrides };
    listeners.get(type)?.forEach((listener) => listener(event));
    return event;
  }
  function unmount() {
    // React detaches the DOM ref before passive effect cleanup runs.
    if (latestSvg) latestSvg.props.ref.current = null;
    if (latestFrame?.props.ref) latestFrame.props.ref.current = null;
    for (const slot of slots) if (slot?.effectSlot) slot.cleanup?.();
  }
  return { render, flush, unmount, dispatchDocument, frames, points, props, scrubbed, haptics, listeners, listenerCalls, captured, captureCalls, releaseCalls, target, frameTarget, descendant, outside };
}

function all(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => all(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}
function find(tree, predicate) { return all(tree, predicate)[0]; }
function renderedText(tree) {
  if (Array.isArray(tree)) return tree.map(renderedText).join(" ");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object") return "";
  if (tree.type === RouletteNumber) return tree.props.value;
  return renderedText(tree.props?.children);
}
function key(svg, keyName) {
  let prevented = false;
  svg.props.onKeyDown({ key: keyName, preventDefault: () => { prevented = true; } });
  return prevented;
}
function pointer(svg, overrides = {}) {
  return { clientX: 100, isPrimary: true, button: 0, pointerId: 7, pointerType: "mouse",
    currentTarget: svg.props.ref.current, preventDefault() {}, ...overrides };
}
function touchList(...touches) {
  return Object.assign(touches, { item: (index) => touches[index] ?? null });
}
function touch(identifier, clientX, target) { return { identifier, clientX, target }; }

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
  assert.equal(svg.props["data-stock-chart-scrub-lock"], undefined);
  assert.equal(chart.listeners.get("wheel")?.size ?? 0, 0);
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

test("a noncompact stock chart can use the transparent portfolio plot without losing its value summary", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false });
  let { tree, svg } = chart.render();
  assert.equal(all(svg, (node) => node.type === "text").length, 0);
  const frame = find(tree, (node) => node.props?.className?.includes("sg-stock-chart-frame"));
  assert.ok(frame.props.className.includes("bg-transparent"));
  assert.ok(!frame.props.className.includes("sm:bg-"));
  const line = find(svg, (node) => node.props?.className === "sg-stock-chart-line");
  const width = Number(svg.props.viewBox.split(" ")[2]);
  const coordinates = line.props.d.split(" ");
  assert.ok(Number(coordinates[1]) < 16, "the first point must not retain a left axis gutter");
  assert.ok(Number(coordinates.at(-2)) > width - 16, "the last point must reach the plot edge");
  assert.ok(renderedText(tree).includes("$120.00"));
  assert.ok(renderedText(tree).includes("+$20.00 (+20.00%)"));
  svg.props.onPointerDown({ clientX: 100, isPrimary: true, button: 0 });
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[1]);
  ({ tree, svg } = chart.render());
  assert.ok(renderedText(tree).includes("$130.00"));
  assert.ok(!renderedText(tree).includes("+$20.00 (+20.00%)"));
  svg.props.onPointerLeave();
  ({ tree } = chart.render());
  assert.ok(renderedText(tree).includes("$120.00"));
  assert.ok(renderedText(tree).includes("+$20.00 (+20.00%)"));
});

test("shared stock timeframe controls expose selection and reset scrubbing only for an available range", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false, rangeOrder: ["1D", "1M", "MAX"], showUnavailableRanges: true });
  chart.props.data.MAX = [
    { date: "2025-10-01T00:00:00Z", close: 80 },
    { date: "2026-10-10T00:00:00Z", close: 120 },
  ];
  let { tree, svg } = chart.render();
  const controls = find(tree, (node) => node.props?.["aria-label"] === "AAPL chart timeframe");
  assert.equal(controls.props.className, "shared-ranges");
  let buttons = all(controls, (node) => node.type === "button");
  assert.deepEqual(buttons.map((button) => renderedText(button)), ["1D", "1M", "All"]);
  assert.ok(buttons.every((button) => button.props.className.includes("shared-range")));
  assert.deepEqual(buttons.map((button) => button.props["aria-pressed"]), [false, true, false]);
  assert.equal(buttons[0].props.disabled, true);
  assert.match(buttons[0].props["aria-label"], /unavailable/);
  svg.props.onPointerDown({ clientX: 100, isPrimary: true, button: 0 });
  svg.props.onPointerMove({ clientX: 792 });
  const callbacksBefore = chart.scrubbed.length;
  buttons[0].props.onClick();
  assert.equal(chart.scrubbed.length, callbacksBefore);
  assert.equal(chart.frames.size, 1);
  ({ tree } = chart.render());
  assert.ok(renderedText(tree).includes("$130.00"));
  buttons = all(find(tree, (node) => node.props?.["aria-label"] === "AAPL chart timeframe"), (node) => node.type === "button");
  buttons[2].props.onClick();
  assert.equal(chart.frames.size, 0);
  assert.deepEqual(chart.scrubbed.at(-1), { point: null, context: { range: "MAX" } });
  chart.flush();
  ({ tree, svg } = chart.render());
  assert.equal(svg.key, "MAX");
  assert.ok(renderedText(tree).includes("$120.00"));
  assert.ok(!renderedText(tree).includes("$130.00"));
  buttons = all(find(tree, (node) => node.props?.["aria-label"] === "AAPL chart timeframe"), (node) => node.type === "button");
  assert.deepEqual(buttons.map((button) => button.props["aria-pressed"]), [false, false, true]);
});

test("stock scrubbing keeps signed range return beside the selected value and places the date only at the crosshair", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock", rangeOrder: ["1M", "MAX"] });
  chart.props.data = {
    "1M": chart.points.map((point, index) => ({ ...point, close: index === 2 ? 80 : point.close })),
    MAX: [{ date: "2025-10-01T00:00:00Z", close: 200 }, { date: "2026-10-10T00:00:00Z", close: 80 }],
  };
  let { tree, svg } = chart.render();
  assert.ok(renderedText(tree).includes("-$20.00 (-20.00%)"));
  svg.props.onPointerMove(pointer(svg));
  chart.flush();
  ({ tree, svg } = chart.render());
  assert.ok(renderedText(tree).includes("$130.00"));
  assert.ok(renderedText(tree).includes("+$30.00 (+30.00%)"));
  const date = new Date(chart.points[1].date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const overlays = all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true);
  assert.equal(overlays.length, 1);
  assert.equal(renderedText(overlays[0]), date);
  assert.equal(renderedText(tree).split(date).length - 1, 1, "the date must not replace or duplicate the selected return in the header");
  svg.props.onPointerMove(pointer(svg, { clientX: 792 }));
  chart.flush();
  ({ tree } = chart.render());
  assert.ok(renderedText(tree).includes("$80.00"));
  assert.ok(renderedText(tree).includes("-$20.00 (-20.00%)"));
  find(tree, (node) => node.type === "button" && renderedText(node) === "All").props.onClick();
  ({ tree, svg } = chart.render());
  assert.equal(svg.key, "MAX");
  assert.ok(renderedText(tree).includes("-$120.00 (-60.00%)"));
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);
  chart.unmount();
});

test("stock hover and pointer capture gate wheel scrolling, while release keeps the final selected point", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock" });
  let { tree, svg } = chart.render();
  assert.ok(svg.props.className.includes("touch-none"));
  assert.ok(!svg.props.className.includes("touch-pan-y"));
  assert.equal(svg.props["data-stock-chart-scrub-lock"], true);
  assert.equal(chart.listeners.get("wheel").size, 1);
  assert.equal(chart.listenerCalls.find((call) => call.type === "wheel").options.passive, false);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  svg.props.onPointerMove(pointer(svg));
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true);
  chart.flush();
  ({ svg } = chart.render());
  assert.equal(chart.listeners.get("wheel").size, 1, "rerendering must not duplicate the wheel listener");
  svg.props.onPointerLeave();
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  ({ svg } = chart.render());
  svg.props.onPointerDown(pointer(svg, { pointerId: 9, pointerType: "touch" }));
  assert.deepEqual(chart.captureCalls, [9]);
  assert.equal(chart.captured.has(9), true);
  svg.props.onPointerDown(pointer(svg, { pointerId: 99, pointerType: "pen" }));
  assert.deepEqual(chart.captureCalls, [9], "a second primary pointer type must not replace an existing capture");
  svg.props.onPointerLeave();
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true);
  assert.equal(chart.captured.has(9), true);
  svg.props.onPointerMove(pointer(svg, { pointerId: 9, pointerType: "touch", clientX: 8 }));
  assert.equal(chart.frames.size, 1);
  svg.props.onPointerUp(pointer(svg, { pointerId: 99, pointerType: "touch", clientX: 792 }));
  assert.equal(chart.captured.has(9), true, "an unrelated pointer must not end the active scrub");
  svg.props.onPointerUp(pointer(svg, { pointerId: 9, pointerType: "touch", clientX: 792 }));
  assert.equal(chart.frames.size, 0);
  assert.deepEqual(chart.releaseCalls, [9]);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2]);
  // The browser emits lostpointercapture after a deliberate release. It must
  // not erase the final point that pointerup intentionally retained.
  svg.props.onLostPointerCapture(pointer(svg, { pointerId: 9, pointerType: "touch" }));
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2]);
  chart.flush();
  ({ tree } = chart.render());
  assert.ok(renderedText(tree).includes("$120.00"));
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 1);
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2], "a queued earlier move must not overwrite the release point");
  chart.unmount();
});

test("stock cancellation, lost capture, blur, Escape, range changes and unmount release all pending interaction", () => {
  for (const end of ["cancel", "lost", "blur", "escape", "range", "unmount"]) {
    const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock", rangeOrder: ["1M", "MAX"] });
    chart.props.data.MAX = [{ date: "2025-10-01T00:00:00Z", close: 80 }, { date: "2026-10-10T00:00:00Z", close: 120 }];
    let { tree, svg } = chart.render();
    svg.props.onPointerDown(pointer(svg, { pointerType: "touch" }));
    svg.props.onPointerMove(pointer(svg, { pointerType: "touch", clientX: 792 }));
    assert.equal(chart.frames.size, 1);
    assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true);
    if (end === "cancel" || end === "lost") {
      const handler = end === "cancel" ? "onPointerCancel" : "onLostPointerCapture";
      svg.props[handler](pointer(svg, { pointerId: 99 }));
      assert.equal(chart.captured.has(7), true);
      assert.equal(chart.frames.size, 1);
      assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true);
      svg.props[handler](pointer(svg));
    } else if (end === "blur") svg.props.onBlur();
    else if (end === "escape") key(svg, "Escape");
    else if (end === "range") find(tree, (node) => node.type === "button" && renderedText(node) === "All").props.onClick();
    else chart.unmount();
    assert.equal(chart.frames.size, 0, end);
    assert.equal(chart.captured.size, 0, end);
    assert.deepEqual(chart.releaseCalls, [7], end);
    assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false, end);
    chart.flush();
    if (end === "unmount") assert.equal(chart.listeners.get("wheel").size, 0);
    else {
      ({ tree, svg } = chart.render());
      assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0, end);
      assert.equal(chart.scrubbed.at(-1).point, null, end);
      if (end === "range") assert.equal(svg.key, "MAX");
      chart.unmount();
      assert.equal(chart.listeners.get("wheel").size, 0, end);
    }
  }
});

test("an unavailable pointer capture cannot leave stock wheel scrolling locked after exiting", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock" });
  const { svg } = chart.render();
  chart.target.setPointerCapture = () => { throw new Error("Pointer capture unavailable"); };
  svg.props.onPointerDown(pointer(svg));
  assert.equal(chart.captured.size, 0);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true);
  svg.props.onPointerLeave();
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  assert.equal(chart.scrubbed.at(-1).point, null);
  chart.unmount();
});

test("same-range history replacement, unavailable history and ticker changes reset stock selection and locks", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock" });
  let { tree, svg } = chart.render();
  svg.props.onPointerDown(pointer(svg, { pointerType: "touch" }));
  svg.props.onPointerMove(pointer(svg, { pointerType: "touch", clientX: 792 }));
  assert.equal(chart.frames.size, 1);
  const replacement = [...chart.points.map((point) => ({ ...point })), { date: "2026-10-12T00:00:00Z", close: 180 }];
  chart.props.data = { "1M": replacement };
  ({ tree, svg } = chart.render());
  assert.ok(renderedText(tree).includes("$180.00"));
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);
  assert.equal(chart.frames.size, 0);
  assert.equal(chart.captured.size, 0);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  chart.flush();
  assert.ok(renderedText(chart.render().tree).includes("$180.00"));

  // Disappearing and then restoring the same cached series must not revive its
  // old cursor or leave the detached SVG's pointer capture active.
  svg.props.onPointerDown(pointer(svg, { pointerId: 8, pointerType: "touch" }));
  svg.props.onPointerMove(pointer(svg, { pointerId: 8, pointerType: "touch", clientX: 792 }));
  chart.props.data = { "1M": [replacement[0]] };
  ({ tree, svg } = chart.render());
  assert.equal(svg, undefined);
  assert.ok(renderedText(tree).includes("No chart data available"));
  assert.equal(chart.frames.size, 0);
  assert.equal(chart.captured.size, 0);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  chart.props.data = { "1M": replacement };
  ({ tree, svg } = chart.render());
  assert.ok(renderedText(tree).includes("$180.00"));
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);

  svg.props.onPointerDown(pointer(svg, { pointerId: 9, pointerType: "touch" }));
  svg.props.onPointerMove(pointer(svg, { pointerId: 9, pointerType: "touch", clientX: 792 }));
  chart.props.ticker = "MSFT";
  ({ tree } = chart.render());
  assert.ok(renderedText(tree).includes("$180.00"));
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);
  assert.equal(chart.frames.size, 0);
  assert.equal(chart.captured.size, 0);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  chart.props.ticker = "AAPL";
  ({ tree } = chart.render());
  assert.ok(renderedText(tree).includes("$180.00"));
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);
  chart.unmount();
  assert.equal(chart.listeners.get("wheel").size, 0);
});

test("native stock touches block scrolling only for the chart's original finger, including beyond the plot", () => {
  const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock" });
  let { tree, svg } = chart.render();
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
    assert.equal(chart.listeners.get(type)?.size, 1, type);
    assert.equal(chart.listenerCalls.find((call) => call.type === type)?.options.capture, true, type);
  }
  for (const type of ["touchstart", "touchmove"]) assert.equal(chart.listenerCalls.find((call) => call.type === type)?.options.passive, false, type);
  const frame = find(tree, (node) => node.props?.className?.includes("sg-stock-chart-frame"));
  for (const node of [frame, svg]) {
    assert.equal(node.props["data-stock-chart-scrub-lock"], true);
    assert.equal(node.props.style.touchAction, "none");
    assert.equal(node.props.style.userSelect, "none");
    assert.equal(node.props.style.WebkitUserSelect, "none");
    assert.equal(node.props.style.WebkitTouchCallout, "none");
  }
  let preventedContextMenu = false;
  frame.props.onContextMenu({ preventDefault: () => { preventedContextMenu = true; } });
  assert.equal(preventedContextMenu, true);
  const unrelated = touch(3, 100, chart.outside);
  assert.equal(chart.dispatchDocument("touchstart", { target: chart.outside, touches: touchList(unrelated), changedTouches: touchList(unrelated) }).defaultPrevented, false);
  assert.equal(chart.dispatchDocument("touchmove", { target: chart.outside, touches: touchList(unrelated), changedTouches: touchList(unrelated) }).defaultPrevented, false);
  assert.equal(chart.scrubbed.length, 0);

  const finger = touch(41, 100, chart.descendant);
  assert.equal(chart.dispatchDocument("touchstart", { target: chart.descendant, touches: touchList(finger), changedTouches: touchList(finger) }).defaultPrevented, true);
  chart.flush();
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[1]);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true);
  ({ tree, svg } = chart.render());
  assert.equal(chart.listeners.get("touchstart").size, 1, "selection rerenders must not duplicate native handlers");
  const date = find(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true);
  assert.equal(date.props.style.userSelect, "none");
  assert.equal(date.props.style.WebkitUserSelect, "none");
  assert.equal(date.props.style.WebkitTouchCallout, "none");
  for (const handler of ["onPointerCancel", "onLostPointerCapture"]) {
    svg.props.onPointerDown(pointer(svg, { pointerType: "touch" }));
    svg.props[handler](pointer(svg, { pointerType: "touch" }));
    assert.equal(chart.captured.size, 0, handler);
    assert.equal(chart.dispatchDocument("wheel").defaultPrevented, true, "native touch must remain active after pointer cancellation");
  }
  assert.equal(chart.dispatchDocument("touchstart", { target: chart.outside, touches: touchList(unrelated, finger), changedTouches: touchList(unrelated) }).defaultPrevented, true);

  // A second finger ending cannot unlock the original touch. Movement outside
  // the SVG still follows identifier 41 rather than the first TouchList entry.
  assert.equal(chart.dispatchDocument("touchend", { touches: touchList(finger), changedTouches: touchList(unrelated) }).defaultPrevented, false);
  const outsideFinger = touch(41, 900, chart.descendant);
  assert.equal(chart.dispatchDocument("touchmove", { target: chart.outside, touches: touchList(unrelated, outsideFinger), changedTouches: touchList(outsideFinger) }).defaultPrevented, true);
  chart.flush();
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[2]);
  chart.dispatchDocument("touchmove", { target: chart.outside, touches: touchList(touch(41, 100, chart.descendant)) });
  assert.equal(chart.frames.size, 1);
  chart.dispatchDocument("touchend", { target: chart.outside, touches: touchList(unrelated), changedTouches: touchList(touch(41, 8, chart.descendant)) });
  assert.equal(chart.frames.size, 0);
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[0]);
  chart.flush();
  assert.strictEqual(chart.scrubbed.at(-1).point, chart.points[0], "the final touch coordinate must survive a previously queued move");
  assert.equal(all(chart.render().tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 1);
  assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false);
  assert.equal(chart.dispatchDocument("touchmove", { target: chart.outside, touches: touchList(unrelated), changedTouches: touchList(unrelated) }).defaultPrevented, false);
  chart.unmount();
});

test("native touch cancellation and chart cleanup cannot restore a queued selection or leave scrolling locked", () => {
  for (const end of ["cancel", "data", "unmount"]) {
    const chart = chartHarness({ ticker: "AAPL", compact: false, interaction: "stock" });
    let { tree, svg } = chart.render();
    const finger = touch(41, 100, chart.descendant);
    chart.dispatchDocument("touchstart", { target: chart.descendant, touches: touchList(finger), changedTouches: touchList(finger) });
    // Pointer and native touch identifiers need not be equal. Both browser
    // pathways must be released when the gesture or chart is cancelled.
    svg.props.onPointerDown(pointer(svg, { pointerType: "touch" }));
    svg.props.onPointerMove(pointer(svg, { pointerType: "touch", clientX: 792 }));
    assert.equal(chart.frames.size, 1);
    if (end === "cancel") {
      chart.dispatchDocument("touchcancel", { touches: touchList(), changedTouches: touchList(finger) });
    } else if (end === "data") {
      chart.props.data = { "1M": chart.points.map((point) => ({ ...point, close: point.close + 50 })) };
      ({ tree, svg } = chart.render());
    } else chart.unmount();
    assert.equal(chart.frames.size, 0, end);
    assert.equal(chart.captured.size, 0, end);
    assert.equal(chart.dispatchDocument("wheel").defaultPrevented, false, end);
    assert.equal(chart.dispatchDocument("touchmove", { target: chart.outside, touches: touchList(finger), changedTouches: touchList(finger) }).defaultPrevented, false, end);
    chart.flush();
    if (end !== "unmount") {
      ({ tree } = chart.render());
      assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0, end);
      assert.ok(renderedText(tree).includes(end === "data" ? "$170.00" : "$120.00"), end);
      chart.unmount();
    }
    for (const type of ["wheel", "touchstart", "touchmove", "touchend", "touchcancel"]) assert.equal(chart.listeners.get(type).size, 0, `${end}: ${type}`);
  }
});

test("a portfolio can show the scrub-line date without stock touch locking or a duplicate date", () => {
  const chart = chartHarness({ showScrubDate: true });
  let { tree, svg } = chart.render();
  assert.ok(svg.props.className.includes("touch-pan-y"));
  assert.notEqual(svg.props.style?.touchAction, "none");
  assert.equal(all(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);
  key(svg, "Home");
  ({ tree, svg } = chart.render());
  const overlay = find(tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true);
  const date = new Date(chart.points[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  assert.equal(renderedText(overlay), date);
  assert.equal(renderedText(tree).split(date).length - 1, 1);
  assert.equal(svg.props["data-stock-chart-scrub-lock"], undefined);
  for (const type of ["wheel", "touchstart", "touchmove", "touchend", "touchcancel"]) assert.equal(chart.listeners.get(type)?.size ?? 0, 0, type);
  const finger = touch(41, 100, chart.descendant);
  assert.equal(chart.dispatchDocument("touchstart", { target: chart.descendant, touches: touchList(finger), changedTouches: touchList(finger) }).defaultPrevented, false);
  assert.equal(chart.dispatchDocument("touchmove", { target: chart.descendant, touches: touchList(finger), changedTouches: touchList(finger) }).defaultPrevented, false);
  key(svg, "Escape");
  assert.equal(all(chart.render().tree, (node) => node.props?.["data-stock-chart-scrub-date"] === true).length, 0);
  chart.unmount();
});
