import fs from "node:fs";

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

const cacheFile = "lib/portfolio-speed-cache.ts";
let cache = fs.readFileSync(cacheFile, "utf8");
cache = replaceAll(cache, "process.env.PORTFOLIO_SNAPSHOT_TTL_MS ?? 2 * 60 * 1000", "process.env.PORTFOLIO_SNAPSHOT_TTL_MS ?? 15 * 60 * 1000");
cache = replaceAll(cache, "process.env.PORTFOLIO_SHARED_CACHE_TTL_SECONDS ?? 5 * 60", "process.env.PORTFOLIO_SHARED_CACHE_TTL_SECONDS ?? 10 * 60");
cache = cache.replace(
  /console\.info\(`\[perf:\$\{label\}\]`, \{ totalMs, marks, \.\.\.extra \}\);/,
  `const compactMarks = marks.map((mark) => mark.label + ":" + mark.ms).join(",");
      const compactExtra = Object.entries(extra).map(([key, value]) => key + "=" + String(value)).join(",");
      console.info("[perf:" + label + "] totalMs=" + totalMs + " marks=" + compactMarks + " " + compactExtra);`,
);
fs.writeFileSync(cacheFile, cache);

const pageFile = "app/portfolio/page.tsx";
let page = fs.readFileSync(pageFile, "utf8");
page = replaceAll(page, 'const PORTFOLIO_SNAPSHOT_VERSION = "fast-chart-v3";', 'const PORTFOLIO_SNAPSHOT_VERSION = "correct-chart-v4";');
fs.writeFileSync(pageFile, page);
