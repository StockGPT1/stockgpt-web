import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const summary = source("lib/notification-summary.ts");
assert.match(summary, /status: "unavailable"; count: null/);
assert.doesNotMatch(summary, /catch\s*\{\s*return 0;/);
assert.match(source("components/AppShell.tsx"), /Notification count unavailable/);

const digest = source("app/api/cron/daily-news-digest/route.ts");
assert.match(digest, /hasActiveSubscription/);
assert.match(digest, /\.range\(/);
assert.doesNotMatch(digest, /\.limit\(100\)/);
assert.match(digest, /Idempotency-Key/);
assert.match(digest, /claim_email_digest_delivery/);
assert.doesNotMatch(digest, /Failed subscriber.*email/);

const activeAuthority = [
  source("app/portfolio/modern/page.tsx"), source("lib/dashboard-portfolio.ts"),
  source("lib/ask-stockgpt-portfolio-context.ts"), source("lib/notifications.ts"),
].join("\n");
assert.doesNotMatch(activeAuthority, /PortfolioCommandCentreRevolut/);
assert.doesNotMatch(source("app/portfolio/modern/page.tsx"), /portfolio-action-engine|portfolio-trim-recommendation/);
assert.doesNotMatch(source("lib/notifications.ts"), /portfolio-action-engine|portfolio-trim-recommendation|recommendation:/);

const research = source("components/TradeSetupCard.tsx") + source("lib/trading-levels.ts");
assert.doesNotMatch(research, /Strong Buy|Hold \/ Watch|AI Recommendation|Suggested action|The AI recommends/i);
assert.match(research, /researchState/);
assert.match(research, /not transaction instructions/);

console.log("Wave 5 customer-language, notification and digest checks passed.");
