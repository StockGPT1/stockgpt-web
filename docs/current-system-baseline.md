# StockGPT Current System Baseline

## Purpose

This document records the current application architecture of the live-production-derived StockGPT baseline before broker sync or related refactoring begins.

- Live production source commit: `e36212ed3c98f6218130441c3d20dddc3442f0bc`
- Engineering foundation branch: `codex/broker-sync-foundation`
- Engineering constitution commit at time of mapping: `0e42765c6f47ee338700a5acd8c104026c4950e7`

The foundation branch was created directly from the source commit behind the live website. Newer work from `main` was deliberately not imported. This document separates facts confirmed from repository code from inferences and from runtime or external state that cannot be established from the repository alone.

Labels used where the distinction matters:

- **Confirmed:** directly observed in this branch.
- **Inferred:** strongly indicated by the code, but dependent on runtime state or data.
- **Unknown:** requires external, staging or production inspection.

## Runtime architecture

**Confirmed:** StockGPT is a Next.js 16.2.4 App Router application using React 19.2.4 and TypeScript. `app/layout.tsx` is the root layout and globally mounts `AppShellMode`, `LimitedTimePriceOffer`, `StockAskActionPolish`, Vercel Analytics, Vercel Speed Insights and JSON-LD structured data. It also imports the global authenticated, responsive, modal, dashboard, Ask StockGPT and stock-action stylesheets.

Most page entry points are Server Components. They obtain a cookie-aware Supabase client from `utils/supabase/server.ts`, resolve the user and data on the server, and pass serialised data into explicit client workspaces. Interactive modules use `"use client"` boundaries.

Authenticated pages normally render through the server component `AppShell` in `components/AppShell.tsx`. It reads the user, profile subscription status and cached unread-notification count, then renders shared desktop navigation, mobile header, mobile bottom navigation, ticker tape, global search and command-palette surfaces.

API endpoints are Next.js route handlers under `app/api/`. Most data-bearing pages and routes opt into dynamic rendering. The application uses Next.js `unstable_cache` for selected Yahoo, FX, news and shared portfolio-reference reads. `next.config.ts` defines security headers and redirects; it does not enable Cache Components.

The repository currently uses `middleware.ts` and an exported `middleware` function. It creates a CSP nonce, applies the CSP, redirects StockGPT iOS-shell requests from `/` to `/dashboard`, and refreshes Supabase sessions for selected authenticated path prefixes through `utils/supabase/middleware.ts`. The installed Next.js 16 documentation describes the renamed `proxy.ts` convention, but this branch has not adopted it.

## Authentication and subscriptions

**Confirmed:** Authentication uses Supabase Auth.

- Login: `app/api/auth/login/route.ts`, `POST`
- Signup: `app/api/auth/signup/route.ts`, `POST`
- Forgotten password: `app/api/auth/forgot-password/route.ts`, `POST`
- Auth code exchange: `app/auth/callback/route.ts`, `GET`
- Signout: `app/auth/signout/route.ts`
- Password update UI: `app/update-password/`

Login and signup use database-backed rate limits from `lib/security/rate-limit.ts`. Security audit writes are deferred with Next.js `after()`. Forgotten-password responses are intentionally generic to reduce account enumeration, while the reset callback is hard-coded to `https://stockgpt.pro/update-password`.

Subscription entitlement is stored in `profiles.subscription_status`. `hasActiveSubscription` in `lib/subscription.ts` recognises `basic`, `core`, `premium`, `executive`, `max`, `alpha`, `trialing` and `active`. Entitlement checks are distributed across pages and API handlers rather than enforced by middleware as one central gate.

Stripe integration consists of:

- checkout creation in `app/api/create-checkout-session/route.ts`;
- billing-portal creation in `app/api/create-billing-portal-session/route.ts`;
- signature-verified webhooks in `app/api/stripe-webhook/route.ts`;
- the lazy server client in `lib/stripe.ts`.

