import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../lib/app-launch-state.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const launchModule = { exports: {} };
new Function("module", "exports", compiled)(launchModule, launchModule.exports);
const { observeInitialAppLoad } = launchModule.exports;
const ready = (document) => document.documentElement.getAttribute("data-stockgpt-launch-ready") === "true";

// Minimal DOM and mutation delivery let the actual lifecycle helper observe
// batched removals and hidden-attribute changes without a browser dependency.
function documentHarness() {
  const observers = [];
  const matches = (node, selector) => {
    const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    assert.ok(attribute, `Unsupported DOM selector: ${selector}`);
    return node.attributes.has(attribute);
  };
  const within = (node, parent) => {
    for (let current = node; current; current = current.parent) if (current === parent) return true;
    return false;
  };
  function record(target, type, attributeName) {
    for (const observer of observers) {
      if (!observer.target || !(observer.options.subtree ? within(target, observer.target) : target === observer.target)) continue;
      if (type === "childList" && observer.options.childList) observer.records.push({ target, type });
      if (type === "attributes" && observer.options.attributes && (!observer.options.attributeFilter || observer.options.attributeFilter.includes(attributeName))) observer.records.push({ target, type, attributeName });
    }
  }
  function element(attributes = {}) {
    return {
      attributes: new Map(Object.entries(attributes)), parent: null, children: [],
      getAttribute(name) { return this.attributes.get(name) ?? null; },
      setAttribute(name, value) {
        if (this.attributes.get(name) === value) return;
        this.attributes.set(name, value);
        record(this, "attributes", name);
      },
      closest(selector) {
        if (matches(this, selector)) return this;
        for (let current = this.parent; current; current = current.parent) if (matches(current, selector)) return current;
        return null;
      },
      append(...nodes) {
        for (const node of nodes) {
          node.remove();
          node.parent = this;
          this.children.push(node);
        }
        record(this, "childList");
      },
      remove() {
        if (!this.parent) return;
        const parent = this.parent;
        parent.children = parent.children.filter((node) => node !== this);
        this.parent = null;
        record(parent, "childList");
      },
    };
  }
  const root = element(), body = element();
  root.append(body);
  const all = (node) => [node, ...node.children.flatMap(all)];
  const document = { documentElement: root, body, querySelectorAll: (selector) => all(root).filter((node) => matches(node, selector)) };
  class Observer {
    constructor(callback) { this.callback = callback; this.records = []; this.target = null; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.target = null; this.records = []; }
  }
  function flush() {
    for (const observer of observers) {
      if (!observer.target || !observer.records.length) continue;
      const records = observer.records;
      observer.records = [];
      observer.callback(records, observer);
    }
  }
  const loader = () => element({ "data-stockgpt-launch-loader": "true" });
  return { document, body, element, loader, Observer, observers, flush, observe: () => observeInitialAppLoad(document, Observer) };
}

test("launch stays pending until every initial visible loading shell disappears", () => {
  const app = documentHarness(), first = app.loader(), second = app.loader();
  app.body.append(first, second);
  const cleanup = app.observe();
  assert.equal(ready(app.document), false);
  first.remove();
  app.flush();
  assert.equal(ready(app.document), false);
  second.remove();
  app.flush();
  assert.equal(ready(app.document), true);
  assert.equal(app.observers[0].target, null);
  cleanup();
  assert.equal(ready(app.document), true);
});

test("a fast first page without a loading fallback consumes the launch immediately", () => {
  const app = documentHarness();
  app.body.append(app.element());
  const cleanup = app.observe();
  assert.equal(ready(app.document), true);
  assert.equal(app.observers[0].target, null);
  cleanup();
  assert.equal(ready(app.document), true);
});

test("hidden streamed fallbacks do not hold the launch open, including hidden ancestors", () => {
  for (const hiddenOnLoader of [true, false]) {
    const app = documentHarness(), visible = app.loader(), retained = app.loader();
    const container = app.element({ hidden: "" });
    if (hiddenOnLoader) {
      retained.setAttribute("hidden", "");
      app.body.append(retained, visible);
    } else {
      container.append(retained);
      app.body.append(container, visible);
    }
    app.observe();
    assert.equal(ready(app.document), false);
    visible.setAttribute("hidden", "");
    app.flush();
    assert.equal(ready(app.document), true);
    assert.equal(app.document.querySelectorAll("[data-stockgpt-launch-loader]").length, 2, "readiness must not require retained markup to be deleted");
  }
});

test("an initially hidden SSR fallback already counts as a ready first page", () => {
  const app = documentHarness(), container = app.element({ hidden: "" });
  container.append(app.loader());
  app.body.append(container);
  app.observe();
  assert.equal(ready(app.document), true);
});

test("StrictMode setup-cleanup-remount resumes pending launch without resetting a completed one", () => {
  const app = documentHarness(), loader = app.loader();
  app.body.append(loader);
  const firstCleanup = app.observe();
  assert.equal(ready(app.document), false);
  firstCleanup();
  assert.equal(app.observers[0].target, null);
  const secondCleanup = app.observe();
  assert.equal(ready(app.document), false);
  loader.remove();
  app.flush();
  assert.equal(ready(app.document), true);
  secondCleanup();
  const count = app.observers.length;
  const thirdCleanup = app.observe();
  assert.equal(app.observers.length, count, "a completed launch does not need another observer");
  thirdCleanup();
  assert.equal(ready(app.document), true);
});

test("a fallback that finishes during cleanup is detected by remount's initial check", () => {
  const app = documentHarness(), loader = app.loader();
  app.body.append(loader);
  const cleanup = app.observe();
  cleanup();
  loader.remove();
  app.flush();
  assert.equal(ready(app.document), false);
  app.observe();
  assert.equal(ready(app.document), true);
});

test("later page fallbacks never reset readiness or restart launch observation", () => {
  const app = documentHarness();
  app.observe();
  const count = app.observers.length;
  const later = app.loader();
  app.body.append(later);
  app.flush();
  app.observe();
  assert.equal(ready(app.document), true);
  assert.equal(app.observers.length, count);
  later.remove();
  app.flush();
  assert.equal(ready(app.document), true);
});

test("a new document receives an independent launch despite an earlier completed document", () => {
  const earlier = documentHarness();
  earlier.observe();
  assert.equal(ready(earlier.document), true);
  const next = documentHarness(), loader = next.loader();
  next.body.append(loader);
  next.observe();
  assert.equal(ready(next.document), false);
  assert.equal(ready(earlier.document), true);
  loader.remove();
  next.flush();
  assert.equal(ready(next.document), true);
});
