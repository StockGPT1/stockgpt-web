import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildActivityItems } from "../components/portfolio-workspace/utils";
import type { PortfolioTransaction } from "../components/portfolio-workspace/types";
import {
  comparePortfolioTransactionActivityDesc,
  portfolioTransactionActivityAt,
} from "../lib/portfolio-transaction-chronology";
import { latestPortfolioInputChangeMs } from "../lib/portfolio-snapshots";

function fixture(
  id: string,
  occurredAt: string | null,
  recordedAt: string,
): PortfolioTransaction {
  return {
    id,
    portfolioId: "portfolio",
    ticker: "AAPL",
    type: "adjustment",
    shares: null,
    price: null,
    amount: 1,
    realisedPnl: null,
    currency: "USD",
    notes: null,
    occurredAt,
    recordedAt,
  };
}

const historicalRecordedToday = fixture(
  "historical",
  "2025-01-01T12:00:00Z",
  "2026-08-29T12:00:00Z",
);
const currentEvent = fixture(
  "current",
  "2026-08-28T12:00:00Z",
  "2026-08-28T12:01:00Z",
);
const legacyUnknown = fixture("legacy", null, "2026-07-01T12:00:00Z");

assert.equal(
  portfolioTransactionActivityAt(historicalRecordedToday),
  "2025-01-01T12:00:00Z",
  "Known occurrence must drive activity chronology",
);
assert.equal(
  portfolioTransactionActivityAt(legacyUnknown),
  legacyUnknown.recordedAt,
  "Legacy null occurrence must fall back to recorded time",
);
assert.deepEqual(
  [historicalRecordedToday, currentEvent, legacyUnknown]
    .sort(comparePortfolioTransactionActivityDesc)
    .map((transaction) => transaction.id),
  ["current", "legacy", "historical"],
  "Activity must order by occurrence with recorded fallback",
);
assert.deepEqual(
  buildActivityItems(
    [historicalRecordedToday, currentEvent, legacyUnknown],
    "USD",
  ).map((item) => item.id),
  ["transaction-current", "transaction-legacy", "transaction-historical"],
  "Portfolio Activity must use the shared best-event chronology",
);

const recordedChangeMs = latestPortfolioInputChangeMs({
  portfolioCreatedAt: null,
  holdings: [],
  transactions: [{ created_at: historicalRecordedToday.recordedAt }],
});
assert.equal(
  recordedChangeMs,
  new Date(historicalRecordedToday.recordedAt).getTime(),
  "Cache invalidation must use the recorded/change timestamp",
);

const snapshotsSource = readFileSync(resolve("lib/portfolio-snapshots.ts"), "utf8");
const changeFunctionStart = snapshotsSource.indexOf(
  "export function latestPortfolioInputChangeMs",
);
const changeFunctionEnd = snapshotsSource.indexOf(
  "\nexport function getFirstLiveSnapshotMs",
  changeFunctionStart,
);
assert(changeFunctionStart >= 0 && changeFunctionEnd > changeFunctionStart,
  "Could not locate latestPortfolioInputChangeMs source contract");
const changeFunction = snapshotsSource.slice(changeFunctionStart, changeFunctionEnd);
assert.match(changeFunction, /\["created_at", "createdAt"\]/u);
assert.doesNotMatch(changeFunction, /occurred/u);

const pageSource = readFileSync(resolve("app/portfolio/modern/page.tsx"), "utf8");
assert.match(pageSource, /notes,occurred_at,created_at/u);
assert.match(pageSource, /occurredAt:\s*transaction\.occurred_at/u);
assert.match(pageSource, /recordedAt:\s*transaction\.created_at/u);

const holdingMutationMigration = readFileSync(
  resolve("supabase/migrations/20260830075518_make_portfolio_holding_mutations_atomic.sql"),
  "utf8",
);
assert.match(
  holdingMutationMigration,
  /'log_existing'[\s\S]*'External holding added\.', null/u,
);

console.log("Portfolio ledger chronology and source-contract checks passed.");