The webhook maps Stripe lifecycle events onto profile fields and sends subscription lifecycle mail through `lib/transactional-email.ts`. A `past_due` event preserves current access; cancellation or deletion sets subscription status to `none`.

`profiles` is therefore coupled to application profile data, Stripe customer identity, subscription entitlement, email preferences and preferred display currency.

## Portfolio system

The current source-to-UI flow is:

`portfolio creation/import -> user_portfolios -> portfolio_holdings -> portfolio_transactions/cash -> ranking/news/diagnostic/Yahoo enrichment -> health and action logic -> snapshot/timeline chart -> Portfolio workspace and Dashboard consumers`

The primary page entry point is `app/portfolio/page.tsx`, which re-exports `app/portfolio/modern/page.tsx`. The latter is a Server Component that authenticates the user, loads portfolio/profile/FX/ranking data, resolves an owned active portfolio, fetches holdings and up to 1,000 transactions, enriches the holdings, calculates portfolio health and opportunities, builds chart data, converts the resulting display values and passes them to `PortfolioModernWorkspace` in `components/portfolio-workspace/PortfolioModernWorkspace.tsx`.

### Portfolio creation

**Confirmed:** Portfolio creation and mutation are concentrated in the server actions in `lib/actions/portfolio-management.ts`.

- `parseTrading212Holdings` parses Trading 212 CSV activity into net ticker positions.
- `previewTrading212Csv` and `previewTrading212CsvForNewPortfolio` prepare previews.
- `createPortfolioFromTrading212Csv` creates a new imported portfolio.
- `importTrading212Csv` merges into or replaces an existing portfolio.
- `createManualPortfolio` creates a manually specified portfolio.
- `savePortfolio` stores the generated portfolio-builder result.

Trading 212 support is CSV-only. There is no Trading 212 API connection, OAuth flow, webhook, account model or live sync.

CSV import is restricted to USD and requires holdings to match `stock_rankings`. Ticker variants are normalised, but unmatched instruments are skipped. A CSV with no matched ranked tickers is rejected. Manual portfolio holdings must also match `stock_rankings`.

### Persisted portfolio model

The portfolio-related tables directly referenced by the application are:

- `user_portfolios`
- `portfolio_holdings`
- `portfolio_transactions`
- `portfolio_snapshots`
- `portfolio_page_snapshots`

Supporting portfolio reads reference:

- `profiles`
- `stock_rankings`
- `stock_factor_diagnostics`
- `news_articles`

`user_portfolios` carries portfolio ownership and metadata including name, objective, risk tolerance, time horizon, investment amount, cash balance, deposited basis, currency, timestamps and archive state.

### Holdings

`portfolio_holdings` stores ticker-level positions, shares, entry price, entry rank and score, allocation, purchase/add/review dates, source, notes and stored risk/target levels. The current logical identity is a ticker within a portfolio. Manual entry rejects duplicate tickers, while mutations merge positions by portfolio and ticker.

Important mutation actions include `logExistingHolding`, `buyHoldingWithCash`, `updateHoldingDetails`, `trimHolding`, `removeHolding`, `markReviewed`, `addHolding`, `addHoldingByAmount`, `updateEntryPrice` and `updateShares` in `lib/actions/portfolio-management.ts`.

`app/api/portfolio/holding-trade-levels/route.ts` calculates holding risk and target levels. Its current `GET` handler can persist those calculated values for eligible holdings.

### Transactions and cash

`portfolio_transactions` stores deposits, withdrawals, buys, trims/sells, imports and related cash/basis activity. `recordTransaction` in `lib/actions/portfolio-management.ts` is used by many mutations, but it logs an insert failure rather than propagating failure to the parent operation.

Cash is held on `user_portfolios` as `cash_balance` and `cash_deposited_total`. `addCash` is in `lib/actions/portfolio-management.ts`. `withdrawPortfolioCash` in `lib/actions/portfolio-cash.ts` uses a compare-and-update write and attempts a conditional balance rollback if its transaction insert fails.

