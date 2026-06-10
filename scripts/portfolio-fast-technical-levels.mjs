import fs from "node:fs";

const file = "lib/portfolio-alerts.ts";
let source = fs.readFileSync(file, "utf8");

const marker = "// FAST_PORTFOLIO_TECHNICAL_LEVELS_PATCH";
if (!source.includes(marker)) {
  source = source.replace(
    '  try {\n    const chart = await getStockChart(ticker, ["6M", "1Y"]);',
    `  ${marker}\n  return {\n    stopLoss: currentPrice * 0.92,\n    takeProfit: currentPrice * 1.14,\n    support: null,\n    resistance: null,\n    ma50: null,\n    volatilityPct: 4,\n    source: "fallback",\n  };\n\n  try {\n    const chart = await getStockChart(ticker, ["6M", "1Y"]);`,
  );
}

fs.writeFileSync(file, source);
