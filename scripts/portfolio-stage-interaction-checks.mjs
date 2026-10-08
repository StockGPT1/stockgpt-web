import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = (file) => ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

// Keep the real sanitization, range eligibility, currency and date behavior.
const libraries = new Map();
function loadLibrary(name) {
  if (libraries.has(name)) return libraries.get(name);
  const file = `${name.replace(/^@\//, "")}.ts`;
  const loaded = { exports: {} };
  libraries.set(name, loaded.exports);
  new Function("require", "module", "exports", compiled(file))(loadLibrary, loaded, loaded.exports);
  return loaded.exports;
}
const { formatDate, money, signedMoney, signedPct } = loadLibrary("@/components/portfolio-workspace/utils");
const stageCode = compiled("components/portfolio-workspace/PortfolioStage.tsx");
const StockChart = () => null;
const RouletteNumber = () => null;
const equalDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

function stageHarness(overrides = {}) {
  const slots = [], pendingEffects = new Map(), mediaListeners = new Set();
  let cursor = 0, changed = false;
  const media = {
    matches: false,
    addEventListener: (_event, listener) => mediaListeners.add(listener),
    removeEventListener: (_event, listener) => mediaListeners.delete(listener),
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; changed = true; }
      }];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) {
        slots[index] = { deps };
        pendingEffects.set(index, effect);
      }
    },
  };
  const stageModule = { exports: {} };
  const imports = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "@/components/StockChart") return { StockChart };
    if (name === "@/components/RouletteNumber") return { RouletteNumber };
    if (name === "@/components/portfolio-workspace/PortfolioIcon") return { PortfolioIcon: () => null };
    if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
    return loadLibrary(name);
  };
  new Function("require", "module", "exports", stageCode)(imports, stageModule, stageModule.exports);
  const history = Array.from({ length: 4 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, index + 1, 12)).toISOString(),
    close: 1000 + index * 100,
    pnl: 100 + index * 50,
    pnlPct: 10 + index * 5,
  }));
  const props = {
    portfolioId: "portfolio-test",
    portfolios: [{ id: "portfolio-test", name: "My portfolio", createdAt: history[0].date }],
    meta: { name: "My portfolio", currency: "GBP", cashBalance: 0, cashDepositedTotal: 0 },
    summary: { totalValue: 2500, totalPnl: 800, totalPnlPct: 47.1, score: 75, label: "Healthy" },
    chartData: { "1M": history },
    chartMeta: { source: "snapshots", health: { displayState: "ready", latestSnapshotAt: history.at(-1).date } },
    stageRef: { current: null }, sectionAnchorRef: { current: null }, section: "overview",
    onSection() {}, onPortfolio() {}, onAdd() {}, onManage() {},
    ...overrides,
  };
  globalThis.window = { matchMedia: () => media };

  function render() {
    let tree;
    for (let attempt = 0; attempt < 25; attempt++) {
      cursor = 0; changed = false;
      tree = stageModule.exports.PortfolioStage(props);
      // React restarts this render before committing when state was adjusted
      // during render. Effects run only after a stable render is committed.
      if (changed) continue;
      const effects = [...pendingEffects.values()]; pendingEffects.clear();
      effects.forEach((effect) => effect());
      if (changed) continue;
      return { tree, chart: find(tree, (node) => node.type === StockChart), balance: find(tree, (node) => node.type === "h1").props.title };
    }
    throw new Error("Stage did not settle after render-time state updates");
  }
  function resize(wide) {
    media.matches = wide;
    mediaListeners.forEach((listener) => listener({ matches: wide }));
    return render();
  }
  return { props, history, render, resize };
}

function all(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => all(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}
function find(tree, predicate) { return all(tree, predicate)[0]; }
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object") return "";
  if (tree.type === RouletteNumber) return tree.props.value;
  return text(tree.props?.children);
}
function assertCurrent(view, props) {
  assert.equal(view.balance, money(props.summary.totalValue, props.meta.currency));
  assert.ok(text(view.tree).includes(`${signedMoney(props.summary.totalPnl, props.meta.currency)} · ${signedPct(props.summary.totalPnlPct)}`));
  assert.ok(!text(view.tree).includes("Total return at this point"));
}

test("portfolio dates use the shared chart overlay and keep selected return context accessible", () => {
  const stage = stageHarness();
  let view = stage.render();
  assert.equal(view.chart.props.showScrubDate, true);
  assert.equal(view.chart.props.interaction, undefined);
  view.chart.props.onScrub(view.chart.props.data["1M"][1]);
  view = stage.render();
  assert.equal(text(find(view.tree, (node) => node.props?.className === "captionRow")).trim(), "Portfolio value");
  const selectedDate = formatDate(stage.history[1].date, true);
  const accessibleDate = find(view.tree, (node) => node.type === "span" && node.props.className === "sr-only" && text(node).includes(selectedDate));
  assert.ok(text(accessibleDate).includes(selectedDate));
  assert.ok(text(view.tree).includes(`${signedMoney(150, "GBP")} · ${signedPct(15)}`));
  view.chart.props.onScrub(null);
  view = stage.render();
  assertCurrent(view, stage.props);
  assert.equal(find(view.tree, (node) => node.type === "span" && node.props.className === "sr-only" && text(node).includes(selectedDate)), undefined);
});