`app/api/portfolio/trim-and-reinvest/route.ts` updates the source holding, destination holding, cash and transaction history in separate database operations.

### Enrichment

`enrichHoldings` and `enrichHoldingsAdmin` in `lib/portfolio-alerts.ts` enrich ticker holdings using:

- current `stock_rankings` rows;
- `stock_factor_diagnostics`;
- ticker-linked `news_articles`;
- Yahoo chart/price data and calculated technical levels;
- portfolio risk tolerance and holding-entry context.

The standard user-facing path uses a user-scoped Supabase client. Background cache/snapshot paths can use the service-role client.

### Portfolio intelligence

At least six distinct pieces of code independently produce portfolio status, recommendation or action language:

1. `buildActionAlert`, `deriveRecommendation` and `buildAISummary` in `lib/portfolio-alerts.ts`.
2. `derivePortfolioHoldingAction` in `lib/portfolio-action-engine.ts`.
3. `buildPortfolioTrimRecommendation` in `lib/portfolio-trim-recommendation.ts`.
4. `portfolioHealthLabel` and `buildPortfolioHealthSummary` in `lib/portfolio-health.ts`.
5. `buildPortfolioOpportunities` in `lib/dashboard-portfolio.ts`.
6. Recommendation string matching, urgency sorting and direct action controls in `components/SavedPortfolio.tsx`.

Current vocabularies include health labels such as Strong, Healthy, Needs review and High risk; recommendations such as Strong Hold, Review Urgently, Consider Trimming and Consider Buying More; and action states such as `none`, `review`, `buy_more`, `trim`, `sell` or `exit`. The engineering constitution's canonical `on_track`, `monitor`, `review` and `urgent_review` model is not yet the single shared implementation.

### Historical charting

`buildPortfolioPageChartResult` in `lib/portfolio-page-chart.ts` orchestrates portfolio chart creation. It can use Redis chart data, persisted `portfolio_snapshots`, a current calculated point or a reconstructed transaction-ledger timeline.

`buildPortfolioValueTimeline` in `lib/portfolio-value-timeline.ts` reconstructs historical holdings, cash and basis from holdings and transactions, then obtains ticker history from Yahoo. `lib/portfolio-snapshots.ts` normalises persisted historical/live source boundaries, checks coverage and freshness, and serialises or upserts snapshot points.

Historical display conversion uses the current USD FX rate rather than a historical FX series.

### Dashboard consumers

`getDashboardMainPortfolio` in `lib/dashboard-portfolio.ts` loads the selected/first portfolio, holdings and transactions, then repeats enrichment, health, chart and opportunity calculations for `app/dashboard/page.tsx`. Dashboard therefore consumes the same lower-level libraries but does not consume one already-materialised canonical portfolio assessment object.

### Portfolio caches and snapshots

Current portfolio caching/snapshot locations are:

- `portfolio_snapshots` for persisted time-series points;
- `portfolio_page_snapshots` for precomputed page payloads;
- Redis chart cache in `lib/portfolio-chart-cache.ts`;
- Redis/DB page snapshot helpers in `lib/portfolio-speed-cache.ts`;
- Next.js cached portfolio stock/news reference data in `lib/portfolio-speed-cache.ts`.

`app/api/portfolio-cache/warm/route.ts` writes warmed page snapshots. The current `app/portfolio/modern/page.tsx` does not call the `getPortfolioPageSnapshot*` read functions; it reconstructs enrichment, health and opportunities. Portfolio mutations invalidate page snapshots and usually request path revalidation.

Scheduled snapshot routes are:

- `app/api/portfolio-snapshots/refresh/route.ts`;
- `app/api/portfolio-snapshots/backfill/route.ts`;
- `app/api/portfolio-snapshots/health/route.ts`.

The health route can identify and delete invalid or overlapping snapshot rows and repair current/historical series.

### Current instrument assumptions

