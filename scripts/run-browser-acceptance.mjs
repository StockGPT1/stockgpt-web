import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const local = Object.fromEntries(
  output
    .split(/\r?\n/u)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
    .filter(Boolean)
    .map((match) => [
      match[1],
      match[2].startsWith('"') ? JSON.parse(match[2]) : match[2],
    ]),
);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY ?? local.SECRET_KEY,
  STOCKGPT_BROKER_CONNECTIONS_ENABLED: "false",
  STOCKGPT_EXTERNAL_NETWORK_DISABLED: "true",
  NEXT_PUBLIC_STOCKGPT_EXTERNAL_NETWORK_DISABLED: "true",
  STOCKGPT_BROWSER_ACCEPTANCE: "true",
  STOCKGPT_USD_FX_RATES_JSON: JSON.stringify({
    USD: 1,
    GBP: 0.8,
    EUR: 0.9,
    CHF: 0.85,
  }),
};

const localEdge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
if (process.platform === "win32" && existsSync(localEdge)) {
  env.PLAYWRIGHT_EXECUTABLE_PATH = localEdge;
}

const result = spawnSync(
  process.execPath,
  [resolve("node_modules", "@playwright", "test", "cli.js"), "test"],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
