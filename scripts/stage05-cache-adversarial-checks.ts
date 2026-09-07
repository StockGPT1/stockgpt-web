import assert from "node:assert/strict";
import { createServer } from "node:http";

async function main() {
  // Real local HTTP transport exercising Redis decoding, keys and failure handling.
  // No repository environment file or external cache is loaded.
  const values = new Map<string, string>();
  const reads: string[] = [];
  let fail = false;
  const server = createServer(async (request, response) => {
    if (fail) { response.writeHead(503); response.end(); return; }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const commands = JSON.parse(Buffer.concat(chunks).toString()) as Array<Array<string | number>>;
    const result = commands.map(([command, rawKey, value]) => {
      const key = String(rawKey);
      if (command === "SET") { values.set(key, String(value)); return { result: "OK" }; }
      reads.push(key);
      return { result: values.get(key) ?? null };
    });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${address.port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = "synthetic-local-cache-test";
  process.env.REDIS_DISABLED_COOLDOWN_MS = "0";
  const { getLatestPortfolioChart, saveLatestPortfolioChart, PORTFOLIO_CHART_CACHE_VERSION } = await import("../lib/portfolio-chart-cache");
  const now = Date.parse("2026-09-07T16:00:00.000Z");
  const key = { ownerId: "synthetic-owner-a", portfolioId: "synthetic-portfolio-a", inputFingerprint: "synthetic-fingerprint-a" };
  const chartData = { "1M": Array.from({ length: 8 }, (_, i) => ({
    date: new Date(now - (7 - i) * 86400000).toISOString(), close: 100 + i,
    cash: 10, basis: -30, pnl: 130 + i,
  })) };
  try {
    await saveLatestPortfolioChart({ ...key, chartData, generatedAt: new Date(now).toISOString() });
    assert.equal(values.size, 1, "HTTP cache write was not exercised");
    const [cacheKey, saved] = [...values.entries()][0];
    assert(cacheKey.includes(`:${PORTFOLIO_CHART_CACHE_VERSION}:`));
    assert(await getLatestPortfolioChart({ ...key, nowMs: now }));
    for (const change of [{ ownerId: "other" }, { portfolioId: "other" }, { inputFingerprint: "other" }]) {
      assert.equal(await getLatestPortfolioChart({ ...key, ...change, nowMs: now }), null);
    }
    values.clear();
    values.set(cacheKey.replace(`:${PORTFOLIO_CHART_CACHE_VERSION}:`, ":v10:"), saved);
    assert.equal(await getLatestPortfolioChart({ ...key, nowMs: now }), null, "Old key was consumed");
    for (const malformed of ["not-json", "null", "[]", JSON.stringify({ ...JSON.parse(saved), ownerId: "other" }),
      JSON.stringify({ ...JSON.parse(saved), inputFingerprint: "other" }),
      JSON.stringify({ ...JSON.parse(saved), chartData: { "1M": [{ date: "invalid", close: 0 }] } })]) {
      values.set(cacheKey, malformed);
      assert.equal(await getLatestPortfolioChart({ ...key, nowMs: now }), null, "Corrupt cache was consumed");
    }
    values.set(cacheKey, saved);
    assert.equal(await getLatestPortfolioChart({ ...key, nowMs: now + 30 * 86400000 }), null, "Stale cache was consumed");
    assert.equal(await getLatestPortfolioChart({ ...key, nowMs: now - 86400000 }), null, "Future cache point was accepted as fresh");
    fail = true;
    assert.equal(await getLatestPortfolioChart({ ...key, nowMs: now }), null);
    await saveLatestPortfolioChart({ ...key, chartData });
    assert(reads.length > 5);
    console.log("05K: local HTTP Redis isolation, stale/future/corrupt payloads, old keys and read/write failure checks passed.");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