**Confirmed:** Portfolio, ranking, news, chart and notification joins use ticker strings as the common instrument identity. There is no provider-neutral instrument ID, exchange code, ISIN identity, broker account ID, provider ID or separate connected-cash model.

**Inferred:** The current model cannot safely distinguish the same ticker held at multiple brokers/accounts. ETFs, UK-listed instruments, unsupported assets and instruments outside `stock_rankings` are rejected, skipped, conflated or left without enrichment. The model cannot preserve a reliable tracked-only unsupported holding as required by the future broker boundary.

Portfolio entry and cash amounts can be stored with GBP, USD or EUR portfolio currency, while the portfolio page treats intermediate portfolio results as USD before converting to the profile's display currency. The intended accounting semantics cannot be established conclusively from the code.

## Market data, rankings and stocks

`stock_rankings` is the central stock universe and supplies ticker, company, sector, score, rank, price and ranking-update fields to Dashboard, Rankings, Stock detail, Search, Portfolio, news intelligence and landing previews.

Main entry points include:

- `app/dashboard/page.tsx`
- `app/rankings/page.tsx`
- `app/stock/[ticker]/page.tsx`
- `app/api/rankings/page/route.ts`
- `app/api/rankings/financial-metrics/route.ts`
- `app/api/top-movers/route.ts`

Yahoo chart and mover access is implemented in `lib/yahoo.ts`, with Next.js caching and an in-process memory cache. Yahoo quote/financial data is also accessed through `lib/yahoo-financials.ts`. Failures generally log and degrade to empty or unavailable chart/mover data.

`refreshMarketSnapshots` in `lib/yahoo.ts` fetches one-day movers and returns attempted/updated counts; it does not write a market-snapshot table. The routes `app/api/market-snapshots/refresh/route.ts` and `refresh-priority/route.ts` therefore operate as scheduled warming/fetching calls despite their names.

`app/api/cron/capture-rank-snapshot/route.ts` separately copies ranking rows into `stock_rank_snapshots` for rank history.

FX is supplied by `lib/fx-rates.ts`, which calls Frankfurter for current USD-to-GBP/EUR/CHF rates. Environment overrides and fixed fallback rates are used when configured or when the provider fails.

**Unknown:** This repository does not contain the process that calculates and publishes the primary `stock_rankings` dataset.

## Search and watchlist

Global search calls `app/api/search/route.ts`. It is rate-limited. Subscriber search uses the authenticated client; anonymous/locked search uses a service-role query but exposes a restricted ticker/company/sector result.

The main watchlist page and server actions use `watchlist`:

- `app/watchlist/page.tsx`
- `lib/actions/watchlist.ts`

Stock detail checks `user_watchlist` in `app/stock/[ticker]/page.tsx`. This is a confirmed table-name inconsistency. `user_watchlist` is not represented in the checked-in migrations.

## Ask StockGPT

The page is `app/ask-stockgpt/page.tsx`, with the client workspace in `components/AskStockGPTWorkspace.tsx` and API handling in `app/api/ask-stockgpt/route.ts`.

The route authenticates the user, checks subscription state, applies a database-backed rate limit, and builds context from rankings, news, the user's portfolio list and the enriched holdings of one focused portfolio. It calls an environment-configurable OpenRouter model chain, preferring streaming and falling back to a complete response.

Conversation messages are stored in `ask_stockgpt_messages`. Messages older than seven days are deleted best-effort. History read, write or cleanup failures are sometimes swallowed so the AI response can continue. Current prompt and portfolio context still include buy-more, trim and sell-style action language.

## News

`app/api/refresh-news/route.ts` is the scheduled ingestion entry point. It fetches Google News RSS for fixed market queries and optionally queries NewsAPI when `NEWS_API_KEY` is available. Articles are deduplicated, assessed by `lib/news-intelligence.ts`, linked to the ranked-stock universe and inserted into `news_articles`.