test("scrubbing across different value lengths keeps the headline font sizing fixed", () => {
  const stage = stageHarness();
  stage.props.chartData["1M"][0] = { ...stage.history[0], close: 999.5 };
  let view = stage.render();
  const width = find(view.tree, (node) => node.type === "h1").props.style["--portfolio-value-width"];
  for (const point of view.chart.props.data["1M"]) {
    view.chart.props.onScrub(point);
    view = stage.render();
    assert.equal(view.balance, money(point.close, "GBP"));
    assert.equal(find(view.tree, (node) => node.type === "h1").props.style["--portfolio-value-width"], width);
  }
  view.chart.props.onScrub(null);
  assert.equal(find(stage.render().tree, (node) => node.type === "h1").props.style["--portfolio-value-width"], width);
});

test("a historical value without PnL shows unavailable instead of current gains", () => {
  const stage = stageHarness();
  stage.props.chartData["1M"][1] = { ...stage.history[1], pnl: undefined, pnlPct: undefined };
  let view = stage.render();
  view.chart.props.onScrub(view.chart.props.data["1M"][1]);
  view = stage.render();
  assert.equal(view.balance, money(1100, "GBP"));
  assert.ok(text(view.tree).includes("Return unavailable for this point"));
  assert.ok(!text(view.tree).includes(signedMoney(stage.props.summary.totalPnl, "GBP")));
  assert.ok(!text(view.tree).includes(signedPct(stage.props.summary.totalPnlPct)));
  view.chart.props.onScrub(null);
  assertCurrent(stage.render(), stage.props);
});

test("historical PnL with a missing percentage never borrows the current percentage", () => {
  const stage = stageHarness();
  stage.props.chartData["1M"][1] = { ...stage.history[1], pnlPct: undefined };
  let view = stage.render();
  view.chart.props.onScrub(view.chart.props.data["1M"][1]);
  view = stage.render();
  assert.equal(view.balance, money(1100, "GBP"));
  assert.ok(text(view.tree).includes(signedMoney(150, "GBP")));
  assert.ok(!text(view.tree).includes(signedPct(stage.props.summary.totalPnlPct)));
  assert.ok(!text(view.tree).includes("Return unavailable for this point"));
});

test("responsive chart remounts reset the headline and cannot revive a prior selection", () => {
  const stage = stageHarness();
  let view = stage.render();
  const mobileKey = view.chart.key;
  view.chart.props.onScrub(view.chart.props.data["1M"][1]);
  view = stage.render();
  assert.equal(view.balance, money(1100, "GBP"));
  view = stage.resize(true);
  assert.equal(view.chart.props.height, 318);
  assert.notEqual(view.chart.key, mobileKey);
  assertCurrent(view, stage.props);
  const desktopKey = view.chart.key;
  view = stage.resize(false);
  assert.equal(view.chart.props.height, 218);
  assert.notEqual(view.chart.key, desktopKey);
  assert.notEqual(view.chart.key, mobileKey);
  assertCurrent(view, stage.props);
});

test("automatic range fallback and restoration cannot revive a prior selection", () => {
  const stage = stageHarness();
  const fiveDay = Array.from({ length: 6 }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 2, index)).toISOString(), close: 2000 + index * 10, pnl: 100, pnlPct: 5 }));
  stage.props.chartData = { "1M": stage.history, "5D": fiveDay };
  let view = stage.render();
  const initialKey = view.chart.key;
  view.chart.props.onScrub(view.chart.props.data["1M"][1]);
  assert.equal(stage.render().balance, money(1100, "GBP"));
  stage.props.chartData = { "5D": fiveDay };
  view = stage.render();
  assert.equal(view.chart.props.initialRange, "5D");
  assert.notEqual(view.chart.key, initialKey);
  assertCurrent(view, stage.props);
  stage.props.chartData = { "1M": stage.history, "5D": fiveDay };
  view = stage.render();
  assert.equal(view.chart.props.initialRange, "1M");
  assert.notEqual(view.chart.key, initialKey);
  assertCurrent(view, stage.props);
});

test("replacing and prepending history reset the chart key and headline together", () => {
  const stage = stageHarness();
  let view = stage.render();
  const initialKey = view.chart.key;
  view.chart.props.onScrub(view.chart.props.data["1M"][2]);
  assert.equal(stage.render().balance, money(1200, "GBP"));
  // The selected point still exists unchanged: membership alone is insufficient
  // to reset a cursor after its child chart receives a replacement series.
  stage.props.chartData = { "1M": stage.history.map((point) => ({ ...point })) };
  view = stage.render();
  const replacedKey = view.chart.key;
  assert.notEqual(replacedKey, initialKey);
  assertCurrent(view, stage.props);
  view.chart.props.onScrub(view.chart.props.data["1M"][2]);
  assert.equal(stage.render().balance, money(1200, "GBP"));
  stage.props.chartData = { "1M": [{ date: "2026-09-30T12:00:00Z", close: 950, pnl: 50, pnlPct: 5 }, ...stage.props.chartData["1M"]] };
  view = stage.render();
  assert.notEqual(view.chart.key, replacedKey);
  assertCurrent(view, stage.props);
});
