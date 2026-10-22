import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  mapTrading212Positions,
  parseTrading212Csv,
  type Trading212InvestmentPosition,
} from "../lib/trading212-csv";
import {
  TRADING212_CSV_MAX_BYTES,
  TRADING212_CSV_MAX_ENCODED_BYTES,
  TRADING212_CSV_UPLOAD_LIMIT_MESSAGE,
  trading212CsvUploadError,
} from "../lib/trading212-csv-upload";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function csv(rows: string[]) {
  return ["Action,Time,Ticker,No. of shares,Price / share,Total,Currency (Price / share)", ...rows.map((row) => `${row},USD`)].join("\n");
}

assert(trading212CsvUploadError("A".repeat(TRADING212_CSV_MAX_BYTES)) === null, "Exact raw byte boundary was rejected");
assert(trading212CsvUploadError("A".repeat(TRADING212_CSV_MAX_BYTES + 1)) !== null, "Over-budget raw bytes were accepted");
assert(trading212CsvUploadError("€".repeat(TRADING212_CSV_MAX_BYTES / 3)) === null, "Exact multibyte UTF-8 boundary was rejected");
assert(trading212CsvUploadError("€".repeat(TRADING212_CSV_MAX_BYTES / 3 + 1)) !== null, "JS character count bypassed UTF-8 byte bound");
assert(trading212CsvUploadError("😀".repeat(TRADING212_CSV_MAX_BYTES / 4)) === null, "Astral Unicode byte boundary was rejected");
const encodedBoundary = '"'.repeat((TRADING212_CSV_MAX_ENCODED_BYTES - 2) / 2);
assert(trading212CsvUploadError(encodedBoundary) === null, "Exact encoded boundary was rejected");
assert(trading212CsvUploadError(`${encodedBoundary}\"`) !== null, "Escaped quote payload bypassed encoded budget");
assert(trading212CsvUploadError(`A${"\n".repeat(TRADING212_CSV_MAX_ENCODED_BYTES / 2)}`) !== null, "Escaped newline payload bypassed encoded budget");
assert(trading212CsvUploadError("") !== null && trading212CsvUploadError(" \n") !== null, "Empty upload was accepted");
assert(TRADING212_CSV_UPLOAD_LIMIT_MESSAGE.includes("Do not remove required transaction history"), "Upload error encourages partial history");

function accepted(rows: string[]) {
  const result = parseTrading212Csv(csv(rows));
  assert(result.accepted, result.accepted ? "" : result.issues.join(" "));
  return result;
}

function position(rows: string[], ticker: string) {
  const result = accepted(rows).positions.find((item) => item.sourceTicker === ticker);
  assert(result, `${ticker} position was not reconstructed`);
  return result;
}

const buyOnly = position(
  [
    "Market buy,2026-01-01 09:00:00,AAA,10,100,1000",
    "Market buy,2026-01-02 09:00:00,AAA,10,200,2000",
  ],
  "AAA",
);
assert(buyOnly.shares === 20, "Buy-only shares are incorrect");
assert(buyOnly.entryPrice === 150, "Buy-only weighted average is incorrect");
assert(buyOnly.costBasis === 3000, "Buy-only basis is incorrect");

const partialSale = position(
  [
    "Market sell,2026-01-02 09:00:00,AAA,4,150,600",
    "Market buy,2026-01-01 09:00:00,AAA,10,100,1000",
  ],
  "AAA",
);
assert(partialSale.shares === 6, "Partial sale shares are incorrect");
assert(partialSale.entryPrice === 100, "Sale proceeds changed remaining average cost");
assert(partialSale.costBasis === 600, "Partial sale remaining basis is incorrect");

const buyBuySell = position(
  [
    "Market buy,2026-01-01 09:00:00,AAA,10,100,1000",
    "Market buy,2026-01-02 09:00:00,AAA,10,200,2000",
    "Market sell,2026-01-03 09:00:00,AAA,5,300,1500",
  ],
  "AAA",
);
assert(buyBuySell.shares === 15, "Buy/buy/sell shares are incorrect");
assert(buyBuySell.entryPrice === 150, "Buy/buy/sell average cost is incorrect");
assert(buyBuySell.costBasis === 2250, "Buy/buy/sell basis is incorrect");

const closedWithOpen = accepted([
  "Market buy,2026-01-01 09:00:00,XYZ,10,10,100",
  "Market sell,2026-01-02 09:00:00,XYZ,10,12,120",
  "Market buy,2026-01-03 09:00:00,AAA,2,50,100",
]);
assert(
  closedWithOpen.positions.length === 1 && closedWithOpen.positions[0].sourceTicker === "AAA",
  "A deterministically closed position should not become an imported holding",
);