`app/world-news/page.tsx` renders the subscriber feed. `getCachedWorldNewsFeed` in `lib/world-news-feed.ts` uses a service-role Supabase client and Next.js cache to combine recent articles with up to 500 ranked stocks. News relevance, causal channels and affected-stock inference are deterministic application logic rather than an external AI call.

## Notifications

`getUserNotifications` in `lib/notifications.ts` recomputes notifications on demand from the user's portfolios, holdings, stored trade levels and `enrichHoldings`. Notification events are not stored as durable event rows.

`notification_dismissals` stores dismissal/read keys. `user_notification_summaries` and optional Redis entries store a short-lived unread count through `lib/notification-summary.ts`, allowing `AppShell` to avoid full enrichment on every page. The fast path returns zero on several infrastructure-error paths, so an unavailable summary can look like no unread notifications.

The notification page is `app/notifications/page.tsx`. Full notification generation is synchronous when that page is rendered and can fan out into ranking/news/diagnostic/Yahoo enrichment.

## Email

Resend is called from `lib/transactional-email.ts` and selected API routes for:

- subscription activation, cancellation and payment failure;
- waitlist and affiliate communications;
- support feedback;
- founder data-freshness alerts;
- the weekly news digest.

`app/api/cron/daily-news-digest/route.ts` reads eligible profiles, recent news and top rankings, asks OpenRouter to generate a digest and sends it sequentially through Resend. It selects at most 100 profiles and explicitly requires `subscription_status === "basic"`, unlike the wider shared active-subscription predicate.

## Background jobs and caching

`vercel.json` schedules:

| Job | Schedule |
|---|---|
| Rank snapshot | Daily at 07:55 UTC |
| Data freshness | Daily at 08:00 UTC |
| Weekly digest | Monday at 08:00 UTC |
| News refresh | Daily at 08:15 UTC |
| Market refresh | Hourly |
| Priority market refresh | Every 15 minutes |
| Portfolio cache warm | Every 15 minutes |
| Current portfolio snapshots | Every 5 minutes |
| Portfolio historical backfill | Hourly at minute 22 |
| Portfolio snapshot health/repair | Hourly at minute 42 |

`lib/security/cron.ts` accepts either `Authorization: Bearer <CRON_SECRET>` or a production Vercel cron request identified by Vercel environment, user-agent and schedule headers.

Caching layers include:

- Next.js `unstable_cache` for Yahoo, FX, world news and shared portfolio reference data;
- in-process Yahoo chart and ranking-sector caches;
- optional Upstash Redis REST caching for portfolio charts/page payloads and unread counts;
- Supabase `portfolio_page_snapshots`, `portfolio_snapshots` and `user_notification_summaries`.

Redis failures generally become logged cache misses rather than request failures.

**Inferred:** The two market-refresh cron routes use the cookie/session server client rather than the service-role client. With only the checked-in subscriber RLS policy, an unauthenticated Vercel cron may not be able to read `stock_rankings`. The live policy state is unknown.

## Database and migrations

The timestamped migrations present in `supabase/migrations/` are:

1. `20260602_security_baseline.sql`
2. `20260606_phase1_security_advisor_fixes.sql`
3. `20260619001239_portfolio_snapshot_source_boundaries.sql`
4. `20260619002012_drop_duplicate_portfolio_holdings_index.sql`
5. `20260708165000_add_preferred_currency.sql`
6. `20260709230000_add_portfolio_objective_preference.sql`

Additional SQL files outside the migrations directory are:

- `supabase/portfolio_cash_basis_upgrade.sql`
- `supabase/portfolio_cash_upgrade.sql`
- `supabase/portfolio_entry_trade_level_insert_defaults.sql`
- `supabase/portfolio_entry_trade_levels.sql`
- `supabase/portfolio_snapshots.sql`
- `supabase/remove_portfolio_entry_trade_level_trigger.sql`

The 23 distinct tables observed in application `.from()` calls are:

