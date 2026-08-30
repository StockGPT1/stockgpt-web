# StockGPT Engineering Implementation Ledger

## Baseline

Live production source commit:
`e36212ed3c98f6218130441c3d20dddc3442f0bc`

Foundation branch:
`codex/broker-sync-foundation`

Engineering constitution:
`0e42765c6f47ee338700a5acd8c104026c4950e7`

## Implementation stages

| # | Stage | Status | PR/Commit | Notes |
|---|---|---|---|---|
| 01 | Engineering harness and staging setup | COMPLETE | `codex/02b2-environment-ci-hardening` | Constitution and live-derived baseline documented; persistent Vercel staging retained; local-Supabase/synthetic-data topology recorded, with database readiness deferred to Stage 03. |
| 02 | Restore green build/CI foundation | COMPLETE | `0ea2557` + `codex/02b2-environment-ci-hardening` | Node 24 aligned across web runtime/types/CI; explicit `tsx` reliability runner; full lint, typegen, standalone TypeScript, portfolio tests and production build enforced; 19 self-mutating workflows removed; environment contract restored. |
| 03 | Reconcile Supabase schema and generated types | COMPLETE | `48de3c0` + `e3d4e72` + `f699821` + `Formalize Supabase migration release workflow` | The 26-version canonical history, synthetic local Auth/RLS fixtures, generated types, typed clients, schema-reference repairs and approval-gated forward-migration runbook are complete and verified. |
| 04 | Canonical portfolio intelligence engine | COMPLETE | `98dd988` + `fa1a1ad` + `e0f0851` + `6426012` + `27a2a83` + `Close canonical portfolio intelligence migration` | Portfolio, Dashboard, Ask and Notifications share one factual adapter, canonical engine and status vocabulary; active competing customer assessment paths are removed or explicitly non-authoritative. |
| 05 | Portfolio correctness and persistence cleanup | IN PROGRESS | `05A design` + `05B ownership foundation` + `05C append-only ledger` + `05D atomic cash` + `05E atomic holdings` | Stage 05A design, 05B database ownership, 05C append-only ledger/occurred-at semantics, 05D atomic cash/net-contribution mutation and 05E atomic holding mutations are complete; creation/import/currency/direct-write/cache slices remain. |
| 06 | Market-data and instrument infrastructure cleanup | NOT STARTED | | |
| 07 | Provider-neutral broker data model | NOT STARTED | | |
| 08 | Broker secret/security architecture | NOT STARTED | | |
| 09 | SnapTrade sandbox integration | NOT STARTED | | |
| 10 | Broker sync state machine and reconciliation | NOT STARTED | | |
| 11 | Broker connection UX | NOT STARTED | | |
| 12 | Post-connection onboarding | NOT STARTED | | |
| 13 | Connected accounts → Portfolio projection | NOT STARTED | | |
| 14 | Connected portfolio historical charting | NOT STARTED | | |
| 15 | Portfolio ownership context across StockGPT | NOT STARTED | | |
| 16 | StockGPT motion system | NOT STARTED | | |
| 17 | Responsive/container architecture cleanup | NOT STARTED | | |
| 18 | Security/privacy/account hardening | NOT STARTED | | |
| 19 | Remaining customer-facing audit cleanup | NOT STARTED | | |
| 20 | Full automated test suite | NOT STARTED | | |
| 21 | Performance/load testing | NOT STARTED | | |
| 22 | First real broker pilot | NOT STARTED | | |
| 23 | Second-broker abstraction proof | NOT STARTED | | |
| 24 | Compliance/legal launch review | NOT STARTED | | |
| 25 | Controlled production rollout | NOT STARTED | | |
| 26 | Post-launch provider strategy | NOT STARTED | | |

## Current development topology

- `stockgpt-staging` is the persistent Vercel web staging project.
- `StockGPT` is the single cloud Supabase project and is production-only.
- No second paid Supabase project or Supabase branch is maintained.
- Stage 03 established production schema reconciliation, reproducible migrations, generated database types, local Supabase bring-up and synthetic development data.
- Staging must not receive broad production-database write credentials or the production service-role credential.
- Production Supabase inspection is read-only unless a separately reviewed and explicitly approved migration operation is authorised.

