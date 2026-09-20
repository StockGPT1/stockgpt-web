import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260920103104_integrate_connected_broker_portfolios.sql");
const start = read("app/api/broker/connections/start/route.ts");
const callback = read("app/portfolio/connections/return/route.ts");
const page = read("app/portfolio/connections/page.tsx");
const service = read("lib/brokerage/providers/snaptrade/service.ts");
const discovery = read("lib/brokerage/connection-service.ts");
const connected = read("lib/connected-portfolio-intelligence.ts");
const connectedMap = read("lib/connected-portfolio-intelligence-map.ts");
const portfolio = read("app/portfolio/modern/page.tsx");
const dashboard = read("lib/dashboard-portfolio.ts");
const ask = read("app/api/ask-stockgpt/route.ts");
const notifications = read("lib/notifications.ts");

assert.match(migration, /management_source public\.portfolio_management_source not null default 'manual'/u);
assert.match(migration, /unique index user_portfolios_connected_account_key/u);
assert.match(migration, /guard_connected_portfolio_(holdings|transactions)/u);
assert.match(migration, /security definer[\s\S]*?set search_path = ''/u);
assert.match(migration, /auth\.uid\(\)/u);
assert.match(service, /connectionType: "read"/u);
assert.match(service, /customRedirect: input\.customRedirect/u);
assert(!/userSecret/u.test(start), "Connection route exposes provider userSecret");
assert(!/searchParams\.get|get\("connection|externalConnectionId\s*=/u.test(callback), "Callback trusts client-supplied connection identity");
assert.match(discovery, /brokerage\?\.id/u);
assert.match(discovery, /brokerage_institution_aliases/u);
assert(!/brokerage\?\.(?:name|display_name).*eq\(/u.test(discovery), "Institution is matched by name");
assert.match(page, /broker_connections/u);
assert(!/SnapTrade|listBrokerageAuthorizations|createReadOnlySnapTradePortalLink/u.test(page), "Onboarding render calls provider");
assert.match(connected, /broker_positions/u);
assert.match(connected, /broker_cash_balances/u);
assert(!/portfolio_holdings|portfolio_transactions/u.test(connected), "Connected adapter reads manual financial truth");
assert.match(connectedMap, /currentValue: valuationComplete \? currentValue : null/u);
assert.match(connectedMap, /cashValueUsd: cashComplete[^\n]+: null/u);
assert.match(portfolio, /management_source === "connected"/u);
assert.match(dashboard, /management_source === "connected"/u);
assert.match(ask, /management_source === "connected"/u);
assert.match(notifications, /management_source === "connected"/u);
for (const source of [portfolio, dashboard, ask, notifications]) {
  assert(!/SnapTrade|listBrokerageAuthorizations|fetchSnapTrade/u.test(source), "Ordinary canonical read imports provider API");
}
assert(!/buy|sell|trim|add.more|reinvest/iu.test(read("components/ConnectedPortfolioWorkspace.tsx")), "Connected Portfolio presents transaction direction");
assert.match(read("lib/portfolio-performance-availability.ts"), /connected_source_history_unavailable/u);
assert.match(read("lib/brokerage/capability.ts"), /=== "true"/u);
assert.match(start, /hasActiveSubscription/u);
assert(!/connectionType:\s*"trade"/u.test(service));

console.log("Wave 3 connection, onboarding, projection and provider-call source contracts passed.");