1. `affiliate_applications`
2. `alpha_waitlist`
3. `ask_stockgpt_messages`
4. `executive_waitlist`
5. `news_articles`
6. `notification_dismissals`
7. `portfolio_holdings`
8. `portfolio_page_snapshots`
9. `portfolio_snapshots`
10. `portfolio_transactions`
11. `premium_waitlist`
12. `pro_waitlist`
13. `profiles`
14. `security_audit_events`
15. `security_rate_limits`
16. `stock_factor_diagnostics`
17. `stock_rank_snapshots`
18. `stock_rankings`
19. `support_feedback`
20. `user_notification_summaries`
21. `user_portfolios`
22. `user_watchlist`
23. `watchlist`

**Confirmed:** The repository cannot reproduce the referenced database schema from its timestamped migrations alone. The security baseline assumes numerous pre-existing tables and creates only the security rate-limit and audit tables. Base definitions are absent for most application tables, and several portfolio changes are loose SQL files rather than committed migrations.

`lib/database.types.ts` is a placeholder with `Tables: Record<string, never>` rather than generated project types. The checked-in migrations do not visibly establish base definitions or RLS coverage for every referenced user-owned table, including `portfolio_transactions`, `portfolio_page_snapshots`, `user_notification_summaries` and `support_feedback`.

## Security boundaries

Supabase access is divided between:

- browser client: `utils/supabase/client.ts`;
- cookie-aware server client: `utils/supabase/server.ts`;
- session-refresh middleware client: `utils/supabase/middleware.ts`;
- backend service-role client: `utils/supabase/admin.ts`.

An additional older direct browser singleton exists in `lib/supabaseClient.ts`.

`middleware.ts` applies nonce-based CSP. `next.config.ts` adds HSTS, frame denial, MIME-sniffing protection, referrer policy and permissions policy headers. The CSP permits required Supabase, Stripe, OpenRouter, Resend and Vercel Live connections.

Security rate limits and audit writes use `security_rate_limits` and `security_audit_events` through the service-role client. Service-role access is also used by cron handlers, public teaser/search reads, waitlist/support endpoints, Stripe webhooks, landing/news caching, portfolio chart/snapshot jobs and selected settings updates. Settings handlers authenticate the cookie user before constraining their admin update to `user.id`.

Portfolio mutations generally verify `user_portfolios.user_id` explicitly or rely on user-scoped RLS. The actual live RLS state is unknown because repository migrations are incomplete.

## Mobile and native shells

`capacitor.config.ts` defines an iOS Capacitor shell that loads `https://stockgpt.pro/dashboard` in WKWebView, appends the user agent suffix `StockGPTApp/1.0`, uses a local `capacitor-fallback` error page and relies on web safe-area handling. `middleware.ts` redirects an iOS-shell request for `/` to `/dashboard`.

The Android configuration under `android/twa/` is a Bubblewrap Trusted Web Activity for `stockgpt.pro`, not a Capacitor Android application. Both native shells therefore depend directly on current web deployment behaviour.

## Scrolling and responsive architecture

`app/globals.css` initially sets `html` and `body` to full height and hidden overflow. The later-imported `app/mobile-overflow.css` allows body vertical overflow, but authenticated routes are still enclosed by `AppShell` in a `100dvh`, overflow-hidden frame.

For authenticated desktop and mobile pages, `.sg-app-content` in `components/AppShell.tsx` is the principal vertical scroll owner. Mobile CSS explicitly states that AppShell owns mobile page scrolling and overrides certain nested full-height workspaces to avoid secondary traps. `MobileAppHeader` is a shrink-zero shell row; `MobileBottomNav` is fixed above the bottom safe area.

Important exceptions are:

- `AskStockGPTWorkspace`, which owns a separate `100dvh` shell and `.sg-ask-scroll` containers;
- the marketing `ScrollLandingClient`, whose `sl-root` main element owns native scrolling;
- authentication pages, whose `AuthScaffold` uses its own `h-dvh overflow-y-auto` main;
- bounded scroll areas inside drawers, dialogs, tables and selected portfolio/notification layouts.

