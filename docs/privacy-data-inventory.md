# Brokerage privacy/lifecycle engineering inventory

Synthetic-only engineering baseline, 2026-10-21. No retention period, controller
identity, legal basis, transfer mechanism or deletion exception is approved by
this document. This is not legal clearance or a complete rights-response product.
No new database policy, export HTTP endpoint or destructive executor is added.

## Actual source-to-destination boundaries

| Data class / actual storage | Purpose, scope and source | Export/lifecycle treatment |
|---|---|---|
| Authentication: Supabase `auth.users` / sessions; private `broker_private.user_provider_credentials` and `vault` | Customer session authentication; backend provider-user credential lookup in `lib/brokerage/secret-store.ts`. Provider consumer key is server configuration, not public broker data. | Never queried by the new export loader. No secret/fingerprint/provider-user ID export. Provider-user revocation, session invalidation and account deletion need separate trusted approved procedures. Deleting a user does not itself invalidate already issued access tokens. |
| `broker_connections` | Provider authorization lifecycle, exact `user_id`; provider/institution/connection identity; sync attempt and success timestamps | Export only selected local linkage IDs/status/timing. Exclude `external_connection_id`. Disconnect is not normalized-data deletion. |
| `broker_accounts` | Exact connection/owner/institution relationship; provider account identity, name/type/currency/status | Export selected local linkage IDs/type/currency/status; exclude name and `external_account_id` from this minimized subset. This omission means it is not a complete rights export. |
| `broker_positions` | Provider-reported quantities/prices/market values, currency/freshness, optional instrument resolution | Export explicit scalar financial facts without recomputation. Preserve null versus zero and permanent instrument ID. Exclude external instrument/position IDs, position key and free-text description. No promotion into global market data. |
| `broker_cash_balances` | Exact account/owner/currency, provider cash amount and `as_of` | Preserve amounts/currency/time exactly; no FX or zero substitution. |
| `broker_activities` | Durable provider activities, amounts, timing precision, fingerprint/idempotency evidence | Export selected economic fields and `occurred_at_precision`; exclude description, external activity ID and fingerprint. No ledger/activity deletion implemented. |
| `broker_account_value_history` | Immutable account/owner historical provider evidence, source/quality/currency/value/recorded times | Include selected evidence fields without performance reconstruction. Retention/deletion needs decisions covering history and backups. |
| `broker_sync_jobs` | Durable ownership, lease/worker attempts, availability, sanitized failure code | Operational history is outside portable subset. Never export worker IDs/lease identifiers or credentials. Future rights inventory must assess it explicitly. |
| `user_portfolios` connected projections | Exact owner/account mapping, archived state; source-aware UI preferences | Export connected linkage/source/record times only. Do not read connected truth from manual balances. Removing this projection is not disconnect, credential revocation or broker-history deletion. |
| Manual `portfolio_holdings`, append-only `portfolio_transactions`, `portfolio_snapshots` | Separate Stage 05 manual accounting; historical lifecycle cascade is explicit Portfolio deletion | Outside this brokerage subset. Do not delete/rewrite immutable financial evidence to satisfy an unapproved lifecycle policy. Full account rights coverage must include them. |
| `portfolio_page_snapshots`, `portfolio_context_preferences` | Derived page cache and exact owner/default context | Outside portable subset; cache expiry is not history retention. Future lifecycle graph must invalidate appropriate references without deleting independent broker facts. |
| `broker_providers`, `brokerage_institutions`, `brokerage_institution_aliases`, `instruments`, `instrument_aliases`, market/ranking/FX tables | Shared reference/identity/current research, not owned broker holdings | Not subject-owned records; no cascading deletion of reference identities. Sandbox fixture provenance remains separate; export does not manufacture coverage/rankings. |
| `ask_stockgpt_messages` | User-authored and generated conversational text; route assembles source-aware context and sends it to OpenRouter | Outside this subset. AI context must pass the separate outbound allowlist. Existing best-effort cleanup on access is not a guaranteed retention process. Transcript disclosure/deletion and processor retention need separate policy. |
| `notification_dismissals`, `user_notification_summaries`, `email_digest_deliveries`, `security_audit_events`, `security_rate_limits` | Acknowledgement, delivery/idempotency, security records; current canonical attention derives from owned state | Not deleted by this foundation. Distinguish acknowledgement from resolution. Retention and access exceptions require explicit security/privacy decisions. |
| `profiles`, Stripe event/customer identity, support/waitlist/watchlist records | Identity, entitlement, billing/support/product preferences | Outside brokerage subset, not silently included through `SELECT *`. Billing/history preservation and complete subject export require separate mapping. |
| Vercel/runtime logs, Supabase logs/backups, browser analytics/Speed Insights | Infrastructure diagnostics/recovery and optional product telemetry | No guarantee of erase-on-app-delete. Confirm processor configuration, region, payloads, access and backup schedule before approving retention/deletion claims. No sensitive broker amounts/identifiers in operational logs. |

