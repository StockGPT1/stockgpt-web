import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

function between(value: string, start: string, end: string) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex, `Could not isolate ${start}`);
  return value.slice(startIndex, endIndex);
}

const management = source("lib/actions/portfolio-management.ts");
const withdrawal = source("lib/actions/portfolio-cash.ts");
const mutation = source("lib/portfolio-cash-mutation.ts");
const addCash = between(
  management,
  "export async function addCash",
  "export async function savePortfolio",
);
const withdrawalAction = withdrawal.slice(
  withdrawal.indexOf("export async function withdrawPortfolioCash"),
);

assert(
  /type AddCashInput = \{\s*portfolioId: string;/u.test(management),
  "Deposit input must require an exact Portfolio ID",
);
assert(!addCash.includes("getOrCreatePortfolio"), "Deposit must not select/create a fallback Portfolio");
assert(!addCash.includes('.from("user_portfolios")'), "Deposit must not update Portfolio cash directly");
assert(!addCash.includes("recordTransaction"), "Deposit must not append its ledger row separately");
assert(addCash.includes("mutatePortfolioCash"), "Deposit must use the atomic cash RPC wrapper");

assert(
  withdrawalAction.includes("mutatePortfolioCash"),
  "Withdrawal must use the atomic cash RPC wrapper",
);
assert(!withdrawalAction.includes('.from("user_portfolios")'), "Withdrawal must not update Portfolio cash directly");
assert(!withdrawalAction.includes('.from("portfolio_transactions")'), "Withdrawal must not append its ledger row separately");
assert(!withdrawalAction.includes("rollback"), "Withdrawal must not use application compensation writes");

assert(
  mutation.includes('supabase.rpc("mutate_portfolio_cash"'),
  "The shared cash boundary must call the narrow database RPC",
);
const inputMatch = mutation.match(/input:\s*\{([\s\S]*?)\},\s*\): Promise<PortfolioCashMutationResult>/u);
assert(inputMatch, "Could not isolate the cash RPC wrapper input");
for (const forbidden of ["userId", "notes", "createdAt:", "occurredAt:"]) {
  const inputBlock = inputMatch[1];
  assert(!inputBlock.includes(forbidden), `Cash RPC input must not expose ${forbidden}`);
}

for (const action of [addCash, withdrawalAction]) {
  const mutationIndex = action.indexOf("mutatePortfolioCash");
  const refreshIndex = Math.max(
    action.indexOf("markPortfolioChartInputsChanged"),
    action.indexOf("invalidatePortfolioPageSnapshot"),
  );
  assert(mutationIndex >= 0 && refreshIndex > mutationIndex, "Derived refresh must happen after the RPC");
  assert(action.includes("try {"), "Post-commit refresh work must be best-effort");
}

const callers = [
  source("components/SavedPortfolio.tsx"),
  source("components/PortfolioCommandCentreRevolut.tsx"),
  source("components/portfolio-workspace/PortfolioAddSheet.tsx"),
];
for (const caller of callers) {
  for (const match of caller.matchAll(/addCash\(([^;]+)\)/gsu)) {
    assert(match[1].includes("portfolioId"), "Every active deposit caller must pass portfolioId");
  }
}

console.log("Portfolio cash exact-ID, atomic-RPC and post-commit source contracts passed.");
