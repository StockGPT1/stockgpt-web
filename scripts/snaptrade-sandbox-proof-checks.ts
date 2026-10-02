import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const harness = readFileSync("scripts/snaptrade-sandbox-proof.ts", "utf8");
const service = readFileSync("lib/brokerage/providers/snaptrade/service.ts", "utf8");

assert.match(harness, /STOCKGPT_ALLOW_SNAPTRADE_SANDBOX[^\n]+!== "true"/u);
assert.match(harness, /const TARGET_BROKER = "SANDBOX" as const/u);
assert.match(harness, /merge-base", "--is-ancestor", PROOF_BASE_HEAD/u);
assert.doesNotMatch(harness, /process\.argv[^\n]+broker/iu);
assert.match(harness, /host !== "127\.0\.0\.1" && host !== "localhost"/u);
assert.match(harness, /git\("check-ignore", "\.env\.local"\)/u);
assert.match(service, /connectionType: "read"/u);
assert.match(service, /broker: input\.broker/u);
assert.doesNotMatch(harness, /console\.(?:log|error)\([^\n]*(?:CONSUMER_KEY|CLIENT_ID|userSecret)/u);
assert.doesNotMatch(harness, /sandbox_portal_url/u);
assert.match(harness, /spawn\("rundll32\.exe", \["url\.dll,FileProtocolHandler", portalUrl\]/u);
assert.match(harness, /console\.log\("sandbox_portal_opened=true"\)/u);
assert.match(harness, /runBoundedBrokerSyncWorker/u);
assert.match(harness, /create_connected_portfolio/u);
assert.match(harness, /sandbox_manual_holdings_copied=0/u);
assert.match(harness, /"cash-only": \{/u);
assert.match(harness, /sandbox_scenario_invalid/u);

console.log("SnapTrade Sandbox proof harness opt-in, local-only, read-only and secret-output guards passed.");