### Stage 03 closeout state

- Stage 03A established that repository migrations cannot reproduce the verified production schema or migration history.
- Step 03B-1 pins the project-local Supabase CLI and commits local-only PostgreSQL 17 configuration without linking to production.
- Production extension metadata records `pg_trgm` 1.6 in `public`, `pgcrypto` 1.3 and `uuid-ossp` 1.1 in `extensions`, `pg_stat_statements` 1.11 in `extensions`, `supabase_vault` 0.3.1 in `vault`, and `plpgsql` 1.0 in `pg_catalog`.
- Step 03B-3A aligns the active local history with all 26 verified production timestamps. The first 25 files are explicit no-op history markers because their original SQL is unavailable; the final `20260709230153` migration is a clearly labelled squashed current-state baseline. Archived pre-canonical SQL is historical evidence and is not replayed.
- Two clean local resets on PostgreSQL 17.6 reproduced the exact 26-table set, table ownership/RLS state, columns, defaults, identity/sequence semantics, constraints, indexes, policies, functions, triggers, grants, comment, empty Storage bucket set and empty application Realtime publication membership.
- The local extension versions and placements matched the supplied production metadata with no required platform exception. The existing `pg_trgm`-in-`public` advisor warning remains later security-cleanup work, not permission to mutate production during reconciliation.
- `public.watchlist` is canonical and `public.user_watchlist` is absent. The application reference to `user_watchlist` remains pending, as do the `stock_rankings.factor_coverage` and `stock_rankings.data_confidence` application references; those nonexistent objects were not invented in the baseline.
- Step 03B-3B adds three deterministic `.invalid` local Auth users, minimal market/reference data, an active-user portfolio, a free-user no-portfolio empty state and a separate isolation-user fixture. Two clean seeded resets reproduced the fixed identifiers and counts; genuine local password sessions proved subscriber gating and bidirectional portfolio/watchlist ownership isolation.
- Step 03B-3C replaces the placeholder with unmodified types generated from local Supabase, applies `Database` at browser/server/middleware/admin/legacy client boundaries, and adds a local-only drift check plus compile-time schema assertions.
- The stock page now uses canonical `watchlist`. Ranking factor coverage comes from `stock_factor_diagnostics`; unsupported `stock_rankings.factor_coverage` and `stock_rankings.data_confidence` assumptions were removed without inventing a confidence formula.
- Typed integration also exposed and resolved three local contract issues: nullable ranking tickers are filtered before snapshot insertion, portfolio page snapshots are normalised to database JSON, and security audit metadata uses the generated JSON type. Local reset/RLS, TypeScript, portfolio tests, tracked-source lint and production build pass.
- The controlled future production-migration workflow is documented in `docs/runbooks/supabase-migration-release.md`. Production releases are manual, dry-run-first and explicitly approval-gated; production seed/reset and casual migration-history repair are forbidden.
- `supabase/migration-baseline-manifest.json` and `npm run db:migrations:check` protect all 26 historical filenames and normalized content hashes, enforce forward timestamps after `20260709230153`, reject unapproved no-op migrations and scan executable repository automation for dangerous remote operations. Focused negative tests run locally and in the normal web build workflow.

### Stage 03 acceptance audit

- The active migration path reproduces the canonical 26-table schema from a clean local reset; archived incomplete SQL remains outside that path.
- All 26 verified production migration versions are represented, with immutable alignment markers and one clearly labelled squashed current-state baseline.
- Deterministic synthetic seed, local Auth sign-in, subscriber gating and bidirectional owner-scoped RLS isolation pass without production data or credentials.
- Real local-generated TypeScript database types are committed, drift-checked and applied at every Supabase client-construction boundary.
- Runtime code uses canonical `watchlist`; nonexistent `stock_rankings` columns were removed without padding the schema, and factor coverage uses diagnostics.
- TypeScript, database contracts, portfolio tests, tracked-source lint and production build pass.
- Future migration release is forward-only, reviewable, dry-run-first and explicitly approved; historical mutation and unsafe executable automation are checked automatically.
- Production remained untouched throughout Stage 03.