The codebase uses `100vh`, `100dvh`, fixed/sticky positioning and viewport-derived calculations throughout shell, dashboard, landing, Ask, auth and modal layouts. Global responsive behaviour is distributed across many CSS files with broad selectors and `!important` overrides.

## Current motion/DOM manipulation

No Framer Motion, GSAP, React Spring or equivalent animation dependency is installed. Current motion uses CSS transitions/keyframes plus custom client-side scroll/measurement logic.

MutationObservers exist in components including:

- `LimitedTimePriceOffer`
- `RankingsFinancialWhyPatch`
- `RankingsWhyMetricsPatch`
- `PortfolioHoldingClickPatch`
- `StockGPTSelect`
- `StockAskActionPolish`

IntersectionObservers exist in `MobileMarketMovers`, `PortfolioModernWorkspace` and marketing reveal components. ResizeObservers exist in custom legal/affiliate scrollbars, landing measurements and portfolio holding visuals.

`AppChromeProvider` listens to `visualViewport.resize` and focus changes to infer mobile keyboard state. The immersive marketing landing uses native container scrolling, passive scroll listeners, ResizeObserver measurement, requestAnimationFrame interpolation and transforms. It does not intercept wheel/touch events with `preventDefault`.

`prefers-reduced-motion` handling exists in global, landing and modal styles. Current stable scroll/section surfaces include `.sg-app-content` and the portfolio stage/section anchors, but this baseline does not define a future motion design.

## CI/build/deployment architecture

`package.json` defines:

- `npm run dev`
- `npm run build`, which runs `npm run test:portfolio` followed by `next build`
- `npm run lint`
- `npm run lint:portfolio`
- `npm run test:portfolio`
- two Supabase type-generation commands that overwrite `lib/database.types.ts`

Portfolio checks use Node assertions/source-contract tests plus scoped ESLint. No general `npm test` script or general-purpose unit-test framework is present.

There are 21 GitHub workflows. `build-check.yml` uses Node 22 and runs `npm ci` plus the production build. `build-android-aab.yml` uses Node 20 and Java 17 to create a Bubblewrap Android bundle. No `engines` or `packageManager` field pins local runtime versions.

Nineteen workflows have `contents: write`, run mechanical patch scripts, commit application changes and push them. Many also trigger automatically when their corresponding patch script changes. Their current path filters do not match `docs/**`.

`vercel.json` configures scheduled routes but no build-command override. The README tells developers to copy `.env.example`, but that file is absent. A fresh build needs Supabase and integration environment variables, while the build workflow does not declare them.

## External services referenced in code

Confirmed external services and platforms are:

- Supabase: Auth, Postgres, RLS and service-role operations.
- Stripe: Checkout, billing portal and subscription webhooks.
- Vercel: hosting assumptions, cron, Analytics, Speed Insights and Vercel Live CSP.
- OpenRouter: Ask StockGPT and weekly digest generation.
- Resend: transactional, support, waitlist, affiliate, digest and alert email.
- Yahoo Finance: charts, quotes, prices, movers and technical-level input.
- Google News RSS: news ingestion.
- NewsAPI: optional news ingestion.
- Frankfurter: current USD FX rates.
- Upstash Redis REST: optional caching.
- Financial Modeling Prep CDN: stock-logo images.
- Google Fonts: affiliate-page font loading.
- Capacitor/iOS and Bubblewrap/TWA: native wrappers.

No SnapTrade, direct Trading 212 API, eToro API, broker OAuth, broker webhook, broker account sync or trading service is implemented in this branch. No PostHog, Sentry, Segment or Mixpanel integration was found.

## Major architectural couplings

