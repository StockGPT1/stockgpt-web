import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const canonicalPage = read("app/portfolio/page.tsx");
const modernPage = read("app/portfolio/modern/page.tsx");
const workspace = read("components/PortfolioModernWorkspace.tsx");
const layout = read("app/layout.tsx");
const nextConfig = read("next.config.ts");
const loading = read("app/portfolio/loading.tsx");

// Canonical architecture: /portfolio renders the React workspace directly.
assert.match(canonicalPage, /from\s+["']\.\/modern\/page["']/);
assert.doesNotMatch(nextConfig, /source:\s*["']\/portfolio["']/);
assert.match(modernPage, /<PortfolioModernWorkspace/);
assert.match(modernPage, /redirect\(["']\/login["']\)/);

// Legacy DOM-patching controllers and styles must stay removed.
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
assert.doesNotMatch(workspace, /MutationObserver|innerHTML\s*=|document\.querySelector/);

// Navigation remains information-led; Add and Manage are contextual actions.
assert.match(workspace, /type Section = "overview" \| "holdings" \| "activity"/);
assert.match(workspace, /label: "Overview"/);
assert.match(workspace, /label: "Holdings"/);
assert.match(workspace, /label: "Activity"/);
assert.doesNotMatch(workspace, /SECTION_ITEMS[\s\S]{0,400}label: "Add"/);
assert.doesNotMatch(workspace, /SECTION_ITEMS[\s\S]{0,400}label: "Manage"/);
assert.match(workspace, /setAddOpen\(true\)/);
assert.match(workspace, /setManageOpen\(true\)/);

// URL state and portfolio switching must be durable and deep-linkable.
assert.match(workspace, /searchParams\.get\("section"\)/);
assert.match(workspace, /params\.set\("section", next\.section\)/);
assert.match(workspace, /params\.set\("portfolio", next\.portfolio\)/);
assert.match(modernPage, /params\.section === "holdings" \|\| params\.section === "activity"/);
assert.match(modernPage, /portfolios\.some\(\(portfolio\) => portfolio\.id === params\.portfolio\)/);

// Valuation, allocation and chart data remain grounded in shared portfolio logic.
assert.match(modernPage, /buildPortfolioHealthSummary/);
assert.match(modernPage, /buildPortfolioPageChartResult/);
assert.match(modernPage, /currentAllocationPct:\s*totalValue > 0 \? \(currentValue \/ totalValue\) \* 100 : 0/);
assert.match(modernPage, /allowCurrentSnapshot:\s*enriched\.every/);
assert.match(workspace, /of total portfolio/);
assert.doesNotMatch(workspace, /allocation[^\n]{0,80}Math\.random/);

// The page reserves space for the mobile nav and prevents body overflow.
assert.match(workspace, /overflow-x-hidden/);
assert.match(workspace, /pb-\[calc\(120px\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(workspace, /max-w-\[1480px\]/);
assert.match(loading, /aria-label="Loading portfolio"/);

// Intentional scrollers only: metric strip, opportunities and filter rails.
assert.match(workspace, /snap-x snap-mandatory/);
assert.match(workspace, /overflow-x-auto/);
assert.match(workspace, /\[scrollbar-width:none\]/);

// Sheets, keyboard dismissal, focus states and chart/map alternatives.
assert.match(workspace, /role="dialog"/);
assert.match(workspace, /aria-modal="true"/);
assert.match(workspace, /event\.key === "Escape"/);
assert.match(workspace, /focus-visible:outline/);
assert.match(workspace, /aria-label=\{`\$\{holding\.ticker\}, \$\{holding\.currentAllocationPct\.toFixed\(1\)\}% allocation/);
assert.match(workspace, /Open holding/);

// Core interaction sizes remain at or above the 44px mobile target.
assert.match(workspace, /size-11|size-12/);
assert.match(workspace, /h-12/);

// Honest chart states: do not invent movement when history is incomplete.
assert.match(workspace, /StockGPT only plots confirmed portfolio snapshots/);
assert.match(workspace, /Preparing reliable chart history/);
assert.match(workspace, /Showing cached chart/);
assert.match(workspace, /Chart history unavailable/);

// Simple reconciliation checks protect the intended allocation interpretation.
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