### Stage 04 progress

- Stage 04A mapped the conflicting portfolio alert, action, health, trimming, opportunity, notification and AI-context producers before selecting a canonical boundary.
- Step 04B adds the unused pure V1 portfolio-intelligence package with one shared `on_track` / `monitor` / `review` / `urgent_review` vocabulary, structured reason evidence, explicit per-source freshness and deterministic ordering.
- V1 derives concentration from total portfolio value including cash and does not treat legacy `portfolio_holdings.allocation_pct` as a user target. Incomplete valuation blocks concentration assessment.
- P&L alone cannot affect status. The legacy health score remains separate, and transaction-oriented recommendations are excluded from the canonical contract. `urgent_review` requires independent review-level corroboration.
- Step 04C adds a typed current-system factual adapter outside the pure engine. It maps owned local portfolio, holding, ranking and diagnostic rows, derives valuation facts without zero-filling missing prices, counts the factual ranked universe and preserves source-specific timestamps. Non-USD stored portfolio values are withheld from canonical valuation until the legacy currency-basis ambiguity is resolved rather than mixing them with USD ranking prices.
- The 04C adapter was proven through password-authenticated synthetic local sessions, including deterministic repeated loads, subscriber/RLS fixtures, cross-user portfolio denial and a no-write before/after check. Legacy alerts, recommendations, health outputs and trade-level calculations are not canonical inputs.
- Current stored news does not provide the canonical `low` / `medium` / `high` event severity contract. Events remain empty with the explicit adapter limitation `canonical_event_severity_source_unmapped`; no legacy alert severity is laundered into V1.
- Step 04D migrates the Portfolio stage, pulse, review count, holding labels, status filters, attention sort and exposure emphasis to one server-computed canonical presentation model. The page reuses its owned portfolio/holding and raw ranking reads, adds held-only diagnostics plus an exact ranked-universe count, and assesses coherent USD facts before display-currency conversion.
- Option A is approved for the Portfolio migration: canonical status temporarily excludes news/event severity. The internal `canonical_event_severity_source_unmapped` limitation remains regression-tested, and customer wording refers only to currently covered portfolio data.
- The 0–100 legacy health score remains a separate descriptive metric and no longer supplies the Portfolio status label or tone. For unresolved non-USD storage basis, the surface shows the separate neutral availability state `Analysis limited` rather than a canonical or legacy status; the underlying currency contract remains Stage 05/14 work.
- Step 04E removes the active Portfolio workspace's trim/action recommendation dependencies. The holding drawer now presents canonical structured reasons beside neutral user-initiated record controls, uses stored entry/risk/target references only, and no longer calls the write-on-read holding-trade-level route. That route remains unchanged for Stage 05 ownership.
- Transaction-oriented Portfolio opportunities are removed pending a future non-transactional research model. Portfolio Activity now represents persisted transaction history only, while the analysis sheet uses canonical status/reasons and keeps the legacy 0–100 health number as a separate descriptive metric.
- Step 04F migrates Dashboard to the same current-schema factual adapter, canonical engine and presentation model as Portfolio. One request-level `asOf`, held-only ranking/diagnostic facts and an exact ranked-universe count now produce parity in status, reasons, counts, attention order and non-USD `Analysis limited` availability.
- Dashboard legacy health remains a separate numeric metric, while active legacy alert-label status and personalised portfolio-fit opportunities are removed. Mobile now presents Portfolio and Current signals panels; desktop uses a neutral rankings research link. Subscription locks remain in place.
- Step 04G migrates Ask StockGPT's focused portfolio context to the same factual adapter, canonical engine and presentation semantics as Portfolio and Dashboard. The prompt receives canonical status, reason evidence, attention ordering and honest valuation coverage; legacy recommendations, action/event alerts, generated action plans and target-allocation interpretations no longer enter the portfolio context.
- Ask keeps recent news as separate research context and explicitly states that canonical event severity remains unmapped under approved Option A. Personalized transaction questions are answered through evidence and investigation trade-offs rather than StockGPT transaction decisions, while general educational explanations remain available.
- Step 04H makes Notifications a canonical attention inbox. One owner-scoped bulk fact load and one request-level `asOf` feed the existing adapter and engine; only holding-level `review` and `urgent_review` assessments create current prompts. `monitor` and `on_track` remain visible on Portfolio/Dashboard without inbox noise.
- Notification acknowledgements now use deterministic portfolio/instrument/status/reason/week keys and are presented as Read/Unread rather than resolved. Saved target references remain separate factual, neutral prompts; saved-risk breaches are represented only by the canonical reason. Durable notification event history and summary failure hardening remain Stage 18/19 work.
- Canonical event severity remains intentionally unmapped under approved Option A. Notifications do not use legacy news severity or article counts, and non-USD portfolios with an unresolved currency basis do not emit withheld canonical Review/Urgent conclusions.
- The cache warmer's legacy enriched/health page snapshot is not read by Portfolio, Dashboard, Ask or Notifications as canonical status. It is non-authoritative and remains Stage 05 ownership for reconciliation or retirement.
- The legacy alert/action/trim/opportunity implementations remain only as separate numeric-health plumbing, inactive/deferred code or non-canonical cache work. They are not authoritative for active Portfolio, Dashboard, Ask or Notifications assessment and may be removed in Stage 19 or the relevant owning cleanup stage.

