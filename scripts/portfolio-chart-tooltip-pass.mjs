import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

source = source.replace(
  /(<StockChart[\s\S]*?ticker="Portfolio"[\s\S]*?compact)(\s*\/\>)/g,
  (match, start, end) => {
    if (match.includes("preciseValues") || match.includes("showHoverChange")) return match;
    return `${start}\n            currency={currency}\n            preciseValues\n            showHoverChange${end}`;
  },
);

fs.writeFileSync(file, source);
