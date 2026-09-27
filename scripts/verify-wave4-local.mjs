import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const raw = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(raw.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, { auth: { persistSession: false } });
const active = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const isolation = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const password = "LocalStockGPT!2026";
for (const [client, email] of [[active, "active-subscriber@stockgpt.invalid"], [isolation, "isolation-user@stockgpt.invalid"]]) {
  const { error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error;
}

const owned = await active.from("user_portfolios").select("id").eq("management_source", "manual").limit(1).single();
if (owned.error) throw owned.error;
const other = await isolation.from("user_portfolios").select("id").limit(1).single();
if (other.error) throw other.error;
const { data: activeAuth } = await active.auth.getUser();
assert(activeAuth.user, "Active synthetic user unavailable");

const ownSave = await active.rpc("set_default_portfolio_context", { p_context_kind: "portfolio", p_portfolio_id: owned.data.id });
if (ownSave.error) throw ownSave.error;
const crossSave = await active.rpc("set_default_portfolio_context", { p_context_kind: "portfolio", p_portfolio_id: other.data.id });
assert(crossSave.error, "Cross-user Portfolio was saved as default");
const allSave = await active.rpc("set_default_portfolio_context", { p_context_kind: "all_investments" });
if (allSave.error) throw allSave.error;
const preference = await active.from("portfolio_context_preferences").select("context_kind,portfolio_id").single();
assert(preference.data?.context_kind === "all_investments" && preference.data.portfolio_id === null, "All Investments preference was not saved");
const isolatedPreference = await isolation.from("portfolio_context_preferences").select("user_id");
assert((isolatedPreference.data ?? []).length === 0, "Context preference leaked across users");
const hostilePreference = await active.from("portfolio_context_preferences").insert({ user_id: "33333333-3333-4333-8333-333333333333", context_kind: "all_investments" });
assert(hostilePreference.error, "Browser directly mutated context preference storage");

const account = await admin.from("broker_accounts").select("id,user_id,connection_id,institution_id,base_currency").eq("user_id", activeAuth.user.id).not("last_successful_sync_at", "is", null).limit(1).single();
if (account.error) throw account.error;

const captureAccountId = "76000000-0000-4000-8000-000000000010";
const capturePositionId = "76000000-0000-4000-8000-000000000011";
const captureCashId = "76000000-0000-4000-8000-000000000012";
const captureJobId = "76000000-0000-4000-8000-000000000013";
const captureAt = "2026-02-03T12:00:00Z";
await admin.from("broker_sync_jobs").delete().eq("id", captureJobId);
await admin.from("broker_accounts").delete().eq("id", captureAccountId);
const captureAccount = await admin.from("broker_accounts").insert({
  id: captureAccountId,
  user_id: account.data.user_id,
  connection_id: account.data.connection_id,
  institution_id: account.data.institution_id,
  external_account_id: "wave4-capture-account",
  name: "Wave 4 capture account",
  base_currency: "USD",
  status: "active",
});
if (captureAccount.error) throw captureAccount.error;
const capturePosition = await admin.from("broker_positions").insert({
  id: capturePositionId,
  user_id: account.data.user_id,
  account_id: captureAccountId,
  position_key: "wave4-capture-position",
  external_instrument_id: "wave4-capture-instrument",
  symbol: "WAVE4",
  asset_type: "equity",
  quantity: 2,
  price: 100,
  price_currency: "USD",
  market_value: 200,
  market_value_currency: "USD",
  as_of: captureAt,
});
if (capturePosition.error) throw capturePosition.error;
const captureCash = await admin.from("broker_cash_balances").insert({
  id: captureCashId,
  user_id: account.data.user_id,
  account_id: captureAccountId,
  currency: "USD",
  amount: 50,
  as_of: captureAt,
});
if (captureCash.error) throw captureCash.error;
const captureJob = await admin.from("broker_sync_jobs").insert({
  id: captureJobId,
  user_id: account.data.user_id,
  connection_id: account.data.connection_id,
  status: "queued",
});
if (captureJob.error) throw captureJob.error;
const markAccountFresh = await admin.from("broker_accounts").update({ last_successful_sync_at: captureAt }).eq("id", captureAccountId);
if (markAccountFresh.error) throw markAccountFresh.error;
const promoteJob = await admin.from("broker_sync_jobs").update({
  status: "succeeded",
  provider_freshness_at: captureAt,
  completed_at: captureAt,
}).eq("id", captureJobId);
if (promoteJob.error) throw promoteJob.error;
const capturedHistory = await admin.from("broker_account_value_history")
  .select("total_value,cash_value,currency,source,quality,value_at")
  .eq("account_id", captureAccountId)
  .eq("value_at", captureAt)
  .single();
if (capturedHistory.error) throw capturedHistory.error;
assert(Number(capturedHistory.data.total_value) === 250, "Successful sync promotion did not capture the coherent account total");
assert(Number(capturedHistory.data.cash_value) === 50, "Successful sync promotion did not capture account cash");
assert(capturedHistory.data.currency === "USD", "Successful sync promotion lost valuation currency provenance");
assert(capturedHistory.data.source === "sync_promotion" && capturedHistory.data.quality === "provider_evidence", "Successful sync promotion used the wrong history provenance");
await admin.from("broker_sync_jobs").delete().eq("id", captureJobId);
await admin.from("broker_accounts").delete().eq("id", captureAccountId);

const historyId = "76000000-0000-4000-8000-000000000001";
await admin.from("broker_account_value_history").delete().eq("id", historyId);
const insert = await admin.from("broker_account_value_history").insert({ id: historyId, user_id: account.data.user_id, account_id: account.data.id, value_at: "2026-01-02T12:00:00Z", total_value: 1234.56, cash_value: 34.56, currency: account.data.base_currency ?? "USD", source: "provider_history", quality: "provider_reported" });
if (insert.error) throw insert.error;
const ownerRead = await active.from("broker_account_value_history").select("id").eq("id", historyId);
assert(ownerRead.data?.length === 1, "Owner could not read connected history");
const crossRead = await isolation.from("broker_account_value_history").select("id").eq("id", historyId);
assert(crossRead.data?.length === 0, "Connected history leaked across users");
const hostileHistory = await active.from("broker_account_value_history").insert({ user_id: account.data.user_id, account_id: account.data.id, value_at: "2026-01-03T12:00:00Z", total_value: 1, cash_value: 1, currency: "USD", source: "provider_history", quality: "provider_reported" });
assert(hostileHistory.error, "Browser gained connected-history mutation authority");
await admin.from("broker_account_value_history").delete().eq("id", historyId);
await active.rpc("clear_default_portfolio_context");
await Promise.all([active.auth.signOut(), isolation.auth.signOut()]);
console.log("Wave 4 owner-scoped history and saved-context database checks passed.");
