import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url), ts = require("typescript"), jsx = require("react/jsx-runtime");
const { PrefetchKind } = require("next/dist/client/components/router-reducer/router-reducer-types");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../components/native-navigation/NativeNavigation.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== "object" ? [] : [tree, ...nodes(tree.props?.children)];

// Test the production navigation's actual prefetch scheduling and route calls.
// Fake timers avoid waiting, while real Next PrefetchKind values catch AUTO
// regressions that would silently skip dynamic routes without leaf loaders.
function harness() {
  const slots = [], effects = new Map(), timers = new Map(), warmed = [], pushed = [];
  let cursor = 0, timerId = 0, clock = 0, path = "/dashboard", tree;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useTransition: () => [false, callback => callback()],
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) {
        effects.set(index, effect); slots[index] = { deps, cleanup: slots[index]?.cleanup };
      }
    },
  };
  const router = { prefetch: (href, options) => warmed.push({ href, kind: options?.kind, at: clock }), push: href => pushed.push(href) };
  const window = {
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: clock + delay }); return timerId; },
  };
  const clearTimeout = id => timers.delete(id);
  const LiquidNavigation = () => null, placeholder = () => null;
  const dependencies = {
    react: hooks,
    "react/jsx-runtime": jsx,
    "next/link": { __esModule: true, default: placeholder },
    "next/image": { __esModule: true, default: placeholder },
    "next/navigation": { usePathname: () => path, useRouter: () => router },
    "next/dist/client/components/router-reducer/router-reducer-types": { PrefetchKind },
    "@/components/AppChromeProvider": { useAppChrome: () => ({ focusedFlowCount: 0, keyboardOpen: false, pageConfiguration: null }) },
    "@/components/StockIcon": { StockIcon: placeholder },
    "@/lib/ask-context": { buildAskHref: () => "/ask-stockgpt" },
    "./LiquidControls": { ElasticBubble: placeholder, LiquidNavigation },
    "./StockGPTFlame": { StockGPTFlame: placeholder },
    "./NativeNavigation.module.css": { __esModule: true, default: {} },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "window", "clearTimeout", compiled)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected navigation dependency ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports, window, clearTimeout);
  function render(nextPath = path) {
    path = nextPath; cursor = 0;
    tree = loaded.exports.NativeBottomNavigation({ unreadCount: 0, askHref: "/ask-stockgpt" });
    for (const [index, effect] of effects) { slots[index].cleanup?.(); slots[index].cleanup = effect(); }
    effects.clear();
    return tree;
  }
  function advance(milliseconds) {
    const end = clock + milliseconds;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      clock = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    clock = end;
  }
  function unmount() { for (const slot of slots) slot?.cleanup?.(); }
  function select(key) { nodes(tree).find(node => node.type === LiquidNavigation).props.onSelect(key); }
  render();
  return { render, advance, unmount, select, warmed, pushed, timers };
}

test("native navigation warms real dynamic page data with FULL prefetch and skips the current tab", () => {
  const nav = harness();
  assert.deepEqual(nav.warmed, []);
  nav.advance(200);
  assert.deepEqual(nav.warmed.map(entry => entry.href), ["/chart-scan"], "The quick scanner route warms first");
  nav.advance(1000);
  assert.deepEqual(nav.warmed.map(entry => entry.href), ["/chart-scan", "/rankings", "/portfolio"]);
  assert.ok(nav.warmed.every(entry => entry.kind === PrefetchKind.FULL), "AUTO only warms route metadata without a leaf loading boundary");
  nav.unmount();
});

test("route changes cancel the previous warming queue before scheduling the new destinations", () => {
  const nav = harness();
  nav.advance(250);
  nav.render("/portfolio");
  nav.advance(320);
  assert.deepEqual(nav.warmed.map(entry => entry.href), ["/chart-scan", "/chart-scan"]);
  assert.ok(nav.warmed.every(entry => entry.href !== "/portfolio"));
  nav.advance(1000);
  assert.deepEqual(nav.warmed.map(entry => entry.href), ["/chart-scan", "/chart-scan", "/dashboard", "/rankings"]);
  nav.unmount();
});

test("unmount clears scheduled warming and tab selection uses a client transition", () => {
  const nav = harness();
  nav.select("/dashboard");
  assert.deepEqual(nav.pushed, []);
  nav.select("/rankings");
  assert.deepEqual(nav.pushed, ["/rankings"]);
  nav.unmount();
  assert.equal(nav.timers.size, 0);
  nav.advance(5000);
  assert.deepEqual(nav.warmed, []);
});
