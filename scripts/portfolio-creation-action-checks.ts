import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function actionBlock(contents: string, start: string, end: string) {
  const from = contents.indexOf(`export async function ${start}`);
  const to = contents.indexOf(`export async function ${end}`, from + 1);
  assert(from >= 0 && to > from, `Could not find ${start} action block`);
  return contents.slice(from, to);
}

const actions = source("lib/actions/portfolio-management.ts");
const mutations = source("lib/portfolio-creation-mutation.ts");
const builder = source("components/PortfolioBuilder.tsx");
const manualBuilder = source("components/ManualPortfolioBuilder.tsx");
const aiAction = actionBlock(actions, "savePortfolio", "createManualPortfolio");
const manualAction = actionBlock(actions, "createManualPortfolio", "renamePortfolio");
const deleteAction = actions.slice(actions.indexOf("export async function deletePortfolio"));
const manualInput = actions.slice(
  actions.indexOf("export type ManualPortfolioInput"),
  actions.indexOf("type AddCashInput"),
);
const csvAction = actionBlock(
  actions,
  "createPortfolioFromTrading212Csv",
  "importTrading212Csv",
);

assert(!actions.includes("replace_current"), "Inactive AI replacement mode must be removed");
assert(!builder.includes('mode: "create_new"'), "AI Builder should use the create-only contract");
assert(!manualInput.includes("currency"), "Manual financial creation must not accept storage currency");
assert(!manualBuilder.includes('currency: "USD"'), "Manual UI should not control storage currency");

for (const [label, block] of [["AI", aiAction], ["manual", manualAction]] as const) {
  assert(!block.includes('.from("user_portfolios")'), `${label} creation still inserts the parent directly`);
  assert(!block.includes('.from("portfolio_holdings")'), `${label} creation still inserts holdings directly`);
  assert(!block.includes("recordTransaction("), `${label} creation still appends ledger outside the RPC`);
}
assert(aiAction.includes("createAiPortfolioDraftAtomically"), "AI creation does not use its atomic RPC wrapper");
assert(manualAction.includes("createManualPortfolioAtomically"), "Manual creation does not use its atomic RPC wrapper");
assert(!aiAction.includes("totalInvested"), "AI totalInvested remains accounting authority");
assert(!mutations.includes("totalInvested"), "Creation RPC wrapper accepts AI generation total");
assert(!mutations.includes("investmentAmount"), "Creation RPC wrapper accepts investment_amount authority");
assert(mutations.includes('supabase.rpc("create_manual_portfolio"'), "Manual RPC call is missing");
assert(mutations.includes('supabase.rpc("create_ai_portfolio_draft"'), "AI RPC call is missing");

assert(/export async function deletePortfolio\(\s*input: DeletePortfolioInput/u.test(actions), "Deletion input must be required");
assert(deleteAction.includes("deleteOwnedPortfolioAtomically"), "Deletion does not use the exact lifecycle RPC");
assert(!deleteAction.includes("getOrCreatePortfolio"), "Deletion retains first-Portfolio/create fallback");
assert(!deleteAction.includes('.from("user_portfolios")'), "Deletion still directly deletes the parent table");

assert(aiAction.includes("Post-commit AI Portfolio refresh failed"), "AI post-commit work is not isolated");
assert(manualAction.includes("Post-commit manual Portfolio refresh failed"), "Manual post-commit work is not isolated");
assert(deleteAction.includes("Post-commit Portfolio refresh failed"), "Deletion post-commit work is not isolated");
assert(
  csvAction.includes("createTrading212PortfolioAtomically")
    && !csvAction.includes('.from("user_portfolios")')
    && !csvAction.includes('.from("portfolio_holdings")'),
  "Trading 212 creation must remain on its Stage 05G atomic boundary",
);

console.log("Portfolio creation exact-ID, atomic-RPC, USD and deferred-CSV source contracts passed.");
