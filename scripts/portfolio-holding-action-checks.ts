import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function source(path: string) { return readFileSync(resolve(path), "utf8"); }
function actionBlock(value: string, name: string, next: string) {
  const start = value.indexOf(`export async function ${name}`);
  const end = value.indexOf(`export async function ${next}`, start + 1);
  assert(start >= 0 && end > start, `Could not isolate ${name}`);
  return value.slice(start, end);
}

const management = source("lib/actions/portfolio-management.ts");
const mutation = source("lib/portfolio-holding-mutation.ts");
const migration = source("supabase/migrations/20260830075518_make_portfolio_holding_mutations_atomic.sql");
const retiredRoute = source("app/api/portfolio/trim-and-reinvest/route.ts");
const manageDrawer = source("components/ManageHoldingDrawer.tsx");
const commandCentre = source("components/PortfolioCommandCentreRevolut.tsx");
const savedPortfolio = source("components/SavedPortfolio.tsx");

assert(/type LogExistingHoldingInput = \{\s*portfolioId: string;/u.test(management), "External log must require portfolioId");
assert(/type BuyHoldingWithCashInput = \{\s*portfolioId: string;/u.test(management), "Cash buy must require portfolioId");
for (const [name, next, rpc] of [
  ["logExistingHolding", "buyHoldingWithCash", "logExistingPortfolioHolding"],
  ["buyHoldingWithCash", "updateHoldingDetails", "buyPortfolioHolding"],
  ["updateHoldingDetails", "trimHolding", "correctPortfolioHolding"],
  ["trimHolding", "removeHolding", "sellPortfolioHolding"],
  ["removeHolding", "markReviewed", "removePortfolioHoldingTracking"],
] as const) {
  const block = actionBlock(management, name, next);
  assert(block.includes(rpc), `${name} must use ${rpc}`);
  assert(!block.includes("getOrCreatePortfolio"), `${name} must not select/create a fallback Portfolio`);
  assert(!block.includes("recordTransaction"), `${name} must not append a split ledger row`);
  assert(!block.includes("recalculatePortfolioTotals"), `${name} must not derive contribution from holdings cost`);
  assert(!/\.from\("user_portfolios"\)\s*\.update/su.test(block), `${name} must not directly update Portfolio finance`);
}
assert(!management.includes("export async function addHolding("), "No-ID addHolding wrapper must be retired");
assert(!management.includes("export async function addHoldingByAmount("), "No-ID amount wrapper must be retired");
assert(!management.includes("export async function updateEntryPrice("), "Ticker-only correction wrapper must be retired");
assert(!management.includes("export async function updateShares("), "Ticker-only shares wrapper must be retired");
assert(!actionBlock(management, "updateHoldingDetails", "trimHolding").includes("removeHolding("), "Zero-share correction must not become removal");
const removeInput = management.slice(
  management.indexOf("type RemoveHoldingInput"),
  management.indexOf("type MarkReviewedInput"),
);
const removeAction = actionBlock(management, "removeHolding", "markReviewed");
assert(!removeInput.includes("creditCash"), "RemoveHoldingInput must not expose sale/cash semantics");
assert(!removeAction.includes("creditCash"), "removeHolding must not branch on cash semantics");
assert(!removeAction.includes("trimHolding("), "removeHolding must never call the sale action");
assert(!removeAction.includes("sellPortfolioHolding"), "removeHolding must never call the sale RPC wrapper");
assert(!manageDrawer.includes("creditCash"), "Manage Holding must not represent sale versus removal as a boolean");
assert(!commandCentre.includes("creditCash"), "Legacy command centre must not retain the sale/removal boolean escape hatch");
assert(!savedPortfolio.includes("creditCash"), "Saved Portfolio must not retain the sale/removal boolean escape hatch");
assert(manageDrawer.includes("function runFullSale()"), "Manage Holding must expose an explicit full-sale flow");
assert(manageDrawer.includes("function runRemoveFromTracking()"), "Manage Holding must expose an explicit remove-from-tracking flow");
assert(
  manageDrawer.includes('trimHolding({ portfolioId, ticker: holding.ticker, percentage: 100 })'),
  "Full sale must continue through the explicit sale path",
);
assert(
  manageDrawer.includes('removeHolding({ portfolioId, ticker: holding.ticker })'),
  "Remove from tracking must pass only exact Portfolio/ticker identity",
);

for (const forbidden of ["userId:", "cashBalance:", "cashDepositedTotal:", "realisedPnl:", "createdAt:", "occurredAt:", "transactionType:"]) {
  const callInputs = mutation.matchAll(/input: \{([\s\S]*?)\},\n\): Promise<PortfolioHoldingMutationResult>/gu);
  for (const match of callInputs) assert(!match[1].includes(forbidden), `RPC input exposes ${forbidden}`);
}
assert(retiredRoute.includes("status: 410"), "Legacy trim/reinvest route must be retired");
assert(!retiredRoute.includes("createClient"), "Retired route must not access Supabase");
assert(migration.includes("cash_deposited_total = round(v_contributed + v_cost, 2)"), "External log must increase net contribution");
assert(!migration.includes("investment_amount ="), "Holding RPCs must not mutate investment_amount");
assert(migration.includes("'Holding removed from tracking; no sale recorded.'"), "Remove tracking must be neutral and explicit");
assert(migration.includes("'Holding facts corrected.'"), "Correction must be represented as adjustment");
assert(management.includes("[portfolio-holding] Post-commit Portfolio refresh failed."), "Derived refresh must be best-effort");

console.log("Portfolio holding exact-ID, atomic-RPC, semantic and retired-route source contracts passed.");
