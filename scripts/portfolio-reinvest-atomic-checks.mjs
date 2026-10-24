import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("portfolio trim/reinvest delegates ALL writes to a single database RPC", () => {
  const route = read("app/api/portfolio/trim-and-reinvest/route.ts");
  assert.match(route, /\.rpc\("trim_and_reinvest_portfolio_atomic"/);
  assert.doesNotMatch(route, /\.from\("portfolio_holdings"\)\.upsert/);
  assert.doesNotMatch(route, /\.from\("portfolio_transactions"\)\.insert/);
  assert.doesNotMatch(route, /recordTransaction\(/);
  assert.doesNotMatch(route, /recalculatePortfolioTotals\(/);
});

test("atomic RPC verifies owner, locks portfolio, and writes holdings and ledger together", () => {
  const sql = read("supabase/migrations/20261024152200_atomic_portfolio_reinvest.sql");
  assert.match(sql, /up\.user_id = p_user_id/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /INSERT INTO public\.portfolio_holdings/);
  assert.match(sql, /INSERT INTO public\.portfolio_transactions/);
  assert.match(sql, /UPDATE public\.user_portfolios/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.trim_and_reinvest_portfolio_atomic/);
  assert.match(sql, /TO service_role/);
  assert.match(sql, /SECURITY INVOKER/);
});

test("portfolio reinvestment rejects malformed IDs and coercive inputs", () => {
  const route = read("app/api/portfolio/trim-and-reinvest/route.ts");
  assert.match(route, /Invalid portfolio ID/);
  assert.match(route, /typeof value === "boolean"/);
  assert.match(route, /typeof value === "string" \? value\.trim\(\)\.toUpperCase\(\)/);
});
