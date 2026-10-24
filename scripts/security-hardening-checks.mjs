import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("cron jobs require a bearer secret rather than spoofable headers", () => {
  const code = read("lib/security/cron.ts");
  assert.match(code, /process\.env\.CRON_SECRET/);
  assert.match(code, /timingSafeEqual/);
  assert.doesNotMatch(code, /vercel-cron\/1\.0|x-vercel-cron-schedule/);
});

test("chart scanner checks entitlement and limits AI spend", () => {
  const code = read("app/api/chart-scan/route.ts");
  assert.match(code, /hasActiveSubscription\(profile\?\.subscription_status\)/);
  assert.match(code, /checkRateLimit\(/);
  assert.match(code, /limit: 10/);
});

test("client profile updates cannot modify billing fields", () => {
  const code = read("supabase/migrations/20261024_protect_profile_billing_fields.sql");
  assert.match(code, /NEW\.subscription_status IS DISTINCT FROM OLD\.subscription_status/);
  assert.match(code, /NEW\.stripe_customer_id IS DISTINCT FROM OLD\.stripe_customer_id/);
  assert.match(code, /BEFORE UPDATE ON public\.profiles/);
});

test("marketing samples are not labelled as real backtests", () => {
  const code = read("app/landing/ScrollLandingScreens.tsx");
  assert.match(code, /Illustrative portfolio example/);
  assert.match(code, /example rankings \(not live\)/);
  assert.doesNotMatch(code, /Backtested CAGR|5-year backtest/);
});