Existing boundaries: `20260913175530_establish_provider_neutral_broker_domain.sql`
defines owner SELECT RLS and composite parent/owner FKs; secret-boundary migration
`20260913184518_establish_broker_secret_boundary.sql` confines credentials to
private storage/trusted RPCs. History/connected-projection migrations extend that
model. This sprint does not modify grants, RLS, Vault or financial mutation RPCs.

## Implemented callable foundation

`lib/privacy/broker-data-loader.ts` takes the existing normal authenticated
session/RLS client. `auth.getUser()` determines the owner; there is no caller
subject ID, service-role fallback, secret lookup or provider request. It loads
seven fixed tables with explicit columns, owner predicates and stable ID order;
`user_portfolios` is restricted to connected projections.

Bounds: 500 rows/page; 40 requests across all tables; 10,000 total rows;
2,000,000 UTF-8 output bytes; 1,024 characters/selected string. Limits are
engineering availability bounds, not permitted financial truncation. Any
overflow, missing count, page error, changing exact count, incomplete page,
duplicate ID, cross-owner or broken parent relationship rejects the whole export
with a fixed error code. An exact 500-row count stops without requesting an
offset-at-total page that PostgREST may reject with HTTP 416. No logs carry raw
database errors. Large subjects require a separately designed streaming/job
export, not silently incomplete output.

The pure builder rechecks every row's owner and parent chain:
connection → account (same institution) → positions/cash/activity/history;
connected Portfolio → account. Explicit scalar projection discards unknown
fields even from hostile injected rows. Unknown monetary facts stay null and
finite monetary facts are copied, not rounded, converted or reconciled. Timing,
quality and permanent IDs remain evidence; this function does not attest that a
resolved security is ranked or real-market verified.

Consistency is explicitly `non_transactional_read`. Stable page counts do not
prove a point-in-time database snapshot across tables or detect all concurrent
same-count changes. This is a non-destructive foundation; do not issue legally
complete exports or use it as deletion authorization. A future complete rights
response needs approved fields, point-in-time/delivery design, audit and all
non-broker data sources above.

## Lifecycle contract and unresolved decisions

`planBrokerLifecycle` revalidates the owner-scoped export and exact target. It
returns **inventory only**, `executable: false`, related row counts and explicit
uncounted categories. It never performs provider operations, deletes SQL rows,
revokes a credential, closes an account or grants permission for those actions.

| Intent | Distinct effect to specify before an executable feature |
|---|---|
| Disconnect provider | Stop future provider access/sync through a separately trusted operation; retain last-good normalized facts with honest disconnected status. |
| Remove connected Portfolio | Existing exact-owner lifecycle removes only the StockGPT projection, not independent broker account/history or credentials. |
| Revoke provider credential | Backend secret/provider-user lifecycle; not equivalent to disconnecting one connection, deleting holdings or closing StockGPT. |
| Delete broker data | Blocked pending approved retention/rights/security specification, provider-side consequences and backup/log handling. |
| Close StockGPT account | Blocked pending full-account dependency graph, sessions/revocation, billing/legal holds, provider processing and backup policy. A connection-scoped dry-run is explicitly incomplete. |

No retention duration is invented. Business/counsel must approve per-purpose
retention, legal holds/financial evidence, deletion timing and processor/backups
exceptions; engineering then implements versioned trusted operations and local
hostile-session tests. Export completion is not permission to delete.

## Verification scope

`node --conditions=react-server --import tsx scripts/privacy-lifecycle-checks.ts`
uses synthetic rows and mocked authenticated clients only. Coverage includes all
seven owner boundaries, parent/institution mismatch, exact-count pagination,
unknown/zero/value/timestamp preservation, secret exclusion, immutable inputs,
overflow, malformed finite values, sanitized failures and non-executable plans.
No database, provider, credential, deletion or customer operation is performed.
Existing real local RLS/security suites remain the database-layer evidence; this
sprint does not claim those were re-proven by a mocked export test.

Supabase security reference: [RLS, grants and ownership](https://supabase.com/docs/guides/database/postgres/row-level-security).
