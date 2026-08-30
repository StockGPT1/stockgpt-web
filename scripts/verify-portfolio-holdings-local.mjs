import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const password = "LocalStockGPT!2026";
const userA = { id: "11111111-1111-4111-8111-111111111111", email: "active-subscriber@stockgpt.invalid" };
const userB = { id: "33333333-3333-4333-8333-333333333333", email: "isolation-user@stockgpt.invalid", portfolioId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" };
const ids = Object.fromEntries(["buy","external","sale","correct","remove","sameBuy","competeBuy","oversell","externalConcurrent","nonUsd","rollbackBuy","rollbackSale","rollbackExternal","rollbackRemove"].map((name, index) => [name, `e5000000-0000-4500-8500-${String(index + 1).padStart(12, "0")}`]));
const randomId = "e5000000-0000-4500-8500-999999999999";

function assert(value, message) { if (!value) throw new Error(message); }
function cli(args, options = {}) {
  return execFileSync(process.execPath, [resolve("node_modules/supabase/dist/supabase.js"), ...args], { cwd: process.cwd(), encoding: "utf8", ...options });
}
function status() {
  return Object.fromEntries(cli(["status", "-o", "env"], { stdio: ["ignore", "pipe", "pipe"] }).split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((m) => [m[1], m[2].startsWith('"') ? JSON.parse(m[2]) : m[2]]));
}
async function auth(api, key, user) {
  const client = createClient(api, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
  if (error) throw new Error(error.message);
  assert(data.user?.id === user.id, "Authenticated wrong synthetic user");
  return client;
}
async function one(query, label) { const { data, error } = await query.single(); if (error) throw new Error(`${label}: ${error.message}`); return data; }
async function count(query, expected, label) { const { count: found, error } = await query; if (error) throw new Error(`${label}: ${error.message}`); assert(found === expected, `${label}: expected ${expected}, got ${found}`); }
async function ok(call, label) { const { data, error } = await call; if (error) throw new Error(`${label}: ${error.message}`); assert(data?.length === 1, `${label}: missing result`); return data[0]; }
async function reject(call, expected, label) { const { error } = await call; assert(error, `${label} unexpectedly succeeded`); if (expected) assert(error.message.includes(expected), `${label}: ${error.message}`); }
const rpc = {
  buy: (c,id,ticker,shares,price) => c.rpc("buy_portfolio_holding", { p_portfolio_id:id,p_ticker:ticker,p_shares:shares,p_price:price }),
  external: (c,id,ticker,shares,price) => c.rpc("log_existing_portfolio_holding", { p_portfolio_id:id,p_ticker:ticker,p_shares:shares,p_entry_price:price }),
  sell: (c,id,ticker,shares,price) => c.rpc("sell_portfolio_holding", { p_portfolio_id:id,p_ticker:ticker,p_shares:shares,p_price:price }),
  correct: (c,id,ticker,shares,price) => c.rpc("correct_portfolio_holding", { p_portfolio_id:id,p_ticker:ticker,p_shares:shares,p_entry_price:price }),
  remove: (c,id,ticker) => c.rpc("remove_portfolio_holding_tracking", { p_portfolio_id:id,p_ticker:ticker }),
};
function portfolio(id, cash, contribution, currency = "USD") { return { id, user_id:userA.id, name:`05E ${id.slice(-2)}`, risk_tolerance:"moderate", time_horizon:"medium_term", objective:"balanced", investment_amount:777, cash_balance:cash, cash_deposited_total:contribution, currency }; }
function holding(portfolioId,ticker,shares,entry) { return { portfolio_id:portfolioId,ticker,shares,entry_price:entry,source:"manual" }; }
function trigger(on) {
  if (on) {
    cli(["db","query","--local",`create function public.stage05e_fail() returns trigger language plpgsql set search_path='' as $$ begin if new.portfolio_id::text like 'e5000000-0000-4500-8500-00000000001%' then raise exception 'stage05e_forced_ledger_failure'; end if; return new; end $$`]);
    cli(["db","query","--local","create trigger stage05e_fail before insert on public.portfolio_transactions for each row execute function public.stage05e_fail()"]);
  } else {
    cli(["db","query","--local","drop trigger if exists stage05e_fail on public.portfolio_transactions"]);
    cli(["db","query","--local","drop function if exists public.stage05e_fail()"]);
  }
}

cli(["db","query","--local","--file","supabase/tests/verify_portfolio_holdings.sql"], { stdio:"inherit" });
const env = status();
const adminKey = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
assert(env.API_URL && env.ANON_KEY && adminKey, "Local Supabase configuration unavailable");
const a = await auth(env.API_URL, env.ANON_KEY, userA);
const b = await auth(env.API_URL, env.ANON_KEY, userB);
const anon = createClient(env.API_URL, env.ANON_KEY, { auth:{ autoRefreshToken:false,persistSession:false } });
const admin = createClient(env.API_URL, adminKey, { auth:{ autoRefreshToken:false,persistSession:false } });
const allIds = Object.values(ids);
let triggerInstalled = false;
try {
  await admin.from("user_portfolios").delete().in("id", allIds);
  const portfolios = [
    portfolio(ids.buy,1000,1000),portfolio(ids.external,50,100),portfolio(ids.sale,0,1000),
    portfolio(ids.correct,25,200),portfolio(ids.remove,25,200),portfolio(ids.sameBuy,1000,1000),
    portfolio(ids.competeBuy,100,100),portfolio(ids.oversell,0,100),portfolio(ids.externalConcurrent,0,0),
    portfolio(ids.nonUsd,100,100,"GBP"),portfolio(ids.rollbackBuy,100,100),portfolio(ids.rollbackSale,0,100),
    portfolio(ids.rollbackExternal,0,0),portfolio(ids.rollbackRemove,0,100),
  ];
  let result = await admin.from("user_portfolios").insert(portfolios); if (result.error) throw new Error(result.error.message);
  result = await admin.from("portfolio_holdings").insert([
    holding(ids.buy,"AAPL",10,100),holding(ids.external,"MSFT",2,100),holding(ids.sale,"NVDA",10,100),
    holding(ids.correct,"AMZN",5,100),holding(ids.remove,"AAPL",5,100),holding(ids.oversell,"MSFT",10,10),
    holding(ids.rollbackBuy,"AAPL",1,10),holding(ids.rollbackSale,"MSFT",2,10),holding(ids.rollbackRemove,"NVDA",2,10),
  ]); if (result.error) throw new Error(result.error.message);

  const isolationBefore = await one(admin.from("user_portfolios").select("*").eq("id",userB.portfolioId),"isolation before");
  await reject(rpc.buy(anon,ids.buy,"AAPL",1,1),null,"unauthenticated buy");
  await reject(rpc.buy(a,userB.portfolioId,"AAPL",1,1),"portfolio_not_found","cross-user buy");
  await reject(rpc.buy(a,randomId,"AAPL",1,1),"portfolio_not_found","missing portfolio buy");
  await reject(rpc.buy(a,ids.nonUsd,"AAPL",1,1),"portfolio_currency_unsupported","non-USD buy");

  const started = Date.now();
  const buy = await ok(rpc.buy(a,ids.buy,"AAPL",2,150),"weighted buy");
  assert(Number(buy.shares)===12 && Number(buy.entry_price)===108.3333 && Number(buy.cash_balance)===700 && Number(buy.cash_deposited_total)===1000,"weighted buy result wrong");
  const buyLedger = await one(admin.from("portfolio_transactions").select("*").eq("id",buy.transaction_id),"buy ledger");
  assert(buyLedger.type==="buy" && Number(buyLedger.amount)===300 && Date.parse(buyLedger.created_at)>=started-1000 && Date.parse(buyLedger.occurred_at)>=started-1000,"buy ledger contract wrong");
  assert(Number((await one(admin.from("user_portfolios").select("investment_amount").eq("id",ids.buy),"buy portfolio")).investment_amount)===777,"buy changed investment_amount");

  const ext = await ok(rpc.external(a,ids.external,"MSFT",2,200),"external merge");
  assert(Number(ext.shares)===4 && Number(ext.entry_price)===150 && Number(ext.cash_balance)===50 && Number(ext.cash_deposited_total)===500,"external merge wrong");
  const extLedger = await one(admin.from("portfolio_transactions").select("type,amount,occurred_at").eq("id",ext.transaction_id),"external ledger");
  assert(extLedger.type==="log_existing" && Number(extLedger.amount)===400 && extLedger.occurred_at===null,"external ledger timing wrong");

  const gain = await ok(rpc.sell(a,ids.sale,"NVDA",2,150),"gain sale");
  assert(Number(gain.shares)===8 && Number(gain.entry_price)===100 && Number(gain.cash_balance)===300 && Number(gain.realised_pnl)===100 && !gain.closed,"partial sale wrong");
  const loss = await ok(rpc.sell(a,ids.sale,"NVDA",8,50),"loss full sale");
  assert(loss.closed && Number(loss.cash_balance)===700 && Number(loss.realised_pnl)===-400 && Number(loss.cash_deposited_total)===1000,"full sale wrong");
  await count(admin.from("portfolio_holdings").select("id",{count:"exact",head:true}).eq("portfolio_id",ids.sale),0,"full sale deletion");

  const beforeCorrection = await one(admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id",ids.correct),"correction before");
  const correction = await ok(rpc.correct(a,ids.correct,"AMZN",6,110),"correction");
  assert(Number(correction.shares)===6 && Number(correction.entry_price)===110,"correction facts wrong");
  await reject(rpc.correct(a,ids.correct,"AMZN",0,110),"holding_shares_invalid","zero-share correction");
  const afterCorrection = await one(admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id",ids.correct),"correction after");
  assert(JSON.stringify(beforeCorrection)===JSON.stringify(afterCorrection),"correction changed finance");

  const beforeRemove = await one(admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id",ids.remove),"remove before");
  const removed = await ok(rpc.remove(a,ids.remove,"AAPL"),"remove tracking");
  const removeLedger = await one(admin.from("portfolio_transactions").select("type,amount,price,realised_pnl,notes").eq("id",removed.transaction_id),"remove ledger");
  assert(removeLedger.type==="adjustment" && Number(removeLedger.amount)===0 && removeLedger.price===null && removeLedger.realised_pnl===null && removeLedger.notes.includes("no sale"),"remove represented as sale");
  assert(JSON.stringify(beforeRemove)===JSON.stringify(await one(admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id",ids.remove),"remove after")),"remove changed finance");

  const sameBuys = await Promise.all([rpc.buy(a,ids.sameBuy,"AAPL",1,100),rpc.buy(a,ids.sameBuy,"AAPL",2,100)]);
  assert(sameBuys.every((x)=>!x.error),"concurrent same-ticker buy failed");
  const sameHolding = await one(admin.from("portfolio_holdings").select("shares,entry_price").eq("portfolio_id",ids.sameBuy).eq("ticker","AAPL"),"same buy holding");
  assert(Number(sameHolding.shares)===3 && Number(sameHolding.entry_price)===100,"same-ticker buy lost update");
  const competing = await Promise.all([rpc.buy(a,ids.competeBuy,"MSFT",8,10),rpc.buy(a,ids.competeBuy,"MSFT",8,10)]);
  assert(competing.filter((x)=>!x.error).length===1 && competing.filter((x)=>x.error?.message.includes("insufficient_cash")).length===1,"competing buys did not serialize cash");
  const oversells = await Promise.all([rpc.sell(a,ids.oversell,"MSFT",8,10),rpc.sell(a,ids.oversell,"MSFT",8,10)]);
  assert(oversells.filter((x)=>!x.error).length===1 && oversells.filter((x)=>x.error?.message.includes("holding_shares_exceeded")).length===1,"oversells did not serialize shares");
  const externalAdds = await Promise.all([rpc.external(a,ids.externalConcurrent,"NVDA",1,100),rpc.external(a,ids.externalConcurrent,"NVDA",1,200)]);
  assert(externalAdds.every((x)=>!x.error),"concurrent external adds failed");
  const externalHolding = await one(admin.from("portfolio_holdings").select("shares,entry_price").eq("portfolio_id",ids.externalConcurrent).eq("ticker","NVDA"),"external concurrent holding");
  assert(Number(externalHolding.shares)===2 && Number(externalHolding.entry_price)===150,"external additions lost weighted basis");

  trigger(true); triggerInstalled=true;
  for (const [name, call] of [
    ["buy",rpc.buy(a,ids.rollbackBuy,"AAPL",1,10)],
    ["sale",rpc.sell(a,ids.rollbackSale,"MSFT",1,20)],
    ["external",rpc.external(a,ids.rollbackExternal,"AMZN",1,10)],
    ["remove",rpc.remove(a,ids.rollbackRemove,"NVDA")],
  ]) await reject(call,"stage05e_forced_ledger_failure",`forced ${name} ledger failure`);
  trigger(false); triggerInstalled=false;
  assert(Number((await one(admin.from("user_portfolios").select("cash_balance").eq("id",ids.rollbackBuy),"rollback buy")).cash_balance)===100,"buy ledger failure changed cash");
  await count(admin.from("portfolio_holdings").select("id",{count:"exact",head:true}).eq("portfolio_id",ids.rollbackExternal),0,"external rollback holding");
  await count(admin.from("portfolio_holdings").select("id",{count:"exact",head:true}).eq("portfolio_id",ids.rollbackRemove).eq("ticker","NVDA"),1,"remove rollback holding");
  assert(Number((await one(admin.from("portfolio_holdings").select("shares").eq("portfolio_id",ids.rollbackSale).eq("ticker","MSFT"),"sale rollback")).shares)===2,"sale rollback changed shares");

  const { error:updateError } = await a.from("portfolio_transactions").update({amount:999}).eq("id",buy.transaction_id); assert(updateError,"ledger update bypassed append-only");
  const { error:deleteError } = await a.from("portfolio_transactions").delete().eq("id",buy.transaction_id); assert(deleteError,"ledger delete bypassed append-only");
  assert(JSON.stringify(await one(admin.from("user_portfolios").select("*").eq("id",userB.portfolioId),"isolation after"))===JSON.stringify(isolationBefore),"other user changed");
  await count(admin.from("user_portfolios").select("id",{count:"exact",head:true}).eq("id",randomId),0,"fallback portfolio creation");
} finally {
  if (triggerInstalled) trigger(false);
  await admin.from("user_portfolios").delete().in("id",allIds);
  await Promise.all([a.auth.signOut(),b.auth.signOut()]);
}
console.log("Local atomic holding ownership, accounting, concurrency, rollback and ledger assertions passed.");
