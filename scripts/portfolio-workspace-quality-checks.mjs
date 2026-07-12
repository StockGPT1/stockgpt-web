import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const canonicalPage = read("app/portfolio/page.tsx");
const modernPage = read("app/portfolio/modern/page.tsx");
const shellExport = read("components/PortfolioModernWorkspace.tsx");
const workspaceFiles = [
  "components/portfolio-workspace/PortfolioModernWorkspace.tsx",
  "components/portfolio-workspace/PortfolioStage.tsx",
  "components/portfolio-workspace/PortfolioOverview.tsx",
  "components/portfolio-workspace/PortfolioHoldings.tsx",
  "components/portfolio-workspace/PortfolioActivity.tsx",
  "components/portfolio-workspace/PortfolioHoldingsVisuals.tsx",
  "components/portfolio-workspace/PortfolioActionSheets.tsx",
  "components/portfolio-workspace/PortfolioSheet.tsx",
  "components/portfolio-workspace/PortfolioIcon.tsx",
  "components/portfolio-workspace/types.ts",
  "components/portfolio-workspace/utils.ts",
];
const workspace = workspaceFiles.map(read).join("\n");
const orchestrator = read("components/portfolio-workspace/PortfolioModernWorkspace.tsx");
const stage = read("components/portfolio-workspace/PortfolioStage.tsx");
const overview = read("components/portfolio-workspace/PortfolioOverview.tsx");
const holdings = read("components/portfolio-workspace/PortfolioHoldings.tsx");
const activity = read("components/portfolio-workspace/PortfolioActivity.tsx");
const visuals = read("components/portfolio-workspace/PortfolioHoldingsVisuals.tsx");
const sheets = read("components/portfolio-workspace/PortfolioActionSheets.tsx");
const sheetShell = read("components/portfolio-workspace/PortfolioSheet.tsx");
const cashAction = read("lib/actions/portfolio-cash.ts");
const layout = read("app/layout.tsx");
const nextConfig = read("next.config.ts");
const loading = read("app/portfolio/loading.tsx");

