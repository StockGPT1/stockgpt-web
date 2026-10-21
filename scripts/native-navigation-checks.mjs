import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript"), jsx = require("react/jsx-runtime");
const source = fs.readFileSync(new URL("../components/native-navigation/LiquidControls.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const descendants = (node) => Array.isArray(node) ? node.flatMap(descendants) : !node || typeof node !== "object" ? [] : [node, ...descendants(node.props?.children)];

// Execute production hooks and pointer handlers against measured DOM geometry.
// The deterministic animation clock tests spring behavior without wall-clock waits.
function harness({ bubble = false, activeKey = "home", reduced = false } = {}) {
  const slots = [], effects = new Map(), frames = new Map(), observers = new Set(), preferenceListeners = new Set();
  const selected = [], haptics = [], captures = new Set();
  let cursor = 0, frameId = 0, time = 0, tree;
  const document = { activeElement: null };
  class Element {
    constructor(left = 0, width = 72) {
      this.offsetLeft = left; this.offsetTop = 6; this.offsetWidth = width; this.offsetHeight = 54;
      this.clientLeft = 0; this.clientTop = 0; this.dataset = {};
      this.values = new Map(); this.style = { setProperty: (key, value) => this.values.set(key, value) };
    }
    getBoundingClientRect() { return { left: 100, top: 200, width: 300, height: 66 }; }
    setPointerCapture(id) { captures.add(id); }
    hasPointerCapture(id) { return captures.has(id); }
    releasePointerCapture(id) { captures.delete(id); }
    closest() { return this; }
    focus() { document.activeElement = this; }
  }
  const root = new Element(), track = new Element(6, 288), buttons = Array.from({ length: 4 }, (_, index) => new Element(index * 72));
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) {
        effects.set(index, effect); slots[index] = { deps, cleanup: slots[index]?.cleanup };
      }
    },
  };
  const requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  const cancelAnimationFrame = (id) => frames.delete(id);
  const window = { matchMedia: () => ({ matches: reduced, addEventListener: (_, callback) => preferenceListeners.add(callback), removeEventListener: (_, callback) => preferenceListeners.delete(callback) }) };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const imports = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "@/lib/ios-native") return { nativeHaptic: (style) => haptics.push(style) };
    if (name === "./LiquidControls.module.css") return { __esModule: true, default: { scope: "liquid-scope" } };
    throw new Error(`Unexpected navigation dependency ${name}`);
  };
  const navigationModule = { exports: {} };
  new Function("require", "module", "exports", "window", "document", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "Element", "HTMLElement", compiled)(imports, navigationModule, navigationModule.exports, window, document, ResizeObserver, requestAnimationFrame, cancelAnimationFrame, Element, Element);
  const props = { activeKey, items: ["home", "rankings", "portfolio", "scanner"].map(key => ({ key, label: key, icon: key })), onSelect: (key) => selected.push(key), children: jsx.jsx("button", { children: "Open" }) };
  function render() {
    cursor = 0;
    tree = bubble ? navigationModule.exports.ElasticBubble(props) : navigationModule.exports.LiquidNavigation(props);
    for (const node of descendants(tree)) {
      if (node === tree) node.props.ref.current = root;
      else if (node.props?.className === "sg-liquid-nav-track") node.props.ref.current = track;
      else if (node.type === "button" && typeof node.props.ref === "function") {
        const index = props.items.findIndex(item => item.label === node.props["aria-label"]);
        node.props.ref(buttons[index]);
      }
    }
    for (const [index, effect] of effects) { slots[index].cleanup?.(); slots[index].cleanup = effect(); }
    effects.clear();
    return tree;
  }
  function event(overrides = {}) {
    return { currentTarget: root, target: buttons[0], clientX: 142, clientY: 233, pointerId: 1, isPrimary: true, button: 0, timeStamp: time,
      detail: 1, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...overrides };
  }
  function dispatch(name, overrides) { const value = event(overrides); tree.props[name](value); return value; }
  function flush(limit = 240) {
    let count = 0;
    while (frames.size && count++ < limit) {
      time += 1000 / 60;
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time));
    }
    return count;
  }
  function matrix() { return root.values.get("--bubble-transform")?.slice(7, -1).split(",").map(Number) ?? [1, 0, 0, 1, 0, 0]; }
  function unmount() { for (const slot of slots) slot?.cleanup?.(); }
  render();
  return { render, props, dispatch, flush, matrix, unmount, root, track, buttons, selected, haptics, frames, captures, observers, preferenceListeners, get tree() { return tree; } };
}

