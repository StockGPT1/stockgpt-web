import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { isBrokerSyncStopped } from "../lib/brokerage/rollout-policy";

assert.equal(isBrokerSyncStopped(undefined), false);
assert.equal(isBrokerSyncStopped("false"), false);
for (const flag of ["true", "FALSE", "", "invalid"]) assert.equal(isBrokerSyncStopped(flag), true);
async function main() {
  for (const authorized of [false, true]) for (const flag of [undefined, "false", "true", "invalid"]) {
    const calls = { admin: 0, worker: 0 };
    const modules: Record<string, unknown> = {
      "next/server": { NextResponse: { json: (data: unknown, options?: ResponseInit) => Response.json(data, options) } },
      "@/lib/security/cron": { isAuthorizedCron: () => authorized, unauthorizedCron: () => Response.json({ error: "unauthorized" }, { status: 401 }) },
      "@/lib/brokerage/capability": { brokerSyncStopped: () => isBrokerSyncStopped(flag) },
      "@/utils/supabase/admin": { createAdminClient: () => { calls.admin++; return {}; } },
      "@/lib/brokerage/sync-worker": { runBoundedBrokerSyncWorker: async () => { calls.worker++; return { claimed: 0, results: [] }; } },
    };
    const source = ts.transpileModule(readFileSync("app/api/cron/broker-sync/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { GET?: (request: Request) => Promise<Response> } = {};
    vm.runInNewContext(source, { exports, require: (key: string) => { assert(key in modules); return modules[key]; } });
    const response = await exports.GET!(new Request("https://synthetic.invalid/api/cron/broker-sync"));
    const shouldExecute = authorized && !isBrokerSyncStopped(flag);
    assert.equal(response.status, !authorized ? 401 : shouldExecute ? 200 : 503);
    assert.deepEqual(calls, { admin: shouldExecute ? 1 : 0, worker: shouldExecute ? 1 : 0 });
  }
  assert(readFileSync("lib/brokerage/capability.ts", "utf8").includes("process.env.STOCKGPT_BROKER_SYNC_STOPPED"));
  console.log("Broker synchronization stop: 8 actual-route mocked cases; auth first, zero claims/admin work when paused; normal default preserved.");
}
main().catch(() => { console.error("broker_sync_stop_checks_failed"); process.exitCode = 1; });