const accountRows = accepted([
  "Market buy,2026-01-01 09:00:00,AAA,2,50,100",
  "Dividend,2026-01-02 09:00:00,,,,5",
  "Deposit,2026-01-03 09:00:00,,,,500",
  "Fee,2026-01-04 09:00:00,,,,1",
]);
assert(accountRows.ignoredNonInvestmentRows === 3, "Account-only rows were not ignored explicitly");
assert(accountRows.positions.length === 1, "Account-only rows changed reconstructed holdings");

const malformed = parseTrading212Csv(csv([
  "Market buy,2026-01-01 09:00:00,AAA,2,50,100",
  "Market buy,2026-01-02 09:00:00,BBB,not-a-number,25,50",
]));
assert(!malformed.accepted, "Malformed genuine investment row did not refuse the whole file");

const missingChronology = parseTrading212Csv(csv([
  "Market buy,,AAA,10,100,1000",
  "Market sell,,AAA,4,150,600",
]));
assert(!missingChronology.accepted, "Sale without chronological evidence was accepted");

let additionalCases = 0;
function refused(text: string, reason: string) {
  const parsed = parseTrading212Csv(text);
  assert(!parsed.accepted && parsed.positions.length === 0, reason);
  additionalCases += 1;
}
for (const [name, rows] of [
  ["partial history", ["Market sell,2026-01-01 09:00:00,AAA,2,50,100"]],
  ["duplicate rows", ["Market buy,2026-01-01 09:00:00,AAA,2,50,100", "Market buy,2026-01-01 09:00:00,AAA,2,50,100"]],
  ["negative shares", ["Market buy,2026-01-01,AAA,-2,50,100"]],
  ["negative price", ["Market buy,2026-01-01,AAA,2,-50,100"]],
  ["missing price, positive total", ["Market buy,2026-01-01,AAA,2,,100"]],
  ["zero after shares normalization", ["Market buy,2026-01-01,AAA,0.00000001,50,100"]],
  ["zero after price normalization", ["Market buy,2026-01-01,AAA,2,0.000001,100"]],
  ["invalid leap day", ["Market buy,2026-02-29,AAA,2,50,100"]],
  ["invalid UK date", ["Market buy,31/04/2026,AAA,2,50,100"]],
  ["invalid hours", ["Market buy,2026-01-01 24:00:00,AAA,2,50,100"]],
  ["date suffix", ["Market buy,2026-01-01 unexpected,AAA,2,50,100"]],
  ["missing action", [",2026-01-01,AAA,2,50,100"]],
  ["corporate action without ticker", ["Market buy,2026-01-01,AAA,2,50,100", "Stock split,2026-01-02,,,,"]],
  ["ambiguous transfer", ["Market buy,2026-01-01,AAA,2,50,100", "Transfer,2026-01-02,,,,"]],
  ["dividend reinvestment", ["Market buy,2026-01-01,AAA,2,50,100", "Dividend reinvestment,2026-01-02,AAA,1,50,50"]],
  ["ticker with unexplained suffix", ["Market buy,2026-01-01,AAA unknown,2,50,100"]],
] as const) refused(csv([...rows]), `${name} was accepted`);
const currencyHeader = "Action,Time,Ticker,No. of shares,Price / share,Total,Currency (Price / share)";
for (const currency of ["GBP", "EUR", "GBX", ""]) {
  refused(`${currencyHeader}\nMarket buy,2026-01-01,AAA,2,50,100,${currency}`, `${currency || "missing"} price currency was accepted as USD`);
}
refused("Action,Time,Ticker,No. of shares,Price / share,Total\nMarket buy,2026-01-01,AAA,2,50,100", "Missing currency column was accepted");
refused(`${currencyHeader}\nMarket buy,2026-01-01,AAA,2,50,100,USD,extra`, "Extra CSV column was silently discarded");
refused(`${currencyHeader}\nMarket buy,2026-01-01,AAA,2,50,100`, "Truncated CSV row was accepted");
refused(`${currencyHeader},Ticker\nMarket buy,2026-01-01,AAA,2,50,100,USD,BBB`, "Duplicate header overwrote ticker");
refused(`${currencyHeader}\nMarket buy,2026-01-01,\"AAA,2,50,100,USD`, "Unfinished quote was accepted");
refused(`${currencyHeader}\nMarket buy,2026-01-01,AAA,2,5\"0\",100,USD`, "Stray quote changed financial amount");
refused(`${currencyHeader}\nMarket buy,2026-01-01,AAA,\"1,5\",50,100,USD`, "Ambiguous decimal comma became a larger quantity");
refused(`${currencyHeader}\nMarket buy,2026-01-01,AAA,1 5,50,100,USD`, "Internal whitespace became a larger quantity");
refused(`${currencyHeader},ID\nMarket buy,2026-01-01,AAA,2,50,100,USD,event-1\nMarket buy,2026-01-02,AAA,2,50,100,USD,event-1`, "Repeated transaction ID was accepted");
const distinctIds = parseTrading212Csv(`${currencyHeader},ID\nMarket buy,2026-01-01,AAA,2,50,100,USD,event-1\nMarket buy,2026-01-01,AAA,2,50,100,USD,event-2`);
assert(distinctIds.accepted && distinctIds.positions[0].shares === 4, "Independent transaction IDs were deduplicated");
const ukDates = position(["Market buy,29/02/2024 09:00:00,AAA,10,100,1000", "Market sell,01/03/2024 09:00:00,AAA,4,120,480"], "AAA");
assert(ukDates.shares === 6 && ukDates.purchaseDate === "2024-02-29", "Valid UK leap-year dates did not reconstruct");
const reopened = position(["Market buy,2026-01-01,AAA,2,50,100", "Market sell,2026-01-02,AAA,2,60,120", "Market buy,2026-01-03,AAA,1,70,70"], "AAA");
assert(reopened.purchaseDate === "2026-01-03" && reopened.costBasis === 70, "Closed position leaked date or basis into reopened position");
const replayText = csv(["Market buy,2026-01-01,AAA,2,50,100"]);
assert(JSON.stringify(parseTrading212Csv(replayText)) === JSON.stringify(parseTrading212Csv(replayText)), "Repeat upload parsing is not deterministic");
const accountFx = parseTrading212Csv(`${currencyHeader},Currency (Total),Exchange rate\nMarket buy,2026-01-01,AAA,2,50,80,USD,GBP,0.8`);
assert(accountFx.accepted && accountFx.positions[0].costBasis === 100, "Account total/FX overrode explicit USD execution basis");
const quotedThousands = parseTrading212Csv(`${currencyHeader}\nMarket buy,2026-01-01,AAA,2,\"1,234.50\",2469,USD`);
assert(quotedThousands.accepted && quotedThousands.positions[0].costBasis === 2469, "Unambiguous quoted thousands were rejected");
const reverseBuys = position(["Market buy,2026-01-03,AAA,2,50,100", "Market buy,2026-01-01,AAA,2,50,100"], "AAA");
assert(reverseBuys.purchaseDate === "2026-01-01", "Reverse-sorted buys retained the wrong earliest purchase date");
const unknownDate = position(["Market buy,,AAA,2,50,100", "Market buy,2026-01-01,AAA,2,50,100"], "AAA");
assert(unknownDate.purchaseDate === null, "A known purchase date concealed another purchase with unknown timing");

