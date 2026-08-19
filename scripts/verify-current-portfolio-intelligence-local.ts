import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { loadCurrentPortfolioIntelligenceFromClient } from "../lib/current-portfolio-intelligence/load-from-client";

const localPassword = "LocalStockGPT!2026";
const AS_OF = "2026-01-16T12:00:00.000Z";
const users = {
  active: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "active-subscriber@stockgpt.invalid",
    portfolioId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  },
  free: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "free-user@stockgpt.invalid",
  },
  isolation: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "isolation-user@stockgpt.invalid",
    portfolioId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  },
};

function runSupabase(args: string[]) {
  const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function localStatus() {
  const output = runSupabase(["status", "-o", "env"]);
  return Object.fromEntries(
    output
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [
        match[1],
        match[2].startsWith('"') ? JSON.parse(match[2]) : match[2],
      ]),
  );
}

async function authenticatedClient(
  apiUrl: string,
  anonKey: string,
  user: { id: string; email: string },
) {
  const client = createClient<Database>(apiUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: localPassword,
  });
  if (error) throw new Error(`Local Auth sign-in failed: ${error.message}`);
  assert.equal(data.user?.id, user.id, "Local Auth returned an unexpected user");
  return client;
}

async function portfolioSnapshot(
  client: Awaited<ReturnType<typeof authenticatedClient>>,
  portfolioId: string,
) {
  const [portfolio, holdings] = await Promise.all([
    client
      .from("user_portfolios")
      .select("id,updated_at,cash_balance,cash_deposited_total")
      .eq("id", portfolioId)
      .maybeSingle(),
    client
      .from("portfolio_holdings")
      .select(
        "id,portfolio_id,ticker,shares,entry_price,score_at_entry,rank_at_entry,allocation_pct,risk_level_at_entry,target_level_at_entry",
      )
      .eq("portfolio_id", portfolioId)
      .order("id", { ascending: true }),
  ]);
  if (portfolio.error) throw new Error(`Portfolio snapshot failed: ${portfolio.error.message}`);
  if (holdings.error) throw new Error(`Holding snapshot failed: ${holdings.error.message}`);
  return { portfolio: portfolio.data, holdings: holdings.data };
}

async function main() {
  const status = localStatus();
  assert.ok(status.API_URL && status.ANON_KEY, "Local Supabase is unavailable");
  const activeClient = await authenticatedClient(
    status.API_URL,
    status.ANON_KEY,
    users.active,
  );
  const freeClient = await authenticatedClient(
    status.API_URL,
    status.ANON_KEY,
    users.free,
  );
  // The local Auth and REST containers can briefly disagree at the JWT iat
  // second boundary immediately after sign-in.
  await new Promise((resolve) => setTimeout(resolve, 1_100));

  const before = await portfolioSnapshot(activeClient, users.active.portfolioId);
  const first = await loadCurrentPortfolioIntelligenceFromClient({
    supabase: activeClient,
    userId: users.active.id,
    portfolioId: users.active.portfolioId,
    asOf: AS_OF,
  });
  const second = await loadCurrentPortfolioIntelligenceFromClient({
    supabase: activeClient,
    userId: users.active.id,
    portfolioId: users.active.portfolioId,
    asOf: AS_OF,
  });
  assert.equal(first.status, "ready", "Active user's owned portfolio did not load");
  assert.equal(
    JSON.stringify(first),
    JSON.stringify(second),
    "Repeated unchanged local loads were not byte-for-byte deterministic",
  );

  const serializedInput = JSON.stringify(first.input);
  for (const legacyField of [
    "recommendation",
    "actionAlerts",
    "eventAlerts",
    "aiSummary",
    "triggers",
  ]) {
    assert.equal(
      serializedInput.includes(legacyField),
      false,
      `Canonical input contains legacy assessment field ${legacyField}`,
    );
  }

  const crossUser = await loadCurrentPortfolioIntelligenceFromClient({
    supabase: activeClient,
    userId: users.active.id,
    portfolioId: users.isolation.portfolioId,
    asOf: AS_OF,
  });
  assert.equal(crossUser.status, "not_found", "Cross-user portfolio was loadable");

  const free = await loadCurrentPortfolioIntelligenceFromClient({
    supabase: freeClient,
    userId: users.free.id,
    asOf: AS_OF,
  });
  assert.equal(free.status, "not_found", "Free no-portfolio fixture was not handled");

  const after = await portfolioSnapshot(activeClient, users.active.portfolioId);
  assert.deepEqual(after, before, "Factual adapter changed persisted portfolio data");

  await Promise.all([activeClient.auth.signOut(), freeClient.auth.signOut()]);
  console.log(
    "Local authenticated current-portfolio adapter ownership, determinism and no-write checks passed.",
  );
}

void main();
