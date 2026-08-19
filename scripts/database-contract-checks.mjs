import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const sourceRoots = ["app", "components", "lib", "utils"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

const runtimeSources = sourceRoots.flatMap((root) => sourceFiles(resolve(root)));
const legacyWatchlistReferences = runtimeSources.filter((file) =>
  /\.from\(\s*["']user_watchlist["']\s*\)/u.test(readFileSync(file, "utf8")),
);
assert(
  legacyWatchlistReferences.length === 0,
  `Runtime code still queries user_watchlist: ${legacyWatchlistReferences.join(", ")}`,
);

const route = readFileSync(resolve("app/api/rankings/financial-metrics/route.ts"), "utf8");
const rankingQuery = route.match(
  /\.from\("stock_rankings"\)[\s\S]*?\.limit\(1\)/u,
)?.[0];
const diagnosticsQuery = route.match(
  /\.from\("stock_factor_diagnostics"\)[\s\S]*?\.limit\(1\)/u,
)?.[0];

assert(rankingQuery, "Financial metrics route ranking query was not found");
assert(diagnosticsQuery, "Financial metrics route diagnostics query was not found");
assert(
  !/factor_coverage|data_confidence/u.test(rankingQuery),
  "Financial metrics route requests an unsupported stock_rankings column",
);
assert(
  /factor_coverage/u.test(diagnosticsQuery),
  "Financial metrics route no longer sources factor coverage from diagnostics",
);

const lazyDetails = readFileSync(resolve("components/LazyWhyRankDetails.tsx"), "utf8");
assert(
  lazyDetails.includes("data?.diagnostics?.factor_coverage"),
  "Ranking detail UI no longer reads factor coverage from diagnostics",
);
assert(
  !lazyDetails.includes("data_confidence"),
  "Ranking detail UI reintroduced unsupported data confidence",
);

console.log("Database schema-reference source contracts passed.");
