import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();

function loadTsModule(relativePath) {
  const filename = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;

  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const {
  buildPortfolioSnapshotChartDataFromRows,
  getFirstLiveSnapshotMs,
} = loadTsModule("lib/portfolio-snapshots.ts");

function iso(ms) {
  return new Date(ms).toISOString();
}

function row({ ms, value, cash, source }) {
  return {
    snapshot_at: iso(ms),
    value,
    cash,
    basis: 1000,
    pnl: value - 1000,
    pnl_pct: ((value - 1000) / 1000) * 100,
    source,
  };
}

function assertSortedUnique(points, createdMs) {
  const seen = new Set();
  let previous = 0;
  points.forEach((point) => {
    const ms = new Date(point.date).getTime();
    assert.ok(Number.isFinite(ms), "point date must parse");
    assert.ok(ms >= createdMs, "point must not predate portfolio creation");
    assert.ok(ms >= previous, "points must be sorted ascending");
    assert.ok(!seen.has(ms), "points must not duplicate timestamps");
    assert.ok(point.close >= 0, "point close must be non-negative");
    if (point.cash != null) assert.ok(point.cash >= 0, "point cash must be non-negative");
    if (point.basis != null) assert.ok(point.basis >= 0, "point basis must be non-negative");
    seen.add(ms);
    previous = ms;
  });
}

const createdMs = Date.parse("2026-05-01T00:00:00.000Z");
const nowMs = Date.parse("2026-06-01T00:00:00.000Z");
const firstLiveMs = Date.parse("2026-05-20T00:00:00.000Z");
const rows = [];

for (let day = 0; day < 30; day += 1) {
  const ms = createdMs + day * 86_400_000;
  rows.push(row({ ms, value: 1000 + day, cash: 0, source: "backfill" }));
}

rows.push(row({ ms: firstLiveMs, value: 1250, cash: 2334, source: "cron_refresh" }));
rows.push(row({ ms: firstLiveMs + 5 * 60_000, value: 1252, cash: 2334, source: "cron_refresh" }));
rows.push(row({ ms: firstLiveMs + 10 * 60_000, value: 9900, cash: 0, source: "backfill" }));

for (let offset = 24 * 60; offset >= 0; offset -= 5) {
  const ms = nowMs - offset * 60_000;
  rows.push(row({ ms, value: 1300 + (24 * 60 - offset) / 10, cash: 2334, source: "cron_refresh" }));
}

const firstLive = getFirstLiveSnapshotMs(rows);
assert.equal(firstLive, firstLiveMs);

const result = buildPortfolioSnapshotChartDataFromRows({
  rows,
  portfolioCreatedAt: iso(createdMs),
  nowMs,
});

assert.ok(result, "snapshot rows should build chart data");
assert.ok(result.stats.droppedHistoricalOverlap >= 11, "overlapping backfill rows must be dropped");

for (const points of Object.values(result.chartData)) {
  assertSortedUnique(points, createdMs);
  assert.ok(points.length <= 260, "range point count must be bounded");
  assert.ok(points.every((point) => point.close < 2000), "historical overlap spike must not leak");
}

const oneDay = result.chartData["1D"] ?? [];
assert.ok(oneDay.length > 1, "1D range should be available");
assert.ok(
  oneDay.every((point) => new Date(point.date).getTime() >= nowMs - 24 * 60 * 60_000),
  "1D range must contain only live-period points",
);

const oneMonth = result.chartData["1M"] ?? [];
assert.ok(oneMonth.length > 1, "1M range should be available");
const finalDayCount = oneMonth.filter(
  (point) => new Date(point.date).getTime() >= nowMs - 24 * 60 * 60_000,
).length;
assert.ok(finalDayCount <= 8, "1M final day must be bucketed, not raw 5-minute spam");
assert.ok(finalDayCount * 2 < oneMonth.length, "1M final day must not take half the points");

console.log("portfolio snapshot chart tests passed");
