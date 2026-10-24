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

test("rate limiting uses a transaction-scoped lock and a database RPC", () => {
  const sql = read("supabase/migrations/20261024_atomic_security_rate_limit.sql");
  const implementation = read("lib/security/rate-limit.ts");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.consume_security_rate_limit/);
  assert.match(implementation, /\.rpc\("consume_security_rate_limit"/);
  assert.doesNotMatch(implementation, /\.from\("security_rate_limits"\)/);
});

test("login and signup don't record request slots twice", () => {
  for (const path of ["app/api/auth/login/route.ts", "app/api/auth/signup/route.ts"]) {
    const code = read(path);
    assert.match(code, /checkRateLimit\(/);
    assert.doesNotMatch(code, /recordRateLimitAttempts|precheckRateLimit/);
  }
});