const supported = [
  { ticker: "AAA", score: 80, rank: 1 },
  { ticker: "BBB", score: 70, rank: 2 },
];
const unsupportedPositions: Trading212InvestmentPosition[] = [
  { sourceTicker: "AAA", shares: 1, entryPrice: 10, costBasis: 10, purchaseDate: null },
  { sourceTicker: "XYZ", shares: 1, entryPrice: 20, costBasis: 20, purchaseDate: null },
];
const unsupported = mapTrading212Positions(unsupportedPositions, supported);
assert(!unsupported.accepted, "Unsupported positive position did not refuse mapping");
assert(
  !unsupported.accepted && unsupported.unsupportedTickers.join(",") === "XYZ",
  "Unsupported ticker was not reported",
);

const mapped = mapTrading212Positions(
  [{ sourceTicker: "AAA_US_EQ", shares: 2, entryPrice: 10, costBasis: 20, purchaseDate: null }],
  supported,
);
assert(mapped.accepted && mapped.holdings[0].ticker === "AAA", "Known Trading 212 US suffix did not map");

const ambiguous = mapTrading212Positions(
  [{ sourceTicker: "BRK.B", shares: 1, entryPrice: 100, costBasis: 100, purchaseDate: null }],
  [
    { ticker: "BRK.B", score: 70, rank: 3 },
    { ticker: "BRK-B", score: 70, rank: 3 },
  ],
);
assert(!ambiguous.accepted, "Ambiguous dot/hyphen alias mapping was guessed");

