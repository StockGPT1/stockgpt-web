import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acquireBlockingOverlayScrollLock } from "../lib/overlay-scroll-lock";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const body = { style: { overflow: "auto", overscrollBehavior: "contain" } };
const content = { style: { overflow: "scroll", overscrollBehavior: "auto" } };
const root = { dataset: {} as Record<string, string> };
const fakeDocument = {
  body,
  documentElement: root,
  querySelector: () => content,
} as unknown as Document;

const releaseFirst = acquireBlockingOverlayScrollLock(fakeDocument);
const releaseSecond = acquireBlockingOverlayScrollLock(fakeDocument);
assert.equal(body.style.overflow, "hidden");
assert.equal(content.style.overflow, "hidden");
assert.equal(root.dataset.sgOverlayLockCount, "2");
releaseFirst();
assert.equal(body.style.overflow, "hidden", "nested overlay released the shared lock early");
releaseSecond();
assert.equal(body.style.overflow, "auto");
assert.equal(content.style.overflow, "scroll");
assert.equal(root.dataset.sgOverlayLockCount, undefined);
releaseSecond();

const activeOverlays = [
  "components/GlobalSearchOverlay.tsx", "components/MobileNav.tsx", "components/MobileSheet.tsx",
  "components/AddToPortfolioButton.tsx", "components/ManageHoldingDrawer.tsx",
  "components/DashboardChangeModal.tsx", "components/MobileMarketMovers.tsx",
  "components/StockRelatedNews.tsx", "components/TradeSetupCard.tsx",
  "components/Trading212CsvImport.tsx", "components/portfolio-workspace/PortfolioSheet.tsx",
].map(source).join("\n");
assert.doesNotMatch(activeOverlays, /document\.body\.style\.overflow/);
assert.match(activeOverlays, /useBlockingOverlay/);

const globals = source("app/globals.css");
const responsive = source("app/mobile-overflow.css");
assert.doesNotMatch(globals, /body\s*\{[^}]*overflow:\s*hidden/s);
assert.match(globals, /prefers-reduced-motion:\s*reduce/);
assert.match(responsive, /100svh/);
assert.match(responsive, /100dvh/);
assert.match(responsive, /safe-area-inset-bottom/);
assert.match(source("components/MobileBottomNav.tsx"), /safe-area-inset-bottom/);
assert.doesNotMatch(source("components/AppShell.tsx"), /h-screen/);

console.log("Wave 5 motion and responsive checks passed.");
