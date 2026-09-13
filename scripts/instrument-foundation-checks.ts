import assert from "node:assert/strict";
import {
  classifyMarketDataCoverage,
  MARKET_DATA_COVERAGE,
  normalizeCurrentMarketPrice,
  resolveInstrumentAlias,
  type InstrumentAlias,
} from "../lib/instruments";

const asOf = "2026-02-01T00:00:00Z";
const firstId = "60000000-0000-4000-8000-000000000001";
const secondId = "60000000-0000-4000-8000-000000000002";
const aliases: InstrumentAlias[] = [
  { instrumentId: firstId, namespace: "stockgpt.ticker", scope: "XNAS", value: "NEW", validFrom: "2026-01-01T00:00:00Z" },
  { instrumentId: firstId, namespace: "stockgpt.ticker", scope: "XNAS", value: "OLD", validTo: "2026-01-01T00:00:00Z" },
  { instrumentId: firstId, namespace: "broker.alpha.instrument", scope: "", value: "alpha-1" },
  { instrumentId: firstId, namespace: "broker.beta.instrument", scope: "", value: "beta-9" },
  { instrumentId: secondId, namespace: "stockgpt.ticker", scope: "XLON", value: "NEW" },
];

assert.deepEqual(MARKET_DATA_COVERAGE, ["ranked", "tracked_only", "unsupported"]);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "stockgpt.ticker", scope: "XNAS", value: "NEW", asOf }), firstId);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "stockgpt.ticker", scope: "XNAS", value: "OLD", asOf }), null);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "stockgpt.ticker", scope: "XLON", value: "NEW", asOf }), secondId);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "broker.alpha.instrument", value: "alpha-1", asOf }), firstId);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "broker.beta.instrument", value: "beta-9", asOf }), firstId);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "market.unknown", value: "MISSING", asOf }), null);
assert.equal(resolveInstrumentAlias([
  { instrumentId: firstId, namespace: "ambiguous", scope: "", value: "DUP" },
  { instrumentId: secondId, namespace: "ambiguous", scope: "", value: "DUP" },
], { namespace: "ambiguous", value: "DUP", asOf }), null);
assert.equal(resolveInstrumentAlias([
  { instrumentId: firstId, namespace: "stockgpt.ticker", scope: "XNAS", value: "ABC", validTo: "2026-01-01T00:00:00Z" },
  { instrumentId: secondId, namespace: "stockgpt.ticker", scope: "XNAS", value: "ABC", validFrom: "2026-01-01T00:00:00Z" },
], { namespace: "stockgpt.ticker", scope: "XNAS", value: "ABC", asOf: "2025-06-01T00:00:00Z" }), firstId);
assert.equal(resolveInstrumentAlias([
  { instrumentId: firstId, namespace: "stockgpt.ticker", scope: "XNAS", value: "ABC", validTo: "2026-01-01T00:00:00Z" },
  { instrumentId: secondId, namespace: "stockgpt.ticker", scope: "XNAS", value: "ABC", validFrom: "2026-01-01T00:00:00Z" },
], { namespace: "stockgpt.ticker", scope: "XNAS", value: "ABC", asOf: "2026-06-01T00:00:00Z" }), secondId);
assert.equal(resolveInstrumentAlias([
  { instrumentId: firstId, namespace: "ambiguous", scope: "", value: "DUP" },
  { instrumentId: firstId, namespace: "ambiguous", scope: "", value: "DUP" },
], { namespace: "ambiguous", value: "DUP", asOf }), null);
assert.equal(resolveInstrumentAlias(aliases, { namespace: "stockgpt.ticker", scope: "XNAS", value: "NEW", asOf: "not-a-date" }), null);

assert.equal(classifyMarketDataCoverage({ instrumentId: firstId, hasRanking: true, hasTrackedMarketData: true }), "ranked");
assert.equal(classifyMarketDataCoverage({ instrumentId: firstId, hasRanking: false, hasTrackedMarketData: true }), "tracked_only");
assert.equal(classifyMarketDataCoverage({ instrumentId: firstId, hasRanking: false, hasTrackedMarketData: false }), "unsupported");
assert.equal(classifyMarketDataCoverage({ instrumentId: null, hasRanking: true, hasTrackedMarketData: true }), "unsupported");

for (const value of [null, undefined, "", 0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  assert.equal(normalizeCurrentMarketPrice(value), null, `Unknown/invalid price ${String(value)} became a market price`);
}
assert.equal(normalizeCurrentMarketPrice("42.5"), 42.5);

console.log("Instrument identity, alias, coverage and unknown-price contracts passed.");
