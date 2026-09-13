import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const password = "LocalStockGPT!2026";
const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const run = (args, options = {}) => execFileSync(process.execPath, [cli, ...args], { cwd: process.cwd(), encoding: "utf8", ...options });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const status = Object.fromEntries(run(["status", "-o", "env"], { stdio: ["ignore", "pipe", "pipe"] }).split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false } });
const active = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const free = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });

for (const [client, email] of [[active, "active-subscriber@stockgpt.invalid"], [free, "free-user@stockgpt.invalid"]]) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

try {
  const { data: ranked, error: rankedError } = await active.from("stock_rankings").select("ticker,instrument_id").order("rank");
  if (rankedError) throw rankedError;
  assert(ranked.length === 4 && ranked.every((row) => row.instrument_id), "Existing ranked fixtures lost instrument linkage");

  const { data: aliases, error: aliasError } = await active.from("instrument_aliases").select("instrument_id,namespace,scope,value,valid_to");
  if (aliasError) throw aliasError;
  const appleAliases = aliases.filter((row) => row.instrument_id === "60000000-0000-4000-8000-000000000001");
  assert(appleAliases.some((row) => row.value === "AAPL" && row.valid_to === null), "Current ticker alias missing");
  assert(appleAliases.some((row) => row.value === "AAPLX" && row.valid_to !== null), "Historical ticker alias missing");
  assert(appleAliases.filter((row) => row.namespace.startsWith("broker.")).length === 2, "Namespaced provider mappings missing");

  const duplicates = aliases.filter((row) => row.value === "DUPL");
  assert(duplicates.length === 2 && new Set(duplicates.map((row) => row.instrument_id)).size === 2, "Distinct listings collapsed by ticker/company resemblance");
  assert(new Set(duplicates.map((row) => row.scope)).size === 2, "Listing alias scope is not explicit");

  const { data: coverage, error: coverageError } = await active.from("instrument_market_data").select("coverage,current_price");
  if (coverageError) throw coverageError;
  assert(coverage.some((row) => row.coverage === "ranked"), "ranked coverage missing");
  assert(coverage.some((row) => row.coverage === "tracked_only" && Number(row.current_price) === 42), "tracked_only coverage missing");
  assert(coverage.some((row) => row.coverage === "unsupported" && row.current_price === null), "unsupported price was not kept unknown");

  const { data: freeCoverage, error: freeCoverageError } = await free.from("instrument_market_data").select("instrument_id");
  if (freeCoverageError) throw freeCoverageError;
  assert(freeCoverage.length === 0, "Free user bypassed subscriber market-data coverage gate");

  const { error: hostileWrite } = await active.from("instrument_aliases").insert({ instrument_id: "60000000-0000-4000-8000-000000000001", namespace: "hostile", value: "FORGED" });
  assert(hostileWrite, "Authenticated client forged an instrument alias");
} finally {
  await Promise.all([active.auth.signOut(), free.auth.signOut()]);
  void admin;
}

console.log("Local instrument identity, coverage, entitlement and trusted-write boundary checks passed.");