1. `stock_rankings` is both the research universe and the effective portfolio instrument master.
2. Ticker strings join rankings, holdings, Yahoo, news, diagnostics, charts, recommendations and notifications.
3. `profiles.subscription_status` is the entitlement source across most protected surfaces.
4. Portfolio page rendering is coupled to rankings, diagnostics, news and Yahoo enrichment.
5. Portfolio charts are coupled to transactions, snapshots, Redis, Yahoo history and current holdings/cash.
6. Notifications recompute portfolio intelligence rather than consume durable notification events.
7. Dashboard and Portfolio independently invoke much of the same enrichment, health, chart and opportunity stack.
8. Global CSS and DOM-patch components affect routes outside explicit component ownership.
9. Native applications load the live web product, so web deployment behaviour immediately affects native shells.
10. Service-role access compensates for subscriber-locked data and several background/public-preview paths.

## Confirmed correctness/reliability issues

This list records observed current-state issues; it does not propose fixes.

1. The checked-in migrations cannot reproduce the referenced schema.
2. `lib/database.types.ts` contains placeholder rather than generated Supabase types.
3. `watchlist` and `user_watchlist` are used inconsistently.
4. Multiple portfolio recommendation/status engines produce conflicting vocabularies and direct action language.
5. Several portfolio mutations are non-atomic across holdings, cash and transaction records.
6. `recordTransaction` can fail while its parent portfolio operation reports success.
7. CSV replace mode deletes existing holdings before replacement insertion succeeds.
8. Trim/reinvest mutates source holdings, destination holdings, cash and transactions without a database transaction.
9. The holding trade-level `GET` route can mutate holdings.
10. Current FX is applied to historical display data and portfolio currency semantics are ambiguous.
11. The warmed portfolio-page snapshot cache is not consumed by the current portfolio page read path.
12. Ticker-only identity cannot represent broker/provider/account/instrument identity.
13. Unsupported assets are rejected or dropped instead of retained as tracked-only holdings.
14. Market-snapshot refresh routes do not persist market snapshots.
15. Market cron routes use a session client even though checked-in ranking RLS is subscriber-only.
16. Stripe webhook processing has no checked-in processed-event idempotency table and does not explicitly check every profile-write result.
17. Notification summary failures can become a displayed unread count of zero.
18. Digest eligibility/cap logic differs from the shared active-entitlement logic.
19. README references a missing `.env.example`.
20. The Next.js 16 repository still uses the legacy `middleware.ts` naming convention.
21. Nineteen GitHub workflows can rewrite, commit and push repository files.

## Unknown external/runtime state

The repository alone cannot establish:

- the actual production Supabase schema, RLS policies, indexes, functions, triggers, data or migration history;
- whether loose SQL files were applied manually;
- deployed environment variables or which optional integrations are enabled;
- Stripe product, price, webhook-registration or delivery state;
- actual OpenRouter models, quotas or provider availability;
- Redis availability and cache hit behaviour;
- the external producer of `stock_rankings`;
- whether current Vercel cron requests satisfy live database policies;
- production timeout, performance, Yahoo-throttling or API-cost behaviour;
- whether this branch builds in a genuinely fresh environment;
- native signing, provisioning or store-release state;
- live brokerage behaviour, because no brokerage integration exists here.

## Baseline invariants

- This baseline originates from live source commit `e36212ed3c98f6218130441c3d20dddc3442f0bc` plus the engineering constitution commit recorded above.
- Newer `main` changes are not part of this baseline.
- Current brokerage capability is absent; future brokerage capability must remain read-only.
- Current data and runtime behaviour must not be described as production-confirmed unless independently verified.
- Known-good portfolio state, ownership boundaries and financial-data provenance must be preserved during future work.
- Target portfolio status vocabulary is `On track / Monitor / Review / Urgent review`, but current code has not yet converged on it.
- Native browser scrolling remains the source of truth for future motion work.
- Schema changes must become reproducible migrations with synchronised generated types.
- Changes to this baseline require explicit staged implementation, review and verification.

This document describes the current baseline, not the target architecture. Target-state decisions belong in separate architecture documents.
