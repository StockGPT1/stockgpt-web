// LOCAL ONLY: mixed-operation tests use real authenticated PostgREST RPC calls.
// Expected outcomes are independent, explicit accounting examples, not RPC output.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const statusText = execFileSync(process.execPath,
  [resolve("node_modules/supabase/dist/supabase.js"), "status", "-o", "env"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const env = Object.fromEntries(statusText.split(/\r?\n/u).flatMap((line) => {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
  return m ? [[m[1], m[2].startsWith('"') ? JSON.parse(m[2]) : m[2]]] : [];
}));
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(env.API_URL).hostname), "Refusing non-local Supabase");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
const a = createClient(env.API_URL, env.ANON_KEY, options);
const b = createClient(env.API_URL, env.ANON_KEY, options);
const aId = "11111111-1111-4111-8111-111111111111";
const bId = "33333333-3333-4333-8333-333333333333";
const created = new Set();
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
function queryLocal(sql) {
  return execFileSync(process.execPath, [supabaseCli, "db", "query", "--local", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
async function required(call) {
  const { data, error } = await call;
  assert.equal(error, null, error?.message);
  return data;
}
async function rejected(call) { const result = await call; assert(result.error, "Hostile RPC succeeded"); return result; }
async function login(client, email, id) {
  const result = await required(client.auth.signInWithPassword({ email, password: "LocalStockGPT!2026" }));
  assert.equal(result.user.id, id);
}
const initial = [{ ticker: "AAPL", shares: 10, entry_price: 10 }];
const replacement = [{ ticker: "MSFT", shares: 4, entry_price: 25 }];
async function manual(label, cash = 100, holdings = initial, client = a) {
  const rows = await required(client.rpc("create_manual_portfolio", {
    p_name: `05K synthetic ${label}`, p_objective: "balanced", p_risk_tolerance: "moderate",
    p_time_horizon: "long", p_starting_cash: cash, p_holdings: holdings,
  }));
  created.add(rows[0].portfolio_id);
  return rows[0].portfolio_id;
}
const cash = (id, operation, amount, client = a) => client.rpc("mutate_portfolio_cash", {
  p_portfolio_id: id, p_operation: operation, p_amount: amount,
});
const buy = (id, ticker, shares, price, client = a) => client.rpc("buy_portfolio_holding", {
  p_portfolio_id: id, p_ticker: ticker, p_shares: shares, p_price: price,
});
const sell = (id, shares, price, client = a) => client.rpc("sell_portfolio_holding", {
  p_portfolio_id: id, p_ticker: "AAPL", p_shares: shares, p_price: price,
});
const correct = (id, shares, entryPrice, client = a) => client.rpc("correct_portfolio_holding", {
  p_portfolio_id: id, p_ticker: "AAPL", p_shares: shares, p_entry_price: entryPrice,
});
const external = (id, shares, entryPrice, client = a) => client.rpc("log_existing_portfolio_holding", {
  p_portfolio_id: id, p_ticker: "AAPL", p_shares: shares, p_entry_price: entryPrice,
});
const remove = (id, client = a) => client.rpc("remove_portfolio_holding_tracking", { p_portfolio_id: id, p_ticker: "AAPL" });
const replace = (id, holdings = replacement, client = a) => client.rpc("replace_portfolio_holdings_from_trading212", { p_portfolio_id: id, p_holdings: holdings });
const rename = (id, client = a) => client.rpc("rename_owned_portfolio", { p_portfolio_id: id, p_name: "05K synthetic renamed" });
const preferences = (id, client = a) => client.rpc("update_owned_portfolio_preferences", { p_portfolio_id: id, p_objective: "growth", p_risk_tolerance: "aggressive", p_time_horizon: "long" });
const review = (id, client = a) => client.rpc("mark_portfolio_holding_reviewed", { p_portfolio_id: id, p_ticker: "AAPL" });
const deletion = (id, client = a) => client.rpc("delete_owned_portfolio", { p_portfolio_id: id });
async function state(id) {
  const [portfolio, holdings, ledger] = await Promise.all([
    required(admin.from("user_portfolios").select("*").eq("id", id).single()),
    required(admin.from("portfolio_holdings").select("*").eq("portfolio_id", id).order("ticker")),
    required(admin.from("portfolio_transactions").select("*").eq("portfolio_id", id).order("created_at").order("id")),
  ]);
  return { portfolio, holdings, ledger };
}
async function installMalformedHoldingState(portfolioId, field, value) {
  queryLocal("alter table public.portfolio_holdings drop constraint portfolio_holdings_finite_financial_values");
  try {
    await required(admin.from("portfolio_holdings")
      .update({ shares: 10, entry_price: 10, [field]: value })
      .eq("portfolio_id", portfolioId));
  } finally {
    queryLocal(`alter table public.portfolio_holdings add constraint portfolio_holdings_finite_financial_values check (
      shares is not null and shares::text not in ('NaN', 'Infinity', '-Infinity') and shares > 0
      and entry_price is not null and entry_price::text not in ('NaN', 'Infinity', '-Infinity') and entry_price > 0
    ) not valid`);
  }
}
function financial(s, skip = 0) {
  return {
    cash: Number(s.portfolio.cash_balance), contribution: Number(s.portfolio.cash_deposited_total),
    holdings: s.holdings.map((h) => [h.ticker, Number(h.shares), Number(h.entry_price)]),
    ledger: s.ledger.slice(skip).map((t) => [t.type, Number(t.amount), t.realised_pnl == null ? null : Number(t.realised_pnl)])
      .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
  };
}
const outcome = (cashValue, contribution, holdings, ledger) => ({ cash: cashValue, contribution, holdings,
  ledger: ledger.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))) });

