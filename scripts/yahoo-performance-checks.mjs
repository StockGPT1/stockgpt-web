import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(new URL("../lib/yahoo.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function chartResponse(closes = [100, 110], timestamps = closes.map((_close, index) => 1791360000 + index * 86400)) {
  return { ok: true, status: 200, json: async () => ({ chart: { error: null, result: [{
    timestamp: timestamps,
    indicators: { quote: [{ close: closes }] },
  }] } }) };
}
const failureResponse = (status = 429) => ({ ok: false, status });
const turn = () => new Promise((resolve) => setImmediate(resolve));
function observe(promise) {
  const result = { status: "pending", value: undefined, error: undefined };
  promise.then((value) => { result.status = "fulfilled"; result.value = value; }, (error) => { result.status = "rejected"; result.error = error; });
  return result;
}

function yahooHarness(fetchImplementation) {
  const calls = [], warnings = [], cacheWrites = [], cached = new Map(), timers = new Map();
  let timerId = 0;
  const exportsContainer = { exports: {} };
  const imports = (name) => {
    assert.equal(name, "next/cache");
    return { unstable_cache: (fetcher) => async (...args) => {
      const key = JSON.stringify(args);
      if (cached.has(key)) return cached.get(key);
      // The cache stores only fulfilled values and intentionally does not
      // deduplicate pending work: the actual Yahoo helper must do that itself.
      const value = await fetcher(...args);
      cached.set(key, value);
      cacheWrites.push(value);
      return value;
    } };
  };
  const fetch = (url, options) => {
    const call = { url, ...options };
    calls.push(call);
    return fetchImplementation(call, calls.length - 1);
  };
  new Function("require", "module", "exports", "fetch", "process", "console", "setTimeout", "clearTimeout", compiled)(
    imports, exportsContainer, exportsContainer.exports, fetch,
    { env: { NODE_ENV: "production" } }, { warn: (...args) => warnings.push(args) },
    (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    (id) => timers.delete(id),
  );
  return { ...exportsContainer.exports, calls, warnings, cacheWrites, timers };
}

function rejectOnAbort(pending, signal) {
  signal.addEventListener("abort", () => pending.reject(signal.reason ?? new Error("Provider aborted")), { once: true });
  return pending.promise;
}

test("a validated fast provider returns while the other provider is pending and aborts the loser", async () => {
  const slow = deferred();
  const yahoo = yahooHarness((call) => call.url.includes("query1.")
    ? rejectOnAbort(slow, call.signal)
    : Promise.resolve(chartResponse([100.111, 110.125])));
  const result = observe(yahoo.getStockChart("AAPL", ["1M"]));
  await turn();
  // No resolution was supplied for query1. Waiting for all providers would
  // leave this pending; a real winner must resolve without a timing threshold.
  assert.equal(result.status, "fulfilled");
  assert.deepEqual(result.value["1M"].map((point) => point.close), [100.11, 110.13]);
  assert.equal(yahoo.calls.length, 2);
  assert.equal(yahoo.calls.find((call) => call.url.includes("query1.")).signal.aborted, true);
  assert.equal(yahoo.timers.size, 0);
  assert.equal(yahoo.warnings.length, 0);
});

test("daily movers retain fast validated quotes without waiting for the backup or their deadline", async () => {
  const slow = deferred();
  const times = ["2026-10-07T20:00:00Z", "2026-10-08T13:30:00Z", "2026-10-08T15:00:00Z"]
    .map((date) => Date.parse(date) / 1000);
  const yahoo = yahooHarness((call) => call.url.includes("query1.")
    ? rejectOnAbort(slow, call.signal)
    : Promise.resolve(chartResponse([100, 105, 110], times)));
  const result = observe(yahoo.getOneDayMoveMap([" aapl "]));
  // The daily deadline and two provider deadlines are active initially. No
  // deadline is fired and the pending backup receives no manual resolution.
  assert.equal(yahoo.timers.size, 3);
  await turn();
  assert.equal(result.status, "fulfilled");
  const mover = result.value.get("AAPL");
  assert.deepEqual(mover, { ticker: "AAPL", currentPrice: 110, changePct: 10 });
  // Reference must be the prior session's 100 close, not today's 105 open.
  assert.ok(Math.abs(mover.currentPrice / (1 + mover.changePct / 100) - 100) < 0.000001);
  assert.equal(yahoo.calls.length, 2);
  assert.ok(yahoo.calls.every((call) => new URL(call.url).searchParams.get("range") === "5d"));
  assert.equal(yahoo.calls.find((call) => call.url.includes("query1.")).signal.aborted, true);
  assert.equal(yahoo.timers.size, 0);
  assert.equal(yahoo.warnings.length, 0);
});

test("an early provider failure waits for a valid response from the other provider", async () => {
  const second = deferred();
  const yahoo = yahooHarness((call) => call.url.includes("query1.")
    ? Promise.resolve(failureResponse())
    : rejectOnAbort(second, call.signal));
  const result = observe(yahoo.getStockChart("MSFT", ["1M"]));
  await turn();
  assert.equal(result.status, "pending");
  assert.equal(yahoo.cacheWrites.length, 0);
  second.resolve(chartResponse([200, 202]));
  await turn();
  assert.equal(result.status, "fulfilled");
  assert.deepEqual(result.value["1M"].map((point) => point.close), [200, 202]);
  assert.equal(yahoo.warnings.length, 0);
  assert.equal(yahoo.timers.size, 0);
});

test("fast unusable and one-point charts cannot defeat a slower valid chart", async () => {
  for (const closes of [[null, 0, -5], [100]]) {
    const second = deferred();
    const yahoo = yahooHarness((call) => call.url.includes("query1.")
      ? Promise.resolve(chartResponse(closes))
      : rejectOnAbort(second, call.signal));
    const result = observe(yahoo.getStockChart("NVDA", ["5D"]));
    await turn();
    assert.equal(result.status, "pending");
    assert.equal(yahoo.cacheWrites.length, 0);
    second.resolve(chartResponse([50, 55]));
    await turn();
    assert.equal(result.status, "fulfilled");
    assert.deepEqual(result.value["5D"].map((point) => point.close), [50, 55]);
    assert.equal(yahoo.cacheWrites.length, 1);
  }
});

test("both providers failing return no fabricated range and create no successful cache entry", async () => {
  const yahoo = yahooHarness((call) => Promise.resolve(call.url.includes("query1.")
    ? failureResponse(503) : chartResponse([100])));
  const result = await yahoo.getStockChart("FAIL", ["1M"]);
  assert.deepEqual(result, {});
  assert.equal(yahoo.getLatestPriceFromChart(result), null);
  assert.equal(yahoo.cacheWrites.length, 0);
  assert.equal(yahoo.warnings.length, 1);
  assert.equal(yahoo.calls.length, 2);
  assert.equal(yahoo.timers.size, 0);
});

test("concurrent normalized ticker and range reads share one pair of provider attempts", async () => {
  const first = deferred(), second = deferred();
  const yahoo = yahooHarness((call) => rejectOnAbort(call.url.includes("query1.") ? first : second, call.signal));
  const left = observe(yahoo.getStockChart("  aapl ", ["1M"]));
  const right = observe(yahoo.getStockChart("AAPL", ["1M"]));
  await turn();
  assert.equal(yahoo.calls.length, 2);
  assert.equal(left.status, "pending");
  assert.equal(right.status, "pending");
  second.resolve(chartResponse([300, 330]));
  await turn();
  assert.equal(left.status, "fulfilled");
  assert.equal(right.status, "fulfilled");
  assert.deepEqual(left.value, right.value);
  assert.equal(yahoo.cacheWrites.length, 1);
  assert.equal(yahoo.calls.length, 2);
  assert.equal(yahoo.timers.size, 0);
});

test("a failed pending read is cleared so the next request can retry successfully", async () => {
  let failing = true;
  const yahoo = yahooHarness(() => Promise.resolve(failing ? failureResponse() : chartResponse([400, 440])));
  assert.deepEqual(await yahoo.getStockChart("RETRY", ["1M"]), {});
  assert.equal(yahoo.calls.length, 2);
  assert.equal(yahoo.cacheWrites.length, 0);
  failing = false;
  const retried = await yahoo.getStockChart("RETRY", ["1M"]);
  assert.deepEqual(retried["1M"].map((point) => point.close), [400, 440]);
  assert.equal(yahoo.calls.length, 4);
  assert.equal(yahoo.cacheWrites.length, 1);
  // A subsequent successful read can reuse the confirmed memory result.
  assert.deepEqual(await yahoo.getStockChart("RETRY", ["1M"]), retried);
  assert.equal(yahoo.calls.length, 4);
});

test("different ranges retain their own requests and values", async () => {
  const yahoo = yahooHarness((call) => Promise.resolve(chartResponse(new URL(call.url).searchParams.get("range") === "1d" ? [10, 11] : [20, 22])));
  const result = await yahoo.getStockChart("RANGES", ["1D", "5D"]);
  assert.equal(yahoo.calls.length, 4);
  assert.deepEqual(result["1D"].map((point) => point.close), [10, 11]);
  assert.deepEqual(result["5D"].map((point) => point.close), [20, 22]);
});
