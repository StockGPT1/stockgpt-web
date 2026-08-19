import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_BASELINE_COUNT = 26;
const EXPECTED_BASELINE_TIP = "20260709230153";
const EXPECTED_TIP_FILENAME =
  "20260709230153_add_portfolio_objective_preference.sql";
const EXPECTED_BASELINE_FINGERPRINT =
  "da287ee7746d5c6ecd6a9694fbc7df023e4e118424644ea11f7dcbba356775d7";
const MIGRATION_FILENAME = /^(\d{14})_([a-z0-9][a-z0-9_-]*)\.sql$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const EXECUTABLE_EXTENSIONS = new Set([
  ".bat",
  ".cjs",
  ".cmd",
  ".js",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".ts",
  ".yaml",
  ".yml",
]);
const SCAN_EXCLUSIONS = new Set([
  "scripts/check-supabase-migration-safety.mjs",
  "scripts/check-supabase-migration-safety.test.mjs",
]);

function normalisePath(path) {
  return path.split(sep).join("/");
}

function normaliseLineEndings(value) {
  return value.replace(/\r\n/gu, "\n");
}

function contentHash(value) {
  return createHash("sha256")
    .update(normaliseLineEndings(value), "utf8")
    .digest("hex");
}

function sqlWithoutComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/--[^\r\n]*/gu, "")
    .trim();
}

function filesRecursively(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  });
}

function addViolation(violations, message) {
  if (!violations.includes(message)) violations.push(message);
}

function validateManifest(manifest, violations) {
  if (manifest.schemaVersion !== 1) {
    addViolation(violations, "Migration manifest schemaVersion must be 1.");
  }
  if (manifest.hashAlgorithm !== "sha256-lf-normalized-v1") {
    addViolation(
      violations,
      "Migration manifest must use sha256-lf-normalized-v1.",
    );
  }
  if (manifest.canonicalHistoricalTip !== EXPECTED_BASELINE_TIP) {
    addViolation(
      violations,
      `Canonical historical tip must remain ${EXPECTED_BASELINE_TIP}.`,
    );
  }
  if (
    !Array.isArray(manifest.baselineMigrations) ||
    manifest.baselineMigrations.length !== EXPECTED_BASELINE_COUNT
  ) {
    addViolation(
      violations,
      `Migration manifest must contain exactly ${EXPECTED_BASELINE_COUNT} baseline migrations.`,
    );
  }
  if (!Array.isArray(manifest.approvedFutureNoOps)) {
    addViolation(violations, "approvedFutureNoOps must be an array.");
  }
}

function checkMigrationFiles(root, manifest, violations) {
  const migrationsDirectory = resolve(root, "supabase", "migrations");
  if (!existsSync(migrationsDirectory)) {
    addViolation(violations, "supabase/migrations is missing.");
    return { baselineCount: 0, futureCount: 0 };
  }

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((name) => statSync(join(migrationsDirectory, name)).isFile())
    .sort();
  const manifestEntries = Array.isArray(manifest.baselineMigrations)
    ? manifest.baselineMigrations
    : [];
  const baselineByName = new Map();
  const manifestVersions = new Map();

  for (const entry of manifestEntries) {
    if (
      !entry ||
      typeof entry.filename !== "string" ||
      typeof entry.sha256 !== "string"
    ) {
      addViolation(violations, "Every baseline manifest entry needs filename and sha256 strings.");
      continue;
    }
    if (baselineByName.has(entry.filename)) {
      addViolation(violations, `Duplicate baseline manifest filename: ${entry.filename}`);
    }
    baselineByName.set(entry.filename, entry);
    const match = entry.filename.match(MIGRATION_FILENAME);
    if (!match) {
      addViolation(violations, `Invalid baseline migration filename: ${entry.filename}`);
    } else if (manifestVersions.has(match[1])) {
      addViolation(violations, `Duplicate baseline manifest timestamp: ${match[1]}`);
    } else {
      manifestVersions.set(match[1], entry.filename);
    }
    if (!SHA256.test(entry.sha256)) {
      addViolation(violations, `Invalid SHA-256 for baseline migration: ${entry.filename}`);
    }
  }

  const sortedBaselineNames = [...baselineByName.keys()].sort();
  if (sortedBaselineNames.at(-1) !== EXPECTED_TIP_FILENAME) {
    addViolation(
      violations,
      `Historical baseline tip filename must remain ${EXPECTED_TIP_FILENAME}.`,
    );
  }
  const baselineFingerprint = contentHash(
    manifestEntries
      .map((entry) => `${entry?.filename}:${entry?.sha256}`)
      .join("\n"),
  );
  if (baselineFingerprint !== EXPECTED_BASELINE_FINGERPRINT) {
    addViolation(
      violations,
      "Historical baseline manifest fingerprint changed; Stage 03 compatibility history is immutable.",
    );
  }

  const versions = new Map();
  for (const filename of migrationFiles) {
    const match = filename.match(MIGRATION_FILENAME);
    if (!match) {
      addViolation(violations, `Invalid migration filename: ${filename}`);
      continue;
    }
    const [previous] = versions.get(match[1]) ?? [];
    if (previous) {
      addViolation(
        violations,
        `Duplicate migration timestamp ${match[1]}: ${previous}, ${filename}`,
      );
    } else {
      versions.set(match[1], [filename]);
    }
  }

  for (const entry of baselineByName.values()) {
    const path = join(migrationsDirectory, entry.filename);
    if (!existsSync(path)) {
      addViolation(violations, `Missing historical baseline migration: ${entry.filename}`);
      continue;
    }
    const actualHash = contentHash(readFileSync(path, "utf8"));
    if (actualHash !== entry.sha256) {
      addViolation(violations, `Historical baseline hash mismatch: ${entry.filename}`);
    }
  }

  const approvedFutureNoOps = new Set(
    Array.isArray(manifest.approvedFutureNoOps)
      ? manifest.approvedFutureNoOps
      : [],
  );
  let futureCount = 0;
  for (const filename of migrationFiles) {
    if (baselineByName.has(filename)) continue;
    const match = filename.match(MIGRATION_FILENAME);
    if (!match) continue;
    futureCount += 1;
    const version = match[1];
    if (version <= EXPECTED_BASELINE_TIP) {
      addViolation(
        violations,
        `Future migration timestamp must be greater than ${EXPECTED_BASELINE_TIP}: ${filename}`,
      );
    }
    const sql = readFileSync(join(migrationsDirectory, filename), "utf8");
    if (sql.trim().length === 0) {
      addViolation(violations, `Future migration is empty: ${filename}`);
    } else if (
      sqlWithoutComments(sql).length === 0 &&
      !approvedFutureNoOps.has(filename)
    ) {
      addViolation(
        violations,
        `Future migration is a comment-only no-op without an approved exception: ${filename}`,
      );
    }
  }

  for (const filename of approvedFutureNoOps) {
    if (baselineByName.has(filename) || !migrationFiles.includes(filename)) {
      addViolation(
        violations,
        `Stale or invalid approvedFutureNoOps entry: ${filename}`,
      );
    }
  }

  return { baselineCount: baselineByName.size, futureCount };
}