await login(a, "active-subscriber@stockgpt.invalid", aId);
await login(b, "isolation-user@stockgpt.invalid", bId);
try {
  const untouched = await manual("untouched");
  const otherOwner = await manual("other owner", 100, initial, b);
  const beforeUntouched = await state(untouched);
  const beforeOther = await state(otherOwner);
  const target = await manual("exact target");
  for (const field of ["p_objective", "p_risk_tolerance", "p_time_horizon"]) {
    await rejected(a.rpc("update_owned_portfolio_preferences", {
      p_portfolio_id: target, p_objective: "growth", p_risk_tolerance: "moderate", p_time_horizon: "long", [field]: null,
    }));
  }
  const targetedCalls = [
    (id) => cash(id, "deposit", 10), (id) => buy(id, "AAPL", 1, 10),
    (id) => external(id, 1, 10), (id) => sell(id, 1, 10), (id) => correct(id, 10, 10),
    review, rename, preferences, replace, remove, deletion,
  ];
  for (const call of targetedCalls) {
    await rejected(call(otherOwner));
    await rejected(call("05000000-0000-4000-8000-000000000099"));
    assert.deepEqual(await state(otherOwner), beforeOther, "Cross-owner write changed financial or metadata state");
  }
  for (const table of ["user_portfolios", "portfolio_holdings", "portfolio_transactions"]) {
    const key = table === "user_portfolios" ? "id" : "portfolio_id";
    assert.deepEqual(await required(a.from(table).select("*").eq(key, otherOwner)), []);
  }
  for (const call of targetedCalls.slice(0, 8)) {
    await required(call(target));
    assert.deepEqual(await state(untouched), beforeUntouched, "Another same-owner Portfolio changed");
  }
  await required(remove(target));
  await required(replace(target));
  await required(deletion(target));
  assert.deepEqual(await state(untouched), beforeUntouched);
  console.log("05K: exact multi-Portfolio isolation and all targeted cross-user/random-ID attacks passed.");

  const matrix = [
    ["deposit/withdrawal", (id) => cash(id, "deposit", 20), (id) => cash(id, "withdrawal", 80), [
      outcome(40, 140, [["AAPL", 10, 10]], [["deposit", 20, null], ["withdrawal", 80, null]]),
    ], 2],
    ["competing buys", (id) => buy(id, "MSFT", 8, 10), (id) => buy(id, "NVDA", 8, 10), [
      outcome(20, 200, [["AAPL", 10, 10], ["MSFT", 8, 10]], [["buy", 80, null]]),
      outcome(20, 200, [["AAPL", 10, 10], ["NVDA", 8, 10]], [["buy", 80, null]]),
    ], 1],
    ["buy/sale", (id) => buy(id, "AAPL", 2, 20), (id) => sell(id, 3, 30), [
      outcome(150, 200, [["AAPL", 9, 11.6667]], [["buy", 40, null], ["sell", 90, 55]]),
      outcome(150, 200, [["AAPL", 9, 12.2222]], [["buy", 40, null], ["sell", 90, 60]]),
    ], 2],
    ["sale/sale", (id) => sell(id, 8, 20), (id) => sell(id, 8, 30), [
      outcome(260, 200, [["AAPL", 2, 10]], [["sell", 160, 80]]),
      outcome(340, 200, [["AAPL", 2, 10]], [["sell", 240, 160]]),
    ], 1],
    ["correction/sale", (id) => correct(id, 5, 12), (id) => sell(id, 3, 20), [
      outcome(160, 200, [["AAPL", 2, 12]], [["adjustment", 0, null], ["sell", 60, 24]]),
      outcome(160, 200, [["AAPL", 5, 12]], [["adjustment", 0, null], ["sell", 60, 30]]),
    ], 2],
    ["remove/sale", remove, (id) => sell(id, 3, 20), [
      outcome(100, 200, [], [["adjustment", 0, null]]),
      outcome(160, 200, [], [["adjustment", 0, null], ["sell", 60, 30]]),
    ], null],
    ["CSV/cash", replace, (id) => cash(id, "deposit", 20), [
      outcome(120, 220, [["MSFT", 4, 25]], [["import", 0, null], ["deposit", 20, null]]),
    ], 2],
    ["CSV/holding", replace, (id) => buy(id, "AAPL", 2, 20), [
      outcome(60, 200, [["MSFT", 4, 25]], [["import", 0, null], ["buy", 40, null]]),
      outcome(60, 200, [["AAPL", 2, 20], ["MSFT", 4, 25]], [["import", 0, null], ["buy", 40, null]]),
    ], 2],
    ["CSV/CSV", replace, (id) => replace(id, [{ ticker: "NVDA", shares: 5, entry_price: 30 }]), [
      outcome(100, 200, [["MSFT", 4, 25]], [["import", 0, null], ["import", 0, null]]),
      outcome(100, 200, [["NVDA", 5, 30]], [["import", 0, null], ["import", 0, null]]),
    ], 2],
  ];
  for (const [name, left, right, allowed, successCount] of matrix) {
    // Repeat with reversed dispatch order. PostgreSQL may choose either serial order.
    for (const reverse of [false, true]) {
      const id = await manual(`race ${name}`);
      const before = await state(id);
      const calls = reverse ? [right, left] : [left, right];
      const results = await Promise.all(calls.map((call) => call(id)));
      if (successCount != null) assert.equal(results.filter((r) => !r.error).length, successCount, name);
      const after = await state(id);
      const actual = financial(after, before.ledger.length);
      assert(allowed.some((expected) => JSON.stringify(actual) === JSON.stringify(expected)), `${name}: non-serial financial outcome ${JSON.stringify(actual)}`);
      assert.deepEqual(after.ledger.slice(0, before.ledger.length), before.ledger, `${name}: original ledger mutated`);
      assert.equal(after.portfolio.currency, "USD");
      assert(actual.cash >= 0);
    }
    console.log(`05K concurrency: ${name} passed both dispatch orders.`);
  }

  const lifeA = await manual("lifecycle A", 100, []);
  await required(cash(lifeA, "deposit", 900));
  await required(buy(lifeA, "AAPL", 4, 100));
  await required(sell(lifeA, 2, 150));
  await required(cash(lifeA, "withdrawal", 200));
  // 100 + 900 - 400 + 300 - 200 = 700 cash; external contribution = 800.
  assert.deepEqual(financial(await state(lifeA)), outcome(700, 800, [["AAPL", 2, 100]], [
    ["deposit", 100, null], ["deposit", 900, null], ["buy", 400, null], ["sell", 300, 100], ["withdrawal", 200, null],
  ]));
  const lifeB = await manual("lifecycle B", 10, []);
  await required(external(lifeB, 4, 100));
  await required(correct(lifeB, 5, 80));
  await required(sell(lifeB, 2, 120));
  await required(remove(lifeB));
  assert.deepEqual(financial(await state(lifeB)), outcome(250, 410, [], [
    ["deposit", 10, null], ["log_existing", 400, null], ["adjustment", 0, null], ["sell", 240, 80], ["adjustment", 0, null],
  ]));
  const lifeC = await manual("lifecycle C", 500, [{ ticker: "AAPL", shares: 2, entry_price: 100 }]);
  await required(cash(lifeC, "deposit", 100));
  await required(buy(lifeC, "AAPL", 2, 120));
  await required(sell(lifeC, 4, 150));
  assert.deepEqual(financial(await state(lifeC)), outcome(960, 800, [], [
    ["deposit", 500, null], ["log_existing", 200, null], ["deposit", 100, null], ["buy", 240, null], ["sell", 600, 160],
  ]));
  const csvCreated = (await required(a.rpc("create_trading212_portfolio", { p_name: "05K synthetic lifecycle D", p_holdings: replacement })))[0].portfolio_id;
  created.add(csvCreated);
  await required(cash(csvCreated, "deposit", 40));
  await required(replace(csvCreated, initial));
  assert.deepEqual(financial(await state(csvCreated)), outcome(40, 140, [["AAPL", 10, 10]], [["import", 100, null], ["deposit", 40, null], ["import", 0, null]]));
  console.log("05K: four independent lifecycle accounting reconciliations passed.");

  const negative = await manual("negative contribution", 10, [{ ticker: "AAPL", shares: 2, entry_price: 10 }]);
  await required(sell(negative, 1, 100));
  await required(cash(negative, "withdrawal", 80));
  assert.equal((await state(negative)).portfolio.cash_deposited_total, -50);
  await required(rename(negative)); await required(preferences(negative)); await required(review(negative));
  await required(cash(negative, "deposit", 5));
  await required(sell(negative, 1, 100));
  await required(replace(negative));
  const negState = await state(negative);
  assert.equal(negState.portfolio.cash_balance, 135);
  assert.equal(negState.portfolio.cash_deposited_total, -45);
  console.log("05K: negative contribution preserved through further deposit, sale, metadata and CSV replacement.");

  const edge = await manual("precision", 10, []);
  await required(buy(edge, "AAPL", 0.0000014, 10000.00004));
  let edgeState = await state(edge);
  assert.equal(edgeState.holdings[0].shares, 0.000001);
  assert.equal(edgeState.holdings[0].entry_price, 10000);
  assert.equal(edgeState.portfolio.cash_balance, 9.99);
  await required(sell(edge, 0.000001, 10000));
  edgeState = await state(edge);
  assert.equal(edgeState.holdings.length, 0, "Full micro-share sale left a zombie holding");
  assert.equal(edgeState.portfolio.cash_balance, 10);
  for (const [shares, price] of [[0, 10], [-1, 10], [1, 0], [1, -1], [0.0000004, 10000]]) {
    await rejected(buy(edge, "AAPL", shares, price));
  }
  assert.deepEqual(await state(edge), edgeState);
  // Legacy numeric columns permit PostgreSQL NaN/Infinity even though normal
  // creation rejects them. Subsequent financial operations must fail closed.
  const malformed = await manual("malformed legacy numeric");
  for (const field of ["shares", "entry_price"]) {
    for (const value of ["NaN", "Infinity", "-Infinity"]) {
      await installMalformedHoldingState(malformed, field, value);
      const invalidBefore = await state(malformed);
      for (const call of [
        () => buy(malformed, "AAPL", 1, 10),
        () => external(malformed, 1, 10),
        () => sell(malformed, 1, 10),
        () => sell(malformed, 10, 10),
      ]) {
        await rejected(call());
        assert.deepEqual(await state(malformed), invalidBefore, "Malformed legacy holding changed through a financial RPC");
      }
      await required(correct(malformed, 10, 10));
    }
  }
  const malformedRemoval = await manual("malformed removal recovery");
  await installMalformedHoldingState(malformedRemoval, "shares", "NaN");
  await required(remove(malformedRemoval));
  const malformedRemovalState = await state(malformedRemoval);
  assert.equal(malformedRemovalState.holdings.length, 0, "Safe removal did not clean malformed holding state");
  assert.equal(malformedRemovalState.ledger.at(-1)?.type, "adjustment");
  assert.equal(malformedRemovalState.ledger.at(-1)?.shares, null, "Malformed shares leaked into neutral removal ledger");
  assert.deepEqual(await state(otherOwner), beforeOther);
  assert.deepEqual(await state(untouched), beforeUntouched);
  console.log("05K: precision/full-sale residue and unchanged independent Portfolios passed.");
} finally {
  if (created.size) await required(admin.from("user_portfolios").delete().in("id", [...created]));
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}
