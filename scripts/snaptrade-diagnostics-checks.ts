import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SnaptradeError } from "snaptrade-typescript-sdk";
import type { AxiosError } from "axios";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { SnapTradeClient } from "../lib/brokerage/providers/snaptrade/client";
import { registerSnapTradeUser, createReadOnlySnapTradePortalLink } from "../lib/brokerage/providers/snaptrade/service";
import { runSnapTradeDiagnosticPhase } from "../lib/brokerage/providers/snaptrade/diagnostics";

async function check() {
  const keys = ["SNAPTRADE_CLIENT_ID", "SNAPTRADE_CONSUMER_KEY", "STOCKGPT_ALLOW_SNAPTRADE_SANDBOX"] as const;
  const previous = keys.map((key) => process.env[key]);
  const info = console.info;
  const fetch = globalThis.fetch;
  const logs: unknown[][] = [];
  const input = { userId: "11111111-1111-4111-8111-111111111111", providerId: "synthetic-provider" };
  const secret = "NEVER_LOG_SYNTHETIC_SECRET";
  const failure = Object.assign(new Error(secret), { name: secret, response: { data: secret }, config: { headers: { Authorization: secret } } });
  const admin = { rpc: async () => ({ error: null, data: [{ provider_user_id: secret, user_secret: secret }] }) } as unknown as SupabaseClient<Database>;
  const failedAdmin = { rpc: async () => ({ error: { message: secret }, data: null }) } as unknown as SupabaseClient<Database>;
  const sdk = (failRegistration = false, failPortal = false) => ({ authentication: {
    registerSnapTradeUser: async ({ userId }: { userId: string }) => {
      if (failRegistration) throw failure;
      return { data: { userId, userSecret: secret } };
    },
    loginSnapTradeUser: async (params: { connectionType: string; broker?: string }) => {
      assert.equal(params.connectionType, "read");
      assert.equal(params.broker, "SANDBOX");
      if (failPortal) throw failure;
      return { data: { redirectURI: `https://portal.invalid/${secret}` } };
    },
  } }) as unknown as SnapTradeClient;
  const phases = () => logs.map((entry) => {
    const payload = entry[1] as { phase: string; success: boolean };
    return [payload.phase, payload.success];
  });
  const payloadKeys = (payload: { phase?: unknown; success?: unknown }) => ["phase", "success", "clientIdPresent", "consumerKeyPresent", "sandboxOptIn", "errorName",
    ...(payload.phase === "registration" && payload.success === false ? ["failureKind", "httpStatus"] : [])].sort();
  try {
    console.info = (...args: unknown[]) => {
      assert.equal(args.length, 2);
      assert.equal(args[0], "[snaptrade-sandbox-phase]");
      assert(!JSON.stringify(args).includes(secret), "Secret-bearing input escaped the diagnostic allowlist");
      assert.deepEqual(Object.keys(args[1] as object).sort(), payloadKeys(args[1] as object));
      logs.push(args);
    };
    globalThis.fetch = async () => { throw new Error("Network forbidden in diagnostics regression"); };
    process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = "true";
    delete process.env.SNAPTRADE_CLIENT_ID;
    delete process.env.SNAPTRADE_CONSUMER_KEY;
    await assert.rejects(registerSnapTradeUser(admin, input));
    assert.deepEqual(phases(), [["configuration", false]]);
    assert.deepEqual(logs[0][1], { phase: "configuration", success: false, clientIdPresent: false, consumerKeyPresent: false, sandboxOptIn: true, errorName: "Error" });
    logs.length = 0;
    process.env.SNAPTRADE_CLIENT_ID = secret;
    process.env.SNAPTRADE_CONSUMER_KEY = secret;
    await assert.rejects(registerSnapTradeUser(admin, input, sdk(true)), (error) => error === failure);
    assert.deepEqual(phases(), [["configuration", true], ["registration", false]]);
    const sdkError = (status?: number, code = "ERR_BAD_REQUEST") => new SnaptradeError({
      message: secret, code, config: { url: `https://provider.invalid/${secret}`, headers: { Authorization: secret } },
      ...(status === undefined ? {} : { response: { status, statusText: secret } }),
    } as unknown as AxiosError, { userSecret: secret }, { Authorization: secret });
    for (const [error, kind, status] of [
      [sdkError(401), "provider_rejection", 401],
      [sdkError(429), "provider_rejection", 429],
      [new Error("Request failed after 3 retries due to 429 (rate limit) errors."), "provider_rejection", 429],
      [sdkError(503), "provider_rejection", 503],
      [sdkError(undefined, "ENOTFOUND"), "network_failure", null],
      [sdkError(undefined, "ECONNABORTED"), "network_failure", null],
      [sdkError(undefined, secret), "unknown_failure", null],
      [sdkError(Number.NaN), "unknown_failure", null],
      [sdkError(9999), "unknown_failure", null],
    ] as const) {
      logs.length = 0;
      // Real pinned SDK error instances with deliberately secret-bearing fields.
      await assert.rejects(runSnapTradeDiagnosticPhase("registration", () => { throw error; }));
      const payload = logs[0][1] as Record<string, unknown>;
      assert.equal(payload.failureKind, kind);
      assert.equal(payload.httpStatus, status);
    }
    for (const data of [null, {}, { userId: secret, userSecret: secret }, { userId: "stockgpt-11111111-1111-4111-8111-111111111111" }]) {
      logs.length = 0;
      const invalidSdk = { authentication: { registerSnapTradeUser: async () => ({ data }) } } as unknown as SnapTradeClient;
      await assert.rejects(registerSnapTradeUser(admin, input, invalidSdk));
      assert.deepEqual(phases(), [["configuration", true], ["registration", false]]);
      assert.equal((logs[1][1] as Record<string, unknown>).failureKind, "invalid_registration_data");
      assert.equal((logs[1][1] as Record<string, unknown>).httpStatus, null);
    }
    logs.length = 0;
    await assert.rejects(registerSnapTradeUser(failedAdmin, input, sdk()));
    assert.deepEqual(phases(), [["configuration", true], ["registration", true], ["credential_store", false]]);
    logs.length = 0;
    await registerSnapTradeUser(admin, input, sdk());
    assert.deepEqual(phases(), [["configuration", true], ["registration", true], ["credential_store", true]]);
    logs.length = 0;
    const portal = { ...input, broker: "SANDBOX" as const, customRedirect: "https://preview.invalid/return" };
    await assert.rejects(createReadOnlySnapTradePortalLink(admin, portal, sdk(false, true)), (error) => error === failure);
    assert.deepEqual(phases(), [["configuration", true], ["portal_login", false]]);
    await createReadOnlySnapTradePortalLink(admin, portal, sdk());
    await assert.rejects(runSnapTradeDiagnosticPhase("registration", () => { throw { message: secret, name: secret }; }));
    for (const entry of logs) {
      assert.equal(entry.length, 2);
      assert.equal(entry[0], "[snaptrade-sandbox-phase]");
      const payload = entry[1] as Record<string, unknown>;
      assert.deepEqual(Object.keys(payload).sort(), payloadKeys(payload));
      assert.equal(payload.clientIdPresent, true);
      assert.equal(payload.consumerKeyPresent, true);
      assert.equal(payload.sandboxOptIn, true);
      assert(!JSON.stringify(entry).includes(secret), "Secret-bearing input escaped the diagnostic allowlist");
    }
    for (const flag of [undefined, "false", "TRUE"]) {
      logs.length = 0;
      if (flag === undefined) delete process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
      else process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = flag;
      await registerSnapTradeUser(admin, input, sdk());
      assert.equal(logs.length, 0, "Diagnostics must be disabled outside explicit Sandbox opt-in");
    }
    const route = readFileSync("app/api/broker/connections/start/route.ts", "utf8");
    assert.match(route, /catch \{\s*return NextResponse\.json\(\{ error: "Unable to open the connection portal\." \}/u);
    assert.doesNotMatch(route, /console\.|error\.message|error\.response/u);
  } finally {
    console.info = info;
    globalThis.fetch = fetch;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
  console.log("SnapTrade phase isolation, secret-free logs, default-off diagnostics and generic browser errors passed.");
}

check().catch(() => {
  console.error("SnapTrade diagnostics regression failed (details withheld).");
  process.exitCode = 1;
});
