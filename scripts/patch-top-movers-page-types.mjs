import fs from "node:fs";

const file = "app/top-movers/page.tsx";
let source = fs.readFileSync(file, "utf8");

if (!source.includes('import type { TimeRange } from "@/components/StockChart";')) {
  source = source.replace(
    'import type { Metadata } from "next";\n',
    'import type { Metadata } from "next";\nimport type { TimeRange } from "@/components/StockChart";\n',
  );
}

source = source.replace(
  '  const ranges = fallback ? [range, fallback] : [range];\n  const data = await getStockChart(ticker, ranges);',
  '  const ranges: TimeRange[] = fallback ? [range, fallback] : [range];\n  const data = await getStockChart(ticker, ranges);',
);

fs.writeFileSync(file, source);