const actions = readFileSync(resolve("lib/actions/portfolio-management.ts"), "utf8");
const creator = readFileSync(resolve("components/Trading212PortfolioCreator.tsx"), "utf8");
const importer = readFileSync(resolve("components/Trading212CsvImport.tsx"), "utf8");
const mutation = readFileSync(resolve("lib/portfolio-csv-mutation.ts"), "utf8");
const preparation = readFileSync(resolve("lib/trading212-import.ts"), "utf8");
assert((actions.match(/const uploadError = trading212CsvUploadError\(/gu) ?? []).length === 4,
  "All four CSV actions must validate raw and encoded byte budgets");
assert(!actions.includes("2_000_000"), "CSV actions retain unreachable character-based upload budget");
for (const component of [creator, importer]) {
  assert(component.includes("file.size > TRADING212_CSV_MAX_BYTES"), "CSV chooser does not enforce shared byte budget");
  assert(component.includes("trading212CsvUploadError(text)"), "CSV chooser does not validate encoded text budget");
  assert(!component.includes("under 2MB"), "CSV chooser still advertises unreachable 2MB uploads");
}
const migration = readFileSync(
  resolve("supabase/migrations/20260830185702_make_trading212_import_atomic.sql"),
  "utf8",
);

function actionBlock(name: string, next: string) {
  const start = actions.indexOf(`export async function ${name}`);
  const end = actions.indexOf(`export async function ${next}`, start + 1);
  assert(start >= 0 && end > start, `${name} action block was not found`);
  return actions.slice(start, end);
}

const createAction = actionBlock("createPortfolioFromTrading212Csv", "importTrading212Csv");
const replaceAction = actionBlock("importTrading212Csv", "addCash");
for (const [label, block] of [["create", createAction], ["replace", replaceAction]] as const) {
  assert(!block.includes('.from("user_portfolios")'), `CSV ${label} still writes Portfolio directly`);
  assert(!block.includes('.from("portfolio_holdings")'), `CSV ${label} still writes holdings directly`);
  assert(!block.includes("recordTransaction("), `CSV ${label} still writes ledger separately`);
  assert(block.includes("prepareTrading212Import"), `CSV ${label} bypasses shared preparation`);
}
assert(createAction.includes("createTrading212PortfolioAtomically"), "CSV creation does not use atomic RPC wrapper");
assert(
  replaceAction.includes("replacePortfolioHoldingsFromTrading212Atomically"),
  "CSV replacement does not use atomic RPC wrapper",
);
assert(!actions.includes("replaceExisting"), "Active CSV contract still exposes merge/replace mode");
assert(!actions.includes("mergeHoldingPosition"), "Active CSV path still contains merge logic");
assert(!actions.includes("ensureDepositedCoversCurrentValue"), "CSV path still rewrites contribution from holdings");
assert(!actions.includes("skippedTickers"), "CSV action still exposes skipped positive holdings semantics");
assert(
  createAction.includes("Post-commit CSV Portfolio refresh failed") &&
    replaceAction.includes("Post-commit CSV replacement refresh failed"),
  "Post-commit derived failures are not isolated from committed CSV mutations",
);
assert(!creator.includes("skippedTickers") && !importer.includes("skippedTickers"), "UI still presents skipped holdings");
assert(!importer.includes("replaceExisting"), "Existing-Portfolio UI still offers merge mode");
assert(importer.includes("Existing cash, net contributions and prior activity stay unchanged"), "Replacement warning is incomplete");
assert(creator.includes("Cash is not imported"), "New-Portfolio cash warning is missing");
assert(preparation.includes("parseTrading212Csv(csvText)"), "Preview/commit preparation does not share the parser");
for (const forbiddenRpcInput of ["p_user_id", "p_cash", "p_contribution", "p_currency", "p_transaction_type"]) {
  assert(!mutation.includes(forbiddenRpcInput), `CSV RPC input exposes ${forbiddenRpcInput}`);
}
assert(migration.includes("for update"), "Replacement RPC does not lock the Portfolio");
assert(migration.includes("'import', 0, 'USD'"), "Replacement audit event is not neutral");
assert(migration.includes("upper(trim(coalesce(v_portfolio.currency, ''))) <> 'USD'"), "Replacement does not fail closed for non-USD storage");

console.log(`Trading 212 parser, whole-file refusal, cost-basis and atomic source contracts passed; ${additionalCases} hostile reconstruction cases rejected.`);
