import { execFileSync, spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { discoverSnapTradeConnections, ensureSnapTradeRegistration } from "../lib/brokerage/connection-service";
import {
  createReadOnlySnapTradePortalLink,
  fetchSnapTradeSyncCandidate,
  listSnapTradeConnections,
} from "../lib/brokerage/providers/snaptrade/service";
import { runBoundedBrokerSyncWorker } from "../lib/brokerage/sync-runner";

const EXPECTED_BRANCH = "codex/broker-sync-foundation";
const PROOF_BASE_HEAD = "92cd3970026212b0936d2139a2852aa93977439a";
const TARGET_BROKER = "SANDBOX" as const;
const RETURN_URL = "http://127.0.0.1:3000/portfolio/connections/return";
const cli = resolve("node_modules", "supabase", "dist", "supabase.js");

type Phase = "preflight" | "portal-open" | "sync";
type Scenario = "self-directed" | "cash-only" | "no-transactions" | "no-accounts";
type ScenarioConfig = { userId: string; identityId: string; email: string };

const SCENARIOS: Record<Scenario, ScenarioConfig> = {
  "self-directed": {
    userId: "11111111-1111-4111-8111-111111111111",
    identityId: "11111111-1111-4111-9111-111111111111",
    email: "active-subscriber@stockgpt.invalid",
  },
  "cash-only": {
    userId: "44444444-4444-4444-8444-444444444444",
    identityId: "44444444-4444-4444-9444-444444444444",
    email: "stage22a-cash-only@stockgpt.invalid",
  },
  "no-transactions": {
    userId: "55555555-5555-4555-8555-555555555555",
    identityId: "55555555-5555-4555-9555-555555555555",
    email: "stage22a-no-transactions@stockgpt.invalid",
  },
  "no-accounts": {
    userId: "66666666-6666-4666-8666-666666666666",
    identityId: "66666666-6666-4666-9666-666666666666",
    email: "stage22a-no-accounts@stockgpt.invalid",
  },
};

function fail(code: string): never {
  throw new Error(code);
}

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function loadLocalEnvironment() {
  try {
    loadEnvFile(resolve(".env.local"));
  } catch {
    fail("sandbox_env_unavailable");
  }
}

function assertStaticSafety() {
  if (git("branch", "--show-current") !== EXPECTED_BRANCH) fail("sandbox_branch_mismatch");
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", PROOF_BASE_HEAD, "HEAD"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    fail("sandbox_head_mismatch");
  }
  if (!git("check-ignore", ".env.local")) fail("sandbox_env_not_ignored");
  if (git("ls-files", ".env.local")) fail("sandbox_env_tracked");
  if (!process.env.SNAPTRADE_CLIENT_ID?.trim()) fail("sandbox_client_id_missing");
  if (!process.env.SNAPTRADE_CONSUMER_KEY?.trim()) fail("sandbox_consumer_key_missing");
  if (process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX !== "true") fail("sandbox_opt_in_required");
  if (TARGET_BROKER !== "SANDBOX") fail("sandbox_target_invalid");
}

