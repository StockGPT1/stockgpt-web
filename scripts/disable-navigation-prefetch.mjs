import fs from "node:fs";

const appShellFile = "components/AppShell.tsx";
let appShell = fs.readFileSync(appShellFile, "utf8");

appShell = appShell.replace('import { NavigationWarmup } from "@/components/NavigationWarmup";\n', "");
appShell = appShell.replace(/\n\s*<NavigationWarmup \/>/g, "");
appShell = appShell.replace(/\n\s*prefetch(?=\n)/g, "\n                  prefetch={false}");

fs.writeFileSync(appShellFile, appShell);

const warmupFile = "components/NavigationWarmup.tsx";
if (fs.existsSync(warmupFile)) {
  fs.writeFileSync(
    warmupFile,
    `"use client";\n\nexport function NavigationWarmup() {\n  return null;\n}\n`,
  );
}

const portfolioFile = "components/PortfolioCommandCentreRevolut.tsx";
if (fs.existsSync(portfolioFile)) {
  let portfolio = fs.readFileSync(portfolioFile, "utf8");
  portfolio = portfolio.replace(
    /(<StockChart[\s\S]*?ticker="Portfolio"[\s\S]*?compact)(\s*\/\>)/g,
    (match, start, end) => {
      if (match.includes("preciseValues") || match.includes("showHoverChange")) return match;
      return `${start}\n            currency={currency}\n            preciseValues\n            showHoverChange${end}`;
    },
  );
  fs.writeFileSync(portfolioFile, portfolio);
}