### Stage 04 acceptance audit

- The pure deterministic engine retains one `on_track` / `monitor` / `review` / `urgent_review` vocabulary, approved thresholds, structured reason evidence and source-specific freshness.
- Portfolio, Dashboard, Ask and Notifications all call the current-schema factual adapter and canonical engine; parity/source contracts prevent customer surfaces from introducing a second status derivation.
- P&L and the separate legacy 0–100 health metric do not create canonical status. Active customer portfolio-assessment paths do not emit buy/sell/trim/add-more/reinvestment recommendations.
- Canonical news/event severity remains honestly unavailable, and the internal `canonical_event_severity_source_unmapped` limitation remains regression-tested.
- Non-USD unresolved currency basis remains the separate `Analysis limited` availability state and cannot create misleading canonical inbox prompts.
- Notification generation is owner-scoped, canonical reason-driven and free of legacy alert/action/trim imports. Notification read state acknowledges a current prompt without claiming that its condition resolved.
- Legacy warmed page snapshots cannot override canonical status and are explicitly assigned to Stage 05. Durable notification history and summary/cache failure semantics are explicitly assigned to Stage 18/19.
- Canonical engine, factual adapter, Portfolio, Dashboard, Ask, Notifications, full Stage 04 source contract, aggregate portfolio regression, TypeScript, lint and production build gates pass without production access.
- Stage 04 is complete. Stage 05 is the next major stage.

### Pre-Stage-05 entitlement hardening

- The Stage 05A portfolio-correctness design is complete; portfolio accounting and persistence implementation has not started. Stage 05B is the next implementation task.
- The intervening P0 profile-permission patch makes `subscription_status` and `stripe_customer_id` trusted-server-owned at the database boundary. Owner-row RLS remains in force, while PostgreSQL column privileges limit authenticated profile updates to the explicit user-editable profile and preference fields used by the product.
- A clean local reset plus genuine authenticated-session tests prove owner reads and approved edits, cross-user isolation, rejected billing-field writes, rejected paid-profile insertion and retained trusted service-role billing updates.

### Stage 05 progress

