import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { checkRepository } from "./check-supabase-migration-safety.mjs";

const repositoryRoot = resolve(".");
const baselineFilename = "20260606152628_phase_4_notifications_and_feedback.sql";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stockgpt-migration-safety-"));
  mkdirSync(join(root, "supabase"), { recursive: true });
  cpSync(
    join(repositoryRoot, "supabase", "migrations"),
    join(root, "supabase", "migrations"),
    { recursive: true },
  );
  cpSync(
    join(repositoryRoot, "supabase", "migration-baseline-manifest.json"),
    join(root, "supabase", "migration-baseline-manifest.json"),
  );
  return root;
}

function writeFixtureFile(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function expectFailure(name, mutate, expectedMessage) {
  const root = fixture();
  try {
    mutate(root);
    let failure;
    try {
      checkRepository({ root });
    } catch (error) {
      failure = error;
    }
    if (!(failure instanceof Error)) {
      throw new Error(`${name}: checker unexpectedly passed`);
    }
    if (!failure.message.includes(expectedMessage)) {
      throw new Error(
        `${name}: expected ${JSON.stringify(expectedMessage)}, received ${failure.message}`,
      );
    }
    console.log(`PASS: ${name}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const realResult = checkRepository({ root: repositoryRoot });
if (realResult.baselineCount !== 26) {
  throw new Error("Positive migration-safety fixture did not verify 26 baseline files.");
}
console.log("PASS: current repository baseline");

expectFailure(
  "missing historical baseline migration",
  (root) => rmSync(join(root, "supabase", "migrations", baselineFilename)),
  "Missing historical baseline migration",
);

expectFailure(
  "modified historical baseline migration",
  (root) =>
    appendFileSync(
      join(root, "supabase", "migrations", baselineFilename),
      "\n-- accidental historical edit\n",
      "utf8",
    ),
  "Historical baseline hash mismatch",
);

expectFailure(
  "duplicate migration timestamp",
  (root) => {
    writeFixtureFile(
      root,
      "supabase/migrations/20260710000000_first.sql",
      "select 1;\n",
    );
    writeFixtureFile(
      root,
      "supabase/migrations/20260710000000_second.sql",
      "select 2;\n",
    );
  },
  "Duplicate migration timestamp 20260710000000",
);

expectFailure(
  "future migration older than canonical tip",
  (root) =>
    writeFixtureFile(
      root,
      "supabase/migrations/20260709230152_out_of_order.sql",
      "select 1;\n",
    ),
  "Future migration timestamp must be greater than 20260709230153",
);

expectFailure(
  "future migration equal to canonical tip",
  (root) =>
    writeFixtureFile(
      root,
      "supabase/migrations/20260709230153_duplicate_tip.sql",
      "select 1;\n",
    ),
  "Duplicate migration timestamp 20260709230153",
);

expectFailure(
  "unapproved future no-op migration",
  (root) =>
    writeFixtureFile(
      root,
      "supabase/migrations/20260710000001_noop.sql",
      "-- comment-only migration\n",
    ),
  "comment-only no-op without an approved exception",
);

expectFailure(
  "dangerous executable linked reset",
  (root) =>
    writeFixtureFile(
      root,
      "scripts/unsafe-reset.sh",
      "npx supabase db reset --linked\n",
    ),
  "Executable linked database reset found",
);

expectFailure(
  "dangerous executable production seed push",
  (root) =>
    writeFixtureFile(
      root,
      ".github/workflows/unsafe-seed.yml",
      "steps:\n  - run: npx supabase db push --include-seed\n",
    ),
  "Executable db push with seed found",
);

console.log("All Supabase migration-safety checker tests passed.");
