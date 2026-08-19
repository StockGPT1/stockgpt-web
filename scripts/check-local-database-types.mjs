import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const committedTypesPath = resolve("lib", "database.types.ts");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "stockgpt-local-db-types-"));
const temporaryTypesPath = join(temporaryDirectory, "database.types.ts");

function normaliseGeneratedOutput(value) {
  return value.replace(/\r\n/gu, "\n").replace(/\n+$/u, "\n");
}

try {
  const generatedTypes = execFileSync(
    process.execPath,
    [cli, "gen", "types", "typescript", "--local"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  writeFileSync(temporaryTypesPath, generatedTypes, "utf8");

  const committedTypes = readFileSync(committedTypesPath, "utf8");
  if (
    normaliseGeneratedOutput(generatedTypes) !==
    normaliseGeneratedOutput(committedTypes)
  ) {
    throw new Error(
      "Committed database types differ from a fresh LOCAL generation. Run npm run types:gen:local and review the schema/type diff.",
    );
  }

  console.log("Committed database types match fresh LOCAL generation.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