function checkExecutableAutomation(root, violations) {
  const candidates = [
    ...filesRecursively(resolve(root, ".github", "workflows")),
    ...filesRecursively(resolve(root, "scripts")),
  ];
  const packageJson = resolve(root, "package.json");
  if (existsSync(packageJson)) candidates.push(packageJson);

  for (const path of candidates) {
    const repositoryPath = normalisePath(relative(root, path));
    if (SCAN_EXCLUSIONS.has(repositoryPath)) continue;
    if (
      repositoryPath !== "package.json" &&
      !EXECUTABLE_EXTENSIONS.has(extname(path).toLowerCase())
    ) {
      continue;
    }

    const source = readFileSync(path, "utf8").replace(/\\\r?\n\s*/gu, " ");
    const linkedReset = /\bsupabase(?:\.cmd)?\s+db\s+reset\b[^\r\n]*--linked\b/iu;
    const historyRepair = /\bsupabase(?:\.cmd)?\s+migration\s+repair\b/iu;
    const seedPush = /\bsupabase(?:\.cmd)?\s+db\s+push\b[^\r\n]*--include-seed\b/iu;
    const remotePush = /\bsupabase(?:\.cmd)?\s+db\s+push\b(?![^\r\n]*--local\b)/iu;
    const databaseUrl = /postgres(?:ql)?:\/\/[^\s"']+/iu;

    if (linkedReset.test(source)) {
      addViolation(violations, `Executable linked database reset found: ${repositoryPath}`);
    }
    if (historyRepair.test(source)) {
      addViolation(violations, `Executable migration-history repair found: ${repositoryPath}`);
    }
    if (seedPush.test(source)) {
      addViolation(violations, `Executable db push with seed found: ${repositoryPath}`);
    }
    if (remotePush.test(source)) {
      addViolation(violations, `Executable remote db push found: ${repositoryPath}`);
    }
    const urlMatch = source.match(databaseUrl)?.[0];
    if (
      urlMatch &&
      !/postgres(?:ql)?:\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1)(?::|\/)/iu.test(
        urlMatch,
      )
    ) {
      addViolation(violations, `Embedded non-local database URL found: ${repositoryPath}`);
    }
  }
}

export function checkRepository({ root = process.cwd() } = {}) {
  const repositoryRoot = resolve(root);
  const manifestPath = resolve(
    repositoryRoot,
    "supabase",
    "migration-baseline-manifest.json",
  );
  if (!existsSync(manifestPath)) {
    throw new Error("Migration safety check failed:\n- Baseline manifest is missing.");
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Migration safety check failed:\n- Invalid baseline manifest: ${error.message}`);
  }

  const violations = [];
  validateManifest(manifest, violations);
  const counts = checkMigrationFiles(repositoryRoot, manifest, violations);
  checkExecutableAutomation(repositoryRoot, violations);

  if (violations.length > 0) {
    throw new Error(
      `Migration safety check failed:\n${violations.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  return counts;
}

const isCommandLineEntry =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommandLineEntry) {
  try {
    const result = checkRepository();
    console.log(
      `Supabase migration safety passed: ${result.baselineCount} immutable baseline migrations verified, ${result.futureCount} future migrations checked, executable automation scan clean.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
