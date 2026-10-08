import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../lib/top-movers-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const clientModule = { exports: {} };
new Function("module", "exports", compiled)(clientModule, clientModule.exports);
const { createTopMoversClient } = clientModule.exports;
const mobileCode = ts.transpileModule(fs.readFileSync(new URL("../components/MobileMarketMovers.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const mover = (ticker = "TEST") => ({
  ticker, company: "Test Company", sector: "Technology", price: "$123.45",
  score: "7,100", rankLabel: "+2", rankTone: "up", rankTitle: "Up two ranks",
  actualRankLabel: "#3", dailyMoveLabel: "+4.2%", dailyMoveTone: "positive",
});
const response = (movers = [mover()]) => ({ ok: true, json: async () => ({ movers }) });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Render the actual portal and its section with retained hook state. A known
// host avoids unrelated DOM discovery; no intersection observer is provided.
function mobileHarness(client, canUsePremium = true) {
  const equalDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  let active;
  const hooks = {
    useState(initial) {
      const renderer = active, index = renderer.cursor++;
      if (!(index in renderer.slots)) renderer.slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [renderer.slots[index].value, (next) => {
        const value = typeof next === "function" ? next(renderer.slots[index].value) : next;
        if (!Object.is(value, renderer.slots[index].value)) { renderer.slots[index].value = value; renderer.changed = true; }
      }];
    },
    useRef(initial) {
      const index = active.cursor++;
      if (!(index in active.slots)) active.slots[index] = { current: initial };
      return active.slots[index];
    },
    useMemo(factory, deps) {
      const index = active.cursor++;
      if (!active.slots[index] || !equalDeps(active.slots[index].deps, deps)) active.slots[index] = { deps, value: factory() };
      return active.slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = active.cursor++;
      if (!active.slots[index] || !equalDeps(active.slots[index].deps, deps)) {
        const cleanup = active.slots[index]?.cleanup;
        active.slots[index] = { deps, cleanup };
        active.effects.set(index, effect);
      }
    },
  };
  const componentModule = { exports: {} };
  const imports = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "react-dom") return { createPortal: (children) => ({ type: "portal", props: { children } }) };
    if (name === "next/link") return { __esModule: true, default: () => null };
    if (name === "@/components/StockLogo") return { StockLogo: () => null };
    if (name === "@/lib/top-movers-client") return { topMoversClient: client };
    throw new Error(`Unexpected mobile movers dependency ${name}`);
  };
  new Function("require", "module", "exports", "document", mobileCode)(imports, componentModule, componentModule.exports, { querySelector: () => ({}) });
  function renderer(component, props) {
    const state = { slots: [], effects: new Map(), cursor: 0, changed: false };
    function render() {
      for (let attempt = 0; attempt < 20; attempt++) {
        active = state;
        state.cursor = 0;
        state.changed = false;
        const tree = component(props);
        const pending = [...state.effects.entries()];
        state.effects.clear();
        for (const [index, effect] of pending) {
          state.slots[index].cleanup?.();
          state.slots[index].cleanup = effect();
        }
        if (!state.changed) return tree;
      }
      throw new Error("Mobile movers did not settle");
    }
    return { render };
  }
  const portal = renderer(componentModule.exports.MobileMarketMoversPortal, { canUsePremium }).render();
  return renderer(portal.props.children.type, portal.props.children.props);
}
function all(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => all(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
const previews = (tree) => all(tree, (node) => node.type?.name === "MoverPreviewPanel");

test("simultaneous portal consumers share one request and timestamp actual successful completion", async () => {
  const request = deferred();
  let now = 1000, calls = 0;
  const client = createTopMoversClient({
    now: () => now,
    fetcher: (url, options) => {
      calls++;
      assert.equal(url, "/api/top-movers?period=1d");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      return request.promise;
    },
  });
  const first = client.load(), second = client.load();
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  assert.equal(client.peek(), null);
  now = 5000;
  request.resolve(response());
  const [one, two] = await Promise.all([first, second]);
  assert.strictEqual(one, two);
  assert.strictEqual(client.peek(), one);
  assert.equal(one.checkedAt, 5000);
});

test("dashboard remounts reuse successful data for 60 seconds without changing its checked time", async () => {
  let now = 1000, calls = 0;
  const client = createTopMoversClient({ now: () => now, fetcher: async () => { calls++; return response(); } });
  const first = await client.load();
  now += 59_999;
  assert.strictEqual(await client.load(), first);
  assert.equal(calls, 1);
  assert.equal(client.peek().checkedAt, 1000);
  now++;
  const refreshed = await client.load();
  assert.notStrictEqual(refreshed, first);
  assert.equal(calls, 2);
  assert.equal(refreshed.checkedAt, 61_000);
});

test("expired data remains available while one shared refresh is pending", async () => {
  const refresh = deferred();
  let now = 1000, calls = 0;
  const client = createTopMoversClient({
    now: () => now,
    fetcher: () => { calls++; return calls === 1 ? Promise.resolve(response()) : refresh.promise; },
  });
  const first = await client.load();
  now += 60_000;
  const one = client.load(), two = client.load();
  assert.strictEqual(one, two);
  assert.equal(calls, 2);
  assert.strictEqual(client.peek(), first, "renderers must retain useful rows while refreshing");
  now += 4000;
  refresh.resolve(response([mover("NEW")]));
  const next = await one;
  assert.equal(next.movers[0].ticker, "NEW");
  assert.equal(next.checkedAt, now);
});

test("a failed initial request is not cached and a deliberate retry makes a new request", async () => {
  let calls = 0;
  const client = createTopMoversClient({ fetcher: async () => {
    calls++;
    return calls === 1 ? { ok: false, json: async () => ({ movers: [] }) } : response();
  } });
  await assert.rejects(client.load(), /unavailable/);
  assert.equal(client.peek(), null);
  const result = await client.load();
  assert.equal(calls, 2);
  assert.equal(result.movers.length, 1);
});

test("a failed refresh retains the prior result and checked time but remains retryable", async () => {
  let now = 1000, calls = 0;
  const client = createTopMoversClient({ now: () => now, fetcher: async () => {
    calls++;
    if (calls === 2) throw new Error("Connection lost");
    return response([mover(calls === 1 ? "OLD" : "NEW")]);
  } });
  const previous = await client.load();
  now += 60_000;
  await assert.rejects(client.load(), /Connection lost/);
  assert.strictEqual(client.peek(), previous);
  assert.equal(client.peek().checkedAt, 1000);
  now += 100;
  const result = await client.load();
  assert.equal(calls, 3);
  assert.equal(result.movers[0].ticker, "NEW");
  assert.equal(result.checkedAt, now);
});

test("malformed payloads cannot poison the cache and empty valid mover lists can be cached", async () => {
  for (const payload of [{}, { movers: null }, { movers: [{}] }]) {
    let calls = 0;
    const client = createTopMoversClient({ fetcher: async () => {
      calls++;
      return calls === 1 ? { ok: true, json: async () => payload } : response([]);
    } });
    await assert.rejects(client.load(), /Invalid market/);
    assert.equal(client.peek(), null);
    assert.deepEqual((await client.load()).movers, []);
    await client.load();
    assert.equal(calls, 2, "an empty successful list is data, not a cache miss");
  }
});

test("the snapshot retains only public mover fields and no unrelated response metadata", async () => {
  const publicItem = mover();
  const client = createTopMoversClient({ fetcher: async () => ({
    ok: true,
    json: async () => ({ movers: [{ ...publicItem, internalContext: "not public" }], account: "not movers" }),
  }) });
  const result = await client.load();
  assert.deepEqual(result.movers, [publicItem]);
  assert.equal("account" in result, false);
  assert.notStrictEqual(result.movers[0], publicItem);
});

test("the mobile section fetches at mount, reuses rows across remounts, and retains them on refresh failure", async () => {
  const initial = deferred(), refresh = deferred();
  let now = 1000, calls = 0;
  const client = createTopMoversClient({ now: () => now, fetcher: () => { calls++; return calls === 1 ? initial.promise : refresh.promise; } });
  const mobile = mobileHarness(client);
  let tree = mobile.render();
  assert.equal(calls, 1, "mount must start the request without waiting for scrolling or an observer");
  assert.equal(all(tree, (node) => node.type?.name === "LoadingState").length, 1);
  initial.resolve(response());
  await client.load();
  tree = mobile.render();
  assert.equal(previews(tree)[0].props.movers[0].ticker, "TEST");

  const remounted = mobileHarness(client);
  tree = remounted.render();
  assert.equal(calls, 1);
  assert.equal(all(tree, (node) => node.type?.name === "LoadingState").length, 0);
  assert.equal(previews(tree)[0].props.movers[0].ticker, "TEST");
  await client.load();
  remounted.render();

  now += 60_000;
  const expired = mobileHarness(client);
  tree = expired.render();
  assert.equal(calls, 2);
  assert.equal(previews(tree)[0].props.movers[0].ticker, "TEST");
  assert.equal(all(tree, (node) => node.type?.name === "LoadingState").length, 0);
  assert.ok(text(tree).includes("Refreshing…"));
  const pending = client.load();
  refresh.reject(new Error("Connection lost"));
  await assert.rejects(pending, /Connection lost/);
  tree = expired.render();
  assert.equal(previews(tree)[0].props.movers[0].ticker, "TEST");
  assert.ok(text(tree).includes("Showing the last checked movers."));
  assert.ok(text(tree).includes("Try again →"));
  assert.equal(calls, 2, "an error must not trigger an automatic request loop");
});

test("the premium guard prevents both fetching and exposing an available cache", async () => {
  let calls = 0;
  const client = createTopMoversClient({ fetcher: async () => { calls++; return response(); } });
  await client.load();
  const locked = mobileHarness(client, false);
  const tree = locked.render();
  assert.equal(calls, 1, "a locked section must not request movers");
  assert.equal(previews(tree).length, 0);
  assert.ok(text(tree).includes("Daily movers are locked"));
  assert.equal(all(tree, (node) => node.type?.name === "MoversSheet")[0].props.open, false);
});