- Stage 05A design is complete. Step 05B establishes `user_portfolios (id, user_id)` as the relational parent/owner key and binds the redundant `(portfolio_id, user_id)` pairs on `portfolio_transactions` and `portfolio_snapshots` to it.
- Both new child ownership foreign keys are intentionally `NOT VALID`: new and updated rows are constrained immediately, while unknown historical production rows cannot make the initial migration fail. No legacy row is silently changed; later validation requires explicit reconciliation and release review.
- Transaction and snapshot RLS now requires both the row `user_id` and the referenced Portfolio owner to equal `auth.uid()` for every currently permitted client operation. Hostile authenticated sessions prove cross-owner inserts/updates and mismatched redundant owners fail without changing either owner's data.
- Existing direct authenticated Portfolio, holding and snapshot table privileges deliberately remain until Stage 05I because the current product has not yet migrated to narrow mutation RPCs. Transaction INSERT remains temporarily available through an explicit column allowlist, but normal authenticated transaction UPDATE/DELETE is prohibited and `created_at` cannot be supplied by that direct client path.
- Future financial RPCs must authenticate with `auth.uid()`, select and lock the exact owned Portfolio/relevant rows, validate the requested operation, atomically mutate financial facts and ledger entries in one database transaction, return a deterministic result, and defer cache/revalidation work until after commit. No speculative mutation helper was added in 05B.
- Step 05C makes `portfolio_transactions` append-only for normal authenticated access and adds nullable `occurred_at` with a future `now()` default. `occurred_at` means event time; `created_at` remains the StockGPT recorded/change timestamp. Unknown legacy occurrence timing is left null rather than fabricated, while deterministic synthetic fixtures record their known event times explicitly.
- Portfolio Activity orders by `occurred_at` with `created_at` as the honest legacy fallback and preserves deterministic recorded-time/ID tie-breaking. Cache and input-change detection deliberately continues to use `created_at`, so recording an old event today still invalidates derived state today.
- Corrections are appended as new ledger rows rather than rewriting or deleting prior financial truth. Capture-style `import` and `log_existing` writes explicitly preserve unknown occurrence time; no 05D cash or 05E holding accounting semantics were pulled forward.
- Step 05D defines `cash_balance` as available uninvested cash and the existing `cash_deposited_total` column as net contributed capital. Deposits increase both values; withdrawals reduce both values; withdrawal cannot make cash negative, while net contributions may be negative. Buys and sales do not alter contribution, and the database-column rename remains deferred.
- Active manual deposit/withdrawal persistence now requires one exact Portfolio ID and calls the narrow `mutate_portfolio_cash` RPC. The database verifies `auth.uid()`, selects the active owned USD Portfolio, locks its row, validates and rounds the positive amount to two decimals, updates cash/net contribution, and appends exactly one trusted-timestamp ledger row in the same transaction.
- Ambiguous non-USD Portfolio cash is rejected without conversion pending 05H. The RPC does not mutate `investment_amount`, holdings or preferences. Cache invalidation, current-snapshot refresh and route revalidation happen only after commit as best-effort derived work and cannot turn a committed cash mutation into a reported financial failure.
- Real local authenticated tests prove exact-owner isolation, missing-ID no-fallback behavior, negative net contribution, no overspend, two concurrent deposits without lost updates, competing withdrawals with exactly one success, and automatic rollback when a test-only ledger trigger forces insertion failure.
- Step 05E moves active cash-funded buys, externally funded additions, partial/full sales, holding-fact corrections and remove-from-tracking into five narrow exact-ID `SECURITY DEFINER` RPCs. Each authenticates with `auth.uid()`, locks the exact active owned USD Portfolio before the relevant holding, and atomically owns its permitted holding/cash/contribution/realised-P&L/append-only-ledger effects.
- Cash-funded buys reduce cash without changing net contribution and merge average cost by weighted basis. External additions leave cash unchanged, increase net contribution by external cost basis and preserve unknown `occurred_at`; sales credit cash, leave contribution unchanged and record realised P&L from stored average cost. Corrections and remove-from-tracking are neutral adjustments, never disguised trades, and zero-share correction is rejected.
- The holding RPCs fail closed for unresolved non-USD storage, never mutate `investment_amount`, never accept user identity/ledger type/timestamps/P&L from callers, and serialize concurrent buys/additions/sales with row locks. Local authenticated tests prove weighted merges, gain/loss/full-sale accounting, insufficient-cash and oversell races, cross-user isolation, append-only ledger retention, and automatic rollback on forced ledger failure.
- Active holding actions require an exact Portfolio ID and no longer use split direct writes or `recalculatePortfolioTotals`; post-commit snapshot/cache/revalidation work is best-effort derived work. The unreferenced non-atomic trim-and-reinvest route is retired with HTTP 410. Market-data rank/score enrichment remains non-authoritative to mutation success.
- Direct authenticated financial-table privileges required by remaining creation/CSV paths deliberately remain until 05I; active cash and holding paths no longer depend on them. No 05F creation, 05G CSV, 05H currency, 05I global direct-write retirement or 05J cache reconciliation semantics were pulled forward.
- Stage 05F Portfolio creation behavior is the next slice. CSV, full currency reconciliation, direct-write retirement and cache work remain in their approved 05G–05J slices.

