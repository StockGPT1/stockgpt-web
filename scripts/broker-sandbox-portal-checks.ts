import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { brokerConnectionsEnabled, brokerPortalSandboxRestriction } from "../lib/brokerage/capability";
import { createReadOnlySnapTradePortalLink } from "../lib/brokerage/providers/snaptrade/service";
import type { SnapTradeClient } from "../lib/brokerage/providers/snaptrade/client";

async function checkSandboxPortal() {
  const previousSandbox = process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
  const previousCapability = process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network forbidden in Sandbox portal regression"); };

  // Only the credential RPC and portal SDK method used by this helper are mocked.
  const admin = {
    rpc: async () => ({ data: [{ provider_user_id: "synthetic-user", user_secret: "synthetic-secret" }], error: null }),
  } as unknown as SupabaseClient<Database>;
  let portalCalls = 0;
  try {
    for (const flag of [undefined, "false", "TRUE", "1", "true"]) {
      if (flag === undefined) delete process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
      else process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = flag;
      const expectedBroker = flag === "true" ? "SANDBOX" : undefined;
      assert.equal(brokerPortalSandboxRestriction(), expectedBroker);
      const sdk = {
        authentication: {
          loginSnapTradeUser: async (input: { broker?: string; connectionType: string }) => {
            portalCalls += 1;
            assert.equal(input.broker, expectedBroker);
            assert.equal(input.connectionType, "read");
            return { data: { redirectURI: "https://portal.example.invalid/fixture" } };
          },
        },
      } as unknown as SnapTradeClient;
      await createReadOnlySnapTradePortalLink(admin, {
        userId: "synthetic-user",
        providerId: "synthetic-provider",
        customRedirect: "https://preview.example.invalid/portfolio/connections/return",
        broker: brokerPortalSandboxRestriction(),
      }, sdk);
    }
    assert.equal(portalCalls, 5);
    delete process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED;
    assert.equal(brokerConnectionsEnabled(), false);
    process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED = "false";
    assert.equal(brokerConnectionsEnabled(), false);

    const route = readFileSync("app/api/broker/connections/start/route.ts", "utf8");
    const capability = readFileSync("lib/brokerage/capability.ts", "utf8");
    assert.match(capability, /^import "server-only";/u);
    assert.match(route, /broker: brokerPortalSandboxRestriction\(\)/u);
    assert.equal((route.match(/\bbroker\s*:/gu) ?? []).length, 1);
    assert.doesNotMatch(route, /(?:form\.get|searchParams\.get)\(["']broker["']\)|request\.json\(/u);
    assert.doesNotMatch(route, /\.\.\./u, "Client data must not be spread into portal arguments");
  } finally {
    if (previousSandbox === undefined) delete process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
    else process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = previousSandbox;
    if (previousCapability === undefined) delete process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED;
    else process.env.STOCKGPT_BROKER_CONNECTIONS_ENABLED = previousCapability;
    globalThis.fetch = previousFetch;
  }

  console.log("Hosted Sandbox broker restriction, default capability and mocked read-only portal checks passed.");
}

checkSandboxPortal().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
