import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as summaries from "../lib/news-summary.ts";

const publisherSummary = "The company increased its annual revenue forecast after stronger demand for cloud services. Sales rose across its largest markets.";
function routeFixture(options = {}) {
  const observed = { adminCalls: 0, sourceUrls: [], updates: [], filters: [], rateCalls: 0 };
  const article = options.article ?? { id: "123", title: "Company raises outlook", source: "Publisher", url: "https://publisher.com/story", summary: "https://publisher.com/story" };
  const query = {
    select() { return this; },
    eq(key, value) { observed.filters.push([key, value]); return this; },
    is(key, value) { observed.filters.push([key, value]); return this; },
    maybeSingle: async () => ({ data: article, error: null }),
    update(value) { observed.updates.push(value); return this; },
    then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
  };
  const modules = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "next/cache": { unstable_cache: fn => fn },
    "@/lib/news-summary": summaries,
    "@/lib/news-publisher": {
      fetchPublicNewsPage: async () => { throw new Error("Unexpected page call"); },
      fetchPublisherSummary: async url => { observed.sourceUrls.push(url); return options.unavailable ? null : publisherSummary; },
    },
    "@/lib/news-source-url": { resolveNewsSourceUrl: async url => url },
    "@/lib/subscription": { hasActiveSubscription: status => status === "core" },
    "@/lib/security/rate-limit": {
      rateKey: () => "private-user-key",
      checkRateLimit: async () => { observed.rateCalls++; return { allowed: options.rateAllowed !== false, retryAfterSeconds: 60 }; },
      tooManyRequests: () => Response.json({ error: "Too many attempts" }, { status: 429 }),
    },
    "@/utils/supabase/admin": { createAdminClient: () => { observed.adminCalls++; return { from: () => query }; } },
    "@/utils/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: options.loggedOut ? null : { id: "user-1" } } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { subscription_status: options.unsubscribed ? "none" : "core" } }) }) }) }),
    }) },
  };
  const source = readFileSync(new URL("../app/api/news/summary/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)(name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  }, exports);
  return { observed, request: params => exports.GET({ nextUrl: new URL(`https://stockgpt.pro/api/news/summary?${params}`) }) };
}

test("news summary requires authentication and a paid plan before any article/source read", async () => {
  for (const [options, status] of [[{ loggedOut: true }, 401], [{ unsubscribed: true }, 403]]) {
    const fixture = routeFixture(options);
    assert.equal((await fixture.request("id=123")).status, status);
    assert.equal(fixture.observed.adminCalls, 0);
    assert.deepEqual(fixture.observed.sourceUrls, []);
  }
});
test("URL parameters cannot choose a publisher; a stored article ID supplies the source", async () => {
  const fixture = routeFixture();
  const response = await fixture.request("id=123&url=https://127.0.0.1/private");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).summary, publisherSummary);
  assert.deepEqual(fixture.observed.sourceUrls, ["https://publisher.com/story"]);
  assert.deepEqual(fixture.observed.updates, [{ summary: publisherSummary }]);
  assert.ok(fixture.observed.filters.some(([key, value]) => key === "summary" && value === "https://publisher.com/story"));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("missing summaries save with SQL NULL matching and readable summaries avoid another source request", async () => {
  const empty = routeFixture({ article: { id: "123", title: "Company news", summary: null, url: "https://publisher.com/story" } });
  await empty.request("id=123");
  assert.ok(empty.observed.filters.some(([key, value]) => key === "summary" && value === null));
  const existing = routeFixture({ article: { id: "123", title: "Company news", summary: publisherSummary, url: "https://publisher.com/story" } });
  assert.equal((await (await existing.request("id=123")).json()).summary, publisherSummary);
  assert.equal(existing.observed.rateCalls, 0);
  assert.deepEqual(existing.observed.sourceUrls, []);
});
test("blocked publishers and request limits cannot fabricate or save a summary", async () => {
  const unavailable = routeFixture({ unavailable: true });
  assert.deepEqual(await (await unavailable.request("id=123")).json(), { summary: null });
  assert.deepEqual(unavailable.observed.updates, []);
  const limited = routeFixture({ rateAllowed: false });
  assert.equal((await limited.request("id=123")).status, 429);
  assert.deepEqual(limited.observed.sourceUrls, []);
  assert.equal((await limited.request("id=..%2F..%2Fprivate")).status, 400);
});