assert.match(canonicalPage, /from\s+["']\.\/modern\/page["']/);
assert.match(canonicalPage, /export const dynamic = ["']force-dynamic["']/);
assert.match(shellExport, /portfolio-workspace\/PortfolioModernWorkspace/);
assert.doesNotMatch(nextConfig, /source:\s*["']\/portfolio["']/);
assert.match(modernPage, /<PortfolioModernWorkspace/);
assert.match(modernPage, /redirect\(["']\/login["']\)/);

for (const removedPath of [
  "components/PortfolioWorkspaceRedesign.tsx",
  "components/PortfolioAllocationBarPolish.tsx",
  "app/portfolio-workspace-redesign.css",
  "app/portfolio-allocation-polish.css",
  "app/portfolio-chart-border-fix.css",
]) {
  assert.equal(exists(removedPath), false, `${removedPath} must not return`);
}
assert.doesNotMatch(layout, /PortfolioWorkspaceRedesign|PortfolioAllocationBarPolish/);
assert.doesNotMatch(layout, /portfolio-workspace-redesign\.css|portfolio-allocation-polish\.css|portfolio-chart-border-fix\.css/);
assert.doesNotMatch(workspace, /MutationObserver|innerHTML\s*=|document\.createElement|insertAdjacentElement|classList\./);
assert.equal((workspace.match(/document\.querySelector/g) ?? []).length, 0);
assert.equal((workspace.match(/querySelectorAll/g) ?? []).length, 1);
assert.match(sheetShell, /dialogRef\.current\?\.querySelectorAll/);

assert.match(orchestrator, /PortfolioSection/);
assert.match(stage, /label: "Overview"/);
assert.match(stage, /label: "Holdings"/);
assert.match(stage, /label: "Activity"/);
assert.doesNotMatch(stage, /SECTION_ITEMS[\s\S]{0,400}label: "Add"/);
assert.doesNotMatch(stage, /SECTION_ITEMS[\s\S]{0,400}label: "Manage"/);
assert.match(orchestrator, /setAddOpen\(true\)/);
assert.match(orchestrator, /setManageOpen\(true\)/);

assert.match(orchestrator, /searchParams\.get\("section"\)/);
assert.match(orchestrator, /params\.set\("section", next\.section\)/);
assert.match(orchestrator, /params\.set\("portfolio", next\.portfolio\)/);
assert.match(orchestrator, /sectionAnchorRef\.current\?\.scrollIntoView/);
assert.match(modernPage, /params\.section === "holdings" \|\| params\.section === "activity"/);
assert.match(modernPage, /portfolios\.some\(\(portfolio\) => portfolio\.id === params\.portfolio\)/);

assert.match(modernPage, /buildPortfolioHealthSummary/);
assert.match(modernPage, /buildPortfolioPageChartResult/);
assert.match(modernPage, /currentAllocationPct:\s*totalValue > 0 \? \(currentValue \/ totalValue\) \* 100 : 0/);
assert.match(modernPage, /allowCurrentSnapshot:\s*enriched\.every/);
assert.match(visuals, /of total portfolio/);
assert.doesNotMatch(workspace, /allocation[^\n]{0,80}Math\.random/);
assert.match(stage, /filterDisplayablePortfolioChartData/);

assert.match(overview, /Portfolio Pulse/);
assert.match(overview, /Conviction × exposure/);
assert.match(overview, /Portfolio-fit ideas/);
assert.match(visuals, /ConvictionMap/);
assert.match(visuals, /AllocationTreemap/);
assert.match(holdings, /Search holdings/);
assert.match(holdings, /sticky top-0/);
assert.match(activity, /Load more activity/);
assert.match(activity, /Transactions are user actions/);

assert.match(orchestrator, /overflow-x-hidden/);
assert.match(orchestrator, /pb-\[calc\(120px\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(orchestrator, /max-w-\[1480px\]/);
assert.match(loading, /aria-label="Loading portfolio"/);
assert.match(loading, /aria-busy="true"/);
assert.match(loading, /pb-\[calc\(120px\+env\(safe-area-inset-bottom\)\)\]/);

assert.match(overview, /snap-x snap-mandatory/);
assert.match(workspace, /overflow-x-auto/);
assert.match(workspace, /\[scrollbar-width:none\]/);
assert.match(sheetShell, /overflow-y-auto overscroll-contain/);

assert.match(sheetShell, /role="dialog"/);
assert.match(sheetShell, /aria-modal="true"/);
assert.match(sheetShell, /event\.key === "Escape"/);
assert.match(sheetShell, /document\.activeElement/);
assert.match(sheetShell, /closeConfirmation/);
assert.match(sheetShell, /safe-area-inset-bottom/);
assert.match(workspace, /focus-visible:outline/);
assert.match(visuals, /Accessible map data/);
assert.match(visuals, /Open holding/);

assert.match(sheets, /Add holding/);
assert.match(sheets, /Add cash/);
assert.match(sheets, /Withdraw cash/);
assert.match(sheets, /Import Trading 212/);
assert.match(sheets, /Create another portfolio/);
assert.match(sheets, /buyHoldingWithCash/);
assert.match(sheets, /logExistingHolding/);
assert.match(sheets, /withdrawPortfolioCash/);
assert.match(sheets, /updatePortfolioPreferences/);
assert.match(sheets, /Discard unsaved portfolio changes/);
assert.match(cashAction, /eq\("user_id", user\.id\)/);
assert.match(cashAction, /amount > currentCash/);
assert.match(cashAction, /Restore the balance/);
assert.match(cashAction, /invalidatePortfolioPageSnapshot/);

assert.match(workspace, /size-11|size-12/);
assert.match(workspace, /h-12/);
assert.match(workspace, /min-h-11/);

assert.match(stage, /StockGPT only plots confirmed portfolio snapshots/);
assert.match(stage, /Preparing reliable chart history/);
assert.match(stage, /Using the last reliable chart|Showing cached chart/);
assert.match(stage, /Chart history unavailable/);

const allocation = (holdingValue, totalValue) => (totalValue > 0 ? (holdingValue / totalValue) * 100 : 0);
assert.equal(allocation(0, 1000), 0);
assert.equal(allocation(1000, 1000), 100);
assert.ok(Math.abs(allocation(1237, 5634) - 21.956) < 0.01);
const values = [1237, 889.24, 864.96, 829.49, 538.2];
const cash = 1275.11;
const total = values.reduce((sum, value) => sum + value, 0) + cash;
const reconciled = values.reduce((sum, value) => sum + allocation(value, total), 0) + allocation(cash, total);
assert.ok(Math.abs(reconciled - 100) < 0.000001);

console.log("Portfolio workspace quality checks passed.");