## Global release gates

Every implementation stage must pass:

1. Code / migration complete
2. Relevant automated checks pass
3. Preview/staging verification complete where applicable
4. Diff reviewed for scope and security
5. Explicit merge approval

## Standing rules

- No direct production experimentation.
- No direct commits to `main`.
- Do not import newer `main` commits into the foundation branch without explicit approval.
- One stage should not silently absorb unrelated refactors.
- Every known audit issue must have an owner stage.
- Meaningful bug fixes receive regression tests where practical.
- External/broker failures must preserve last-known-good user data.
- Broker capability remains read-only.
- Portfolio status vocabulary remains `On track / Monitor / Review / Urgent review`.
- Motion must preserve native scrolling and responsive correctness.

## Known baseline issue ownership

| Baseline issue | Intended stage | Ownership note |
|---|---|---|
| Schema and migration history cannot reproduce the referenced database | Stage 03 | Resolved: canonical local reproduction, synthetic seed, generated types, application-reference alignment and controlled future release workflow are complete. |
| Placeholder Supabase generated types | Stage 03 | Resolved from the canonical local schema with a repeatable local drift check. |
| `watchlist` / `user_watchlist` mismatch | Stage 03 | Resolved in runtime code: all application queries use canonical `watchlist`; compile/source contracts guard against regression. |
| Conflicting portfolio recommendation/status engines | Stage 04 | Resolved for active Portfolio, Dashboard, Ask and Notifications paths through one factual adapter, canonical engine and vocabulary. Inactive legacy cleanup remains Stage 19/owning-stage work. |
| Non-atomic portfolio writes and swallowed transaction-record failures | Stage 05 | Make persistence outcomes coherent and observable. |
| Unsafe CSV replacement behaviour | Stage 05 | Preserve the prior portfolio unless replacement succeeds as a complete operation. |
| Trim/reinvest non-atomicity | Stage 05 | Keep holdings, cash and activity records consistent. |
| `GET` route mutating holding trade levels | Stage 05 | Reconcile read/write semantics and persistence ownership. |
| Current FX applied to historical data | Stage 05 / Stage 14 | Separate current display conversion from historically correct valuation. |
| Portfolio currency accounting ambiguity | Stage 05 / Stage 14 | Define and preserve currency provenance before connected-history work. |
| Portfolio-page snapshot cache is warmed but not read by the current page | Stage 05 | Reconcile or retire duplicated page-snapshot behaviour. |
| Ticker-only instrument identity | Stage 06 / Stage 07 | Separate market identity from future provider/account identity. |
| Unsupported assets are rejected or dropped | Stage 06 / Stage 07 / Stage 13 | Preserve unsupported/tracked-only assets in connected portfolio totals. |
| Market-snapshot cron does not persist market snapshots | Stage 06 | Align naming, storage and consumer behaviour. |
| Market cron uses a session client despite subscriber-only checked-in RLS | Stage 06 / Stage 18 | Verify background-job access and least-privilege security. |
| Stripe webhook lacks explicit processed-event idempotency and complete write checks | Stage 18 | Harden subscription event processing and observability. |
| Notification infrastructure failure can become zero unread | Stage 18 / Stage 19 | Preserve failure visibility while keeping user messaging safe. |
| Digest entitlement and 100-recipient cap differ from shared entitlement logic | Stage 19 | Reconcile customer-facing digest eligibility and batching. |
| Missing `.env.example` referenced by README | Stage 01 / Stage 02 | Resolved: the tracked example now records the current secret-free environment contract. |
| Next.js middleware naming/deprecation review | Stage 02 assessment; later cleanup | Assessed against Next.js 16.2.4: accepted but deprecated and non-blocking; migration remains a separately scoped cleanup. |
| Self-mutating GitHub patch workflows | Stage 02 | Resolved: all 19 source-rewriting commit-and-push workflows were removed. Historical scripts remain inert. |
| Direct action-oriented portfolio language remains in code and UI | Stage 04 / Stage 19 | Resolved in active canonical portfolio-assessment surfaces; remaining unrelated/dead legacy customer-language cleanup belongs to Stage 19. |
| Duplicate Supabase browser-client patterns | Stage 18 | Reconcile client ownership and security assumptions. |
| Notification events are recomputed rather than durably represented | Stage 19 | Canonical current prompts now share assessment ownership; durable event history remains a separate persistence/product task. |
| Dashboard and Portfolio duplicate enrichment/assessment work | Stage 04 / Stage 21 | Canonical assessment ownership is unified; remaining query/enrichment performance duplication belongs to Stage 21. |
| Global CSS and DOM-patch components have broad cross-route effects | Stage 16 / Stage 17 / Stage 19 | Address only within the responsible staged UI work. |
| Native shells depend immediately on live web deployment behaviour | Stage 17 / Stage 25 | Verify responsive/native behaviour before controlled rollout. |

