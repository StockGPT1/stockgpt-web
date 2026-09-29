import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { isAuthorizedCron } from "../lib/security/cron";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const originalSecret = process.env.CRON_SECRET;
process.env.CRON_SECRET = "wave5-test-secret";
assert.equal(isAuthorizedCron(new NextRequest("https://example.test/api/cron")), false);
assert.equal(isAuthorizedCron(new NextRequest("https://example.test/api/cron", {
  headers: { "user-agent": "vercel-cron/1.0", "x-vercel-cron-schedule": "0 0 * * *" },
})), false, "spoofable cron headers must not authorize a request");
assert.equal(isAuthorizedCron(new NextRequest("https://example.test/api/cron", {
  headers: { authorization: "Bearer wave5-test-secret" },
})), true);
if (originalSecret === undefined) delete process.env.CRON_SECRET;
else process.env.CRON_SECRET = originalSecret;

assert.doesNotMatch(source("utils/supabase/admin.ts"), /["']use client["']/);
assert.doesNotMatch(source("lib/stripe.ts"), /["']use client["']/);
const clientSources = [
  "components/AppShell.tsx", "components/MobileNav.tsx", "components/MobileBottomNav.tsx",
].map(source).join("\n");
assert.doesNotMatch(clientSources, /utils\/supabase\/admin|lib\/stripe|SUPABASE_SERVICE_ROLE_KEY/);
for (const path of [
  "app/api/settings/currency/route.ts",
  "app/api/settings/email-news-digest/route.ts",
  "app/api/settings/notification-preferences/route.ts",
  "app/api/rankings/financial-metrics/route.ts",
  "app/api/search/route.ts",
]) {
  assert.doesNotMatch(source(path), /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY/);
}
const stripe = source("app/api/stripe-webhook/route.ts");
assert.ok(stripe.indexOf("stripe.webhooks.constructEvent") < stripe.indexOf("const admin = createAdminClient"));
assert.match(stripe, /process_stripe_entitlement_event/);
assert.match(stripe, /record_stripe_webhook_failure/);
assert.doesNotMatch(stripe, /\.from\(["']profiles["']\)\s*\.update/s);

console.log("Wave 5 trusted-service source checks passed.");