function localSupabaseEnvironment() {
  let output: string;
  try {
    output = execFileSync(process.execPath, [cli, "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("local_supabase_unavailable");
  }
  const values = Object.fromEntries(
    output.split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]),
  );
  const apiUrl = values.API_URL;
  const serviceRoleKey = values.SERVICE_ROLE_KEY ?? values.SECRET_KEY;
  const anonKey = values.ANON_KEY;
  if (!apiUrl || !serviceRoleKey || !anonKey) fail("local_supabase_credentials_unavailable");
  const host = new URL(apiUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") fail("non_local_supabase_rejected");
  return { apiUrl, serviceRoleKey, anonKey };
}

function scenarioFromArgument(): Scenario {
  const value = process.argv[3] ?? "self-directed";
  if (!(value in SCENARIOS)) fail("sandbox_scenario_invalid");
  return value as Scenario;
}

function ensureLocalScenarioUser(config: ScenarioConfig) {
  if (config.userId === SCENARIOS["self-directed"].userId) return;
  const statements = [`
    insert into auth.users (
      instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      confirmation_token,recovery_token,email_change_token_new,email_change,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000','${config.userId}','authenticated','authenticated',
      '${config.email}',extensions.crypt('LocalStockGPT!2026', extensions.gen_salt('bf')),now(),
      '','','','','{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Stage 22A Sandbox"}'::jsonb,now(),now()
    ) on conflict (id) do nothing
  `, `
    insert into auth.identities (
      id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at
    ) values (
      '${config.identityId}','${config.userId}','${config.userId}',
      '{"sub":"${config.userId}","email":"${config.email}","email_verified":true}'::jsonb,
      'email',now(),now(),now()
    ) on conflict (id) do nothing
  `, `
    update public.profiles set subscription_status = 'active', terms_accepted = true
    where id = '${config.userId}'
  `];
  try {
    for (const sql of statements) {
      execFileSync(process.execPath, [cli, "db", "query", "--local", sql], {
        encoding: "utf8",
        stdio: ["ignore", "ignore", "ignore"],
      });
    }
  } catch {
    fail("sandbox_local_user_unavailable");
  }
}

async function loadProvider(admin: ReturnType<typeof createClient<Database>>) {
  const provider = await admin.from("broker_providers")
    .select("id")
    .eq("provider_key", "snaptrade")
    .single();
  if (provider.error) fail("sandbox_provider_unavailable");
  return provider.data.id;
}

async function generatePortal(scenario: Scenario) {
  const local = localSupabaseEnvironment();
  const config = SCENARIOS[scenario];
  ensureLocalScenarioUser(config);
  const admin = createClient<Database>(local.apiUrl, local.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const providerId = await loadProvider(admin);

  await ensureSnapTradeRegistration(admin, { userId: config.userId, providerId });
  const portalUrl = await createReadOnlySnapTradePortalLink(admin, {
    userId: config.userId,
    providerId,
    customRedirect: RETURN_URL,
    broker: TARGET_BROKER,
  });

  console.log("sandbox_portal_ready=true");
  console.log("sandbox_broker=SANDBOX");
  console.log("sandbox_connection_type=read");
  const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", portalUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  browser.unref();
  console.log("sandbox_portal_opened=true");
}

async function discoverSyncAndProject(scenario: Scenario) {
  const local = localSupabaseEnvironment();
  const config = SCENARIOS[scenario];
  const admin = createClient<Database>(local.apiUrl, local.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const providerId = await loadProvider(admin);
  const providerConnections = await listSnapTradeConnections(admin, { userId: config.userId, providerId });
  const sandboxConnections = providerConnections.filter((item) =>
    item.type === "read"
    && item.brokerage?.slug?.toUpperCase() === TARGET_BROKER
    && !item.disabled,
  );
  if (sandboxConnections.length !== 1 || !sandboxConnections[0].id) fail("sandbox_connection_not_unique");
  const externalConnectionId = sandboxConnections[0].id;

  await discoverSnapTradeConnections(admin, { userId: config.userId, providerId });
  const connection = await admin.from("broker_connections")
    .select("id,status")
    .eq("user_id", config.userId)
    .eq("provider_id", providerId)
    .eq("external_connection_id", externalConnectionId)
    .single();
  if (connection.error) fail("sandbox_connection_discovery_failed");

  const worker = await runBoundedBrokerSyncWorker(admin, {
    workerId: "stage22a-sandbox-worker",
    limit: 1,
    fetchSnapTrade: fetchSnapTradeSyncCandidate,
  });
  if (worker.claimed !== 1 || worker.results[0]?.status !== "succeeded") fail("sandbox_initial_sync_incomplete");

  const accounts = await admin.from("broker_accounts")
    .select("id,status,base_currency")
    .eq("user_id", config.userId)
    .eq("connection_id", connection.data.id)
    .order("external_account_id");
  const expectedAccountCount = scenario === "self-directed" ? 2 : scenario === "cash-only" ? 1 : null;
  if (accounts.error || accounts.data.length === 0
    || (expectedAccountCount !== null && accounts.data.length !== expectedAccountCount)) {
    fail("sandbox_account_count_unexpected");
  }
  const accountIds = accounts.data.map((account) => account.id);
  const [positions, cash, activities] = await Promise.all([
    admin.from("broker_positions").select("id,instrument_id", { count: "exact" }).in("account_id", accountIds),
    admin.from("broker_cash_balances").select("id,currency", { count: "exact" }).in("account_id", accountIds),
    admin.from("broker_activities").select("id,activity_type", { count: "exact" }).in("account_id", accountIds),
  ]);
  if (positions.error || cash.error || activities.error) fail("sandbox_promoted_facts_unavailable");
  if (scenario === "cash-only" && (positions.count !== 0 || (cash.count ?? 0) < 1)) {
    fail("sandbox_cash_only_contract_failed");
  }
  if (scenario === "no-transactions" && activities.count !== 0) fail("sandbox_no_transactions_contract_failed");

  const owner = createClient<Database>(local.apiUrl, local.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await owner.auth.signInWithPassword({
    email: config.email,
    password: "LocalStockGPT!2026",
  });
  if (signedIn.error || signedIn.data.user?.id !== config.userId) fail("sandbox_local_owner_unavailable");
  const projection = await owner.rpc("create_connected_portfolio", { p_account_id: accountIds[0] });
  if (projection.error || !projection.data?.[0]?.portfolio_id) fail("sandbox_projection_failed");
  const portfolioId = projection.data[0].portfolio_id;
  const copied = await admin.from("portfolio_holdings")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", portfolioId);
  if (copied.error || copied.count !== 0) fail("sandbox_manual_holding_copy_detected");
  await owner.auth.signOut();

  const unmapped = (positions.data ?? []).filter((position) => position.instrument_id === null).length;
  const activityTypes = [...new Set((activities.data ?? []).map((activity) => activity.activity_type))].sort();
  console.log("sandbox_discovery=true");
  console.log(`sandbox_scenario=${scenario}`);
  console.log("sandbox_connection_type=read");
  console.log("sandbox_sync=succeeded");
  console.log(`sandbox_accounts=${accounts.data.length}`);
  console.log(`sandbox_positions=${positions.count ?? positions.data?.length ?? 0}`);
  console.log(`sandbox_unmapped_positions=${unmapped}`);
  console.log(`sandbox_cash_balances=${cash.count ?? cash.data?.length ?? 0}`);
  console.log(`sandbox_activities=${activities.count ?? activities.data?.length ?? 0}`);
  console.log(`sandbox_activity_types=${activityTypes.join(",")}`);
  console.log("sandbox_projection=true");
  console.log("sandbox_manual_holdings_copied=0");
}

async function main() {
  loadLocalEnvironment();
  assertStaticSafety();
  const phase = (process.argv[2] ?? "preflight") as Phase;
  if (phase !== "preflight" && phase !== "portal-open" && phase !== "sync") {
    fail("sandbox_phase_invalid");
  }

  const local = localSupabaseEnvironment();
  console.log("sandbox_preflight=true");
  console.log("sandbox_credentials_present=true");
  console.log("sandbox_opt_in=true");
  console.log("sandbox_target=SANDBOX");
  console.log(`local_supabase=${new URL(local.apiUrl).hostname}`);
  const scenario = scenarioFromArgument();
  if (phase === "portal-open") await generatePortal(scenario);
  if (phase === "sync") await discoverSyncAndProject(scenario);
}

main().catch((error: unknown) => {
  const code = error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
    ? error.message
    : "sandbox_provider_request_failed";
  console.error(code);
  process.exitCode = 1;
});
