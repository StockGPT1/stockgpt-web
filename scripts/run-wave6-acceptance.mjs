import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run Wave 6 acceptance through npm");
const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const env = {
  ...process.env,
  STOCKGPT_EXTERNAL_NETWORK_DISABLED: "true",
  STOCKGPT_BROKER_CONNECTIONS_ENABLED: "false",
  STOCKGPT_USD_FX_RATES_JSON: JSON.stringify({ USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.85 }),
};
const run = (command, args = []) => execFileSync(command, args, { env, stdio: "inherit" });
const runQuiet = (command, args = []) =>
  execFileSync(command, args, { env, stdio: ["ignore", "ignore", "inherit"] });
const npmRun = (script) => run(process.execPath, [npm, "run", script]);

try {
  runQuiet(process.execPath, [cli, "start"]);
  run(process.execPath, [cli, "db", "reset", "--local"]);
  npmRun("test:acceptance:static");
  npmRun("test:acceptance:database");
  npmRun("test:performance");
  npmRun("test:acceptance:browser");
  run(process.execPath, [resolve("node_modules", "next", "dist", "bin", "next"), "typegen"]);
  run(process.execPath, [resolve("node_modules", "typescript", "bin", "tsc"), "--noEmit"]);
  npmRun("lint");
  npmRun("build:app");
  run("git", ["diff", "--check"]);
  console.log("Wave 6 full local acceptance gate passed.");
} finally {
  run(process.execPath, [cli, "stop"]);
}
