// Run via npm against an already running, cleanly reset LOCAL synthetic stack.
// No remote service, reset, deployment or Git mutation is performed here.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

assert(process.env.npm_execpath, "Run npm run test:stage05-acceptance");
execFileSync(process.execPath, [resolve("scripts/verify-local-supabase-fixtures.mjs")], { stdio: "inherit" });
for (const script of [
  "test:profile-entitlement-security", "test:portfolio-persistence-foundation", "test:portfolio-ledger",
  "test:portfolio-cash", "test:portfolio-holdings", "test:portfolio-creation", "test:portfolio-csv",
  "test:portfolio-currency", "test:portfolio-write-boundaries", "test:portfolio-cache",
  "test:portfolio-finite-state", "test:stage05-performance", "test:stage05-integration",
  "test:portfolio-intelligence-adapter:local", "db:migrations:check", "test:db-migrations",
  "test:database-contract", "db:types:check",
]) {
  console.log(`Stage 05 acceptance gate: ${script}`);
  execFileSync(process.execPath, [process.env.npm_execpath, "run", script], { stdio: "inherit" });
}
console.log("Stage 05 local database/integration gates passed. Application type/lint/build gates remain separately required.");