## Change log

- Engineering constitution established.
- Live-derived source baseline mapped.
- Stage 01 completed with the persistent Vercel staging and local-Supabase development topology documented.
- Stage 02 established Node 24, explicit TypeScript test execution, full web quality gates, read-only CI permissions and a secret-free environment contract.
- Nineteen self-mutating GitHub patch workflows removed from the normal engineering path.
- Stage 03A completed the production-schema/repository reconciliation audit; Step 03B-1 established the project-local Supabase CLI and local-only configuration boundary.
- Step 03B-3A archived incomplete historical SQL, aligned all 26 production migration timestamps and proved the canonical 26-table structure through two clean local resets and catalog parity assertions.
- Step 03B-3B added deterministic synthetic local fixtures and proved two seeded resets, local Auth sign-in, entitlement gating and owner-scoped RLS isolation.
- Step 03B-3C committed local-generated database types, typed all Supabase client boundaries, repaired confirmed watchlist/ranking schema references and passed the full local reset/type/test/lint/build integration gate.
- Stage 03 closeout formalised the forward-only, approval-gated Supabase migration release runbook; added immutable baseline hashes, migration-order/automation guards and negative tests; and repeated the complete local reset/RLS/type/test/lint/build proof, leaving Stage 04 as the next major stage.
- Stage 04A completed the portfolio-intelligence census. Step 04B introduced the isolated canonical V1 domain engine and deterministic fixture/contract suite without migrating customer surfaces.
- Step 04C introduced the current-schema factual adapter and proved canonical assessment through local authenticated/RLS-backed synthetic portfolio reads, while leaving all customer surfaces and legacy engines unchanged.
- Step 04D migrated the Portfolio customer surface to canonical status and attention ordering while retaining health as a separate numeric metric and leaving legacy transaction/mutation engines isolated for the next slice.
- Step 04E removed legacy transaction recommendations from the active Portfolio presentation, removed Portfolio opportunities, made activity transaction-only, and separated canonical investigation reasons from explicit manual record management.
- Step 04F migrated mobile and desktop Dashboard portfolio status to the shared canonical assessment, proved Dashboard/Portfolio parity, removed active portfolio-fit recommendations, and retained health and subscription access as separate concerns.
- Step 04G migrated Ask StockGPT's focused portfolio model context to canonical structured assessment, proved Portfolio/Dashboard/Ask parity, and removed legacy action-oriented portfolio assessment fields from the active prompt.