test("diagonal navigation deformation remains subtle and the release spring becomes idle", () => {
  const nav = harness();
  nav.dispatch("onPointerDown");
  nav.dispatch("onPointerMove", { clientX: 1200, clientY: 1200 });
  nav.flush();
  const [a, b, c, d, x, y] = nav.matrix();
  assert.ok(b > 0 && c > 0, "diagonal pulls must deform both axes together");
  assert.ok(Math.abs(b - c) < 1e-8);
  const spread = Math.sqrt((a - d) ** 2 + 4 * b * c);
  assert.ok((a + d + spread) / 2 <= 1.0201, "navigation stretch must remain within two percent");
  assert.ok((a + d - spread) / 2 >= 0.9919);
  assert.ok(x > 0 && y > 0 && Math.hypot(x, y) <= 2.501, "translation must stay within the approved 2.5px");
  assert.equal(nav.frames.size, 0, "holding still must not run an endless animation loop");
  nav.dispatch("onPointerUp", { clientX: 1200, clientY: 1200 });
  nav.flush();
  assert.deepEqual(nav.matrix(), [1, 0, 0, 1, 0, 0]);
  assert.equal(nav.frames.size, 0);
  assert.equal(nav.captures.size, 0);
  nav.unmount();
});

test("dragging previews tabs and commits the release target exactly once", () => {
  const nav = harness();
  nav.dispatch("onPointerDown");
  nav.dispatch("onPointerMove", { clientX: 220 });
  nav.dispatch("onPointerMove", { clientX: 358 });
  assert.deepEqual(nav.selected, [], "crossing tabs must not navigate before release");
  assert.equal(nav.track.values.get("--indicator-x"), "216px");
  nav.dispatch("onPointerUp", { clientX: 358 });
  assert.deepEqual(nav.selected, ["scanner"]);
  const click = nav.dispatch("onClickCapture");
  assert.equal(click.prevented, true, "the synthetic click following pointerup must not navigate twice");
  assert.equal(click.stopped, true);
  nav.dispatch("onLostPointerCapture");
  assert.deepEqual(nav.selected, ["scanner"]);
  nav.unmount();
});

test("cancellation restores the actual current tab and ignores unrelated pointers", () => {
  const nav = harness({ activeKey: "portfolio" });
  nav.dispatch("onPointerDown");
  nav.dispatch("onPointerMove", { clientX: 358 });
  nav.dispatch("onPointerUp", { clientX: 358, pointerId: 2 });
  assert.deepEqual(nav.selected, []);
  assert.equal(nav.captures.has(1), true);
  nav.dispatch("onPointerCancel", { clientX: 358 });
  assert.deepEqual(nav.selected, []);
  assert.equal(nav.track.values.get("--indicator-x"), "144px");
  assert.equal(nav.captures.size, 0);
  nav.flush();
  assert.deepEqual(nav.matrix(), [1, 0, 0, 1, 0, 0]);
  nav.unmount();
});

test("secondary pages have no misleading selected primary tab and retain keyboard access", () => {
  const nav = harness();
  assert.equal(nav.track.values.get("--indicator-opacity"), "1");
  nav.props.activeKey = "watchlist";
  nav.render();
  const tabs = descendants(nav.tree).filter(node => node.type === "button");
  assert.ok(tabs.every(node => node.props["aria-current"] === undefined));
  assert.equal(tabs.filter(node => node.props.tabIndex === 0).length, 1);
  assert.equal(nav.track.values.get("--indicator-opacity"), "0");
  nav.dispatch("onPointerDown");
  assert.equal(nav.track.values.get("--indicator-opacity"), "1");
  nav.dispatch("onPointerCancel");
  assert.equal(nav.track.values.get("--indicator-opacity"), "0");
  assert.deepEqual(nav.selected, []);
  const key = nav.dispatch("onKeyDown", { key: "End" });
  assert.equal(key.prevented, true);
  assert.deepEqual(nav.selected, ["scanner"]);
  nav.unmount();
});

test("smaller bubbles stretch diagonally within their bounds and suppress accidental drag clicks", () => {
  const bubble = harness({ bubble: true });
  bubble.dispatch("onPointerDown");
  bubble.dispatch("onPointerMove", { clientX: -1000, clientY: 1200 });
  bubble.flush();
  const [a, b, c, d, x, y] = bubble.matrix();
  assert.ok(b < 0 && c < 0 && x < 0 && y > 0);
  const spread = Math.sqrt((a - d) ** 2 + 4 * b * c);
  assert.ok((a + d + spread) / 2 <= 1.0351);
  assert.ok(Math.hypot(x, y) <= 4.001);
  bubble.dispatch("onPointerUp");
  assert.equal(bubble.dispatch("onClickCapture").prevented, true);
  assert.equal(bubble.dispatch("onClickCapture", { detail: 0 }).prevented, false, "keyboard clicks remain usable");
  bubble.flush();
  assert.deepEqual(bubble.matrix(), [1, 0, 0, 1, 0, 0]);
  bubble.unmount();
});

test("reduced motion keeps drag selection usable and unmount cancels every scheduled frame", () => {
  for (const reduced of [false, true]) {
    const nav = harness({ reduced });
    nav.dispatch("onPointerDown");
    nav.dispatch("onPointerMove", { clientX: 358, clientY: 400 });
    if (reduced) { nav.flush(); assert.deepEqual(nav.matrix(), [1, 0, 0, 1, 0, 0]); }
    nav.dispatch("onPointerUp", { clientX: 358, clientY: 400 });
    assert.deepEqual(nav.selected, ["scanner"]);
    nav.unmount();
    assert.equal(nav.frames.size, 0);
    assert.equal(nav.observers.size, 0);
    assert.equal(nav.preferenceListeners.size, 0);
  }
});
