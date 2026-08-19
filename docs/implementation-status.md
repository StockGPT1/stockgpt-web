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
| 03 | Reconcile Supabase schema and generated types | IN PROGRESS | `codex/broker-sync-foundation` | Audit, local tooling, canonical baseline, synthetic fixtures and real generated database types are complete. Typed clients and confirmed schema-reference repairs pass reset/RLS/type/test/lint/build checks. The controlled future production-migration workflow remains outstanding. |
| 04 | Canonical portfolio intelligence engine | NOT STARTED | | |
| 05 | Portfolio correctness and persistence cleanup | NOT STARTED | | |
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
- Stage 03 owns production schema reconciliation, reproducible migrations, generated database types, local Supabase bring-up and synthetic development data.
- Until Stage 03 is complete, staging must not receive broad production-database write credentials or the production service-role credential.
- Production Supabase inspection is read-only unless a separately reviewed and explicitly approved migration operation is authorised.

### Stage 03 working state

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
- The controlled future production-migration workflow remains the explicit next/final Stage 03 subtask.

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
| Schema and migration history cannot reproduce the referenced database | Stage 03 | Local reproduction, synthetic seed, generated types and application-reference alignment are resolved; the controlled future production migration workflow remains in Stage 03. |
| Placeholder Supabase generated types | Stage 03 | Resolved from the canonical local schema with a repeatable local drift check. |
| `watchlist` / `user_watchlist` mismatch | Stage 03 | Resolved in runtime code: all application queries use canonical `watchlist`; compile/source contracts guard against regression. |
| Conflicting portfolio recommendation/status engines | Stage 04 | Establish the canonical portfolio-intelligence boundary and vocabulary. |
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
| Direct action-oriented portfolio language remains in code and UI | Stage 04 / Stage 19 | Align domain output first, then remaining customer-facing surfaces. |
| Duplicate Supabase browser-client patterns | Stage 18 | Reconcile client ownership and security assumptions. |
| Notification events are recomputed rather than durably represented | Stage 04 / Stage 19 | Decide after canonical intelligence ownership is established. |
| Dashboard and Portfolio duplicate enrichment/assessment work | Stage 04 / Stage 21 | Establish one assessment boundary before performance tuning. |
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
