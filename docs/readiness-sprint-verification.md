# Accelerated readiness sprint: implementation and verification

2026-10-21; branch `codex/broker-sync-foundation`; starting checkpoint
`53a4ab672ccdebf2887693e5543f55cf81daefe5`. Synthetic/local engineering only.
Stage 22B remains accepted and stopped; no repeated hosted proof or activation.

## Implemented capabilities and limits

1. **Brokerage export/lifecycle:** server-only authenticated session/RLS loader,
   seven explicit-column owner-scoped tables, parent/institution validation,
   exact-count pagination, 500-row pages / 40 shared requests / 10,000 rows /
   2,000,000 output bytes. Failure never produces silently truncated evidence.
   No secret/Vault lookup, admin fallback or mutation. Lifecycle output is
   inventory-only and non-executable. The brokerage subset is not a full rights
   export, retention policy or transactionally consistent snapshot.
2. **AI context:** one final outbound DTO allowlist after owned fact loading;
   request-local holding/source references replace stable IDs. Private Portfolio
   names, arbitrary filters, credentials and raw provider payloads are excluded.
   Known financial values, unknown/null, source separation, canonical statuses,
   timing and synthetic provenance remain explicit. Ranked research requires
   known eligible provenance/coverage/evidence. Max 5,000 holdings per list and
   2 MiB serialized context; overflow fails the request, never truncates totals.
   User questions/history and public research copy remain separate deliberate
   inputs; this is minimization, not anonymization or arbitrary-secret redaction.
3. **Admission:** empty trusted server-only cohort registry, default-off rollout
   mode, exact session identity, existing subscription semantics, half-open
   approval windows and operation scopes. Connect/discover/project refuse before
   admin/provider/RPC side effects when unauthorized. Auth errors cannot be
   treated as a valid session. Existing normalized facts remain readable.
4. **Stop/observability:** admission and ordinary-worker stop switches are
   separate. Authenticated paused cron ticks create no admin client/claim.
   Missing worker-stop setting preserves the accepted normal worker; malformed
   present values stop. No in-flight cancellation is claimed. A pure 1,000-row
   summary emits fixed state/count/freshness buckets only; no privileged endpoint
   or operator authorization is invented.
5. **Privacy-safe failures:** Ask provider/stream/database exception diagnostics
   use fixed codes rather than raw response/error bodies. Unavailable connected
   facts cannot fall through to manual Portfolio cash/accounting. Connected-page
   read failures are visible rather than a false empty/healthy state.

## Complete changed-file inventory (24 files)

| Path | Change |
|---|---|
| `app/api/ask-stockgpt/route.ts` | Final DTO boundary, connected-unavailable isolation, sanitized failures; existing models/entitlement unchanged |
| `app/api/broker/connections/start/route.ts` | Verified-auth + cohort admission before registration/portal |
| `app/api/broker/portfolios/route.ts` | Verified-auth + cohort admission before owner-scoped projection RPC |
| `app/api/cron/broker-sync/route.ts` | Auth-first worker stop before admin/claim; normal default preserved |
| `app/portfolio/connections/page.tsx` | Disable non-admitted forms, preserve existing views, explicit query/health unavailability |
| `app/portfolio/connections/return/route.ts` | Verified-auth + entitlement/cohort before discovery/enqueue |
| `docs/implementation-status.md` | Honest 22C/24/25 engineering progress and remaining gates |
| `docs/stage22-next-milestone-plan.md` | Record delivered synthetic batch and next external handover |
| `docs/privacy-data-inventory.md` | Storage/flows, export omissions, lifecycle/retention boundaries |
| `docs/provider-legal-readiness-assessment.md` | Dated official-source provider and qualified-review decision packet |
| `docs/runbooks/stage22-pilot-beta-release.md` | Publication isolation, real-pilot/beta gates, effective control limits |
| `docs/readiness-sprint-verification.md` | This inventory and test/evidence record |
| `lib/ai/portfolio-context-policy.ts` | Explicit minimized DTO, fixed failure projection and request budgets |
| `lib/ask-stockgpt-portfolio-context.ts` | Explain minimized identities/count-only other Portfolios in system prompt |
| `lib/brokerage/capability.ts` | Empty trusted cohort and server-owned admission/worker-stop wrappers |
| `lib/brokerage/rollout-policy.ts` | Pure fail-closed admission and ordinary-worker stop policy |
| `lib/brokerage/sync-observability.ts` | Bounded fixed-enum operational summary |
| `lib/privacy/broker-data-contract.ts` | Scalar export allowlists and non-executable lifecycle inventory |
| `lib/privacy/broker-data-loader.ts` | Session-derived bounded read-only export loader |
| `package.json` | Compose readiness suites and include them in static acceptance; no dependency change |
| `scripts/ai-context-privacy-checks.ts` | Hostile field/identity, real factual-builder, value/coverage/budget/availability tests |
| `scripts/broker-rollout-checks.ts` | Policy and 21 actual-route mocked side-effect scenarios |
| `scripts/broker-sync-stop-checks.ts` | 8 actual-route mocked auth/stop/default scenarios |
| `scripts/privacy-lifecycle-checks.ts` | 23 synthetic export/pagination/ownership/lifecycle checks |

No migration, generated database type, lockfile, RLS/grant, legal notice text,
root customer Vercel config, normal sync collector/worker implementation,
instrument resolution, valuation or performance-math change is included.
All Sandbox, proof and beta approval registries remain empty. No cohort member,
receipt or runtime setting is activated.

## Acceptance evidence

Tests ran in a clean candidate checkout with pinned installed dependencies
inside its filesystem root, no real environment files or credential helpers.
Provider/billing/database/cloud environment names were removed from child
processes, with only synthetic acceptance configuration restored. The existing
`scripts/local-only-network-guard.mjs` preload denied external HTTP(S).
This is local/mock evidence, not a live provider/API or production performance run.

| Command / scope | Result |
|---|---|
| `npm run test:readiness:lifecycle` | PASS — 23 cases, seven owner boundaries, parent mismatch, unknown/zero, immutable facts, secret exclusion, realistic offset-at-count pagination, budgets/errors |
| `npm run test:readiness:ai` | PASS — canonical connected/aggregate builders, duplicate canonical IDs retain separate positions, unknown/zero, synthetic suppression, provenance/identity removal, 200 holdings, overflow and sanitized failures |
| `npm run test:readiness:rollout` | PASS — exact owner/shared entitlement/window/scope policy; 21 admission route cases; 8 worker-stop cases; zero side effects when denied |
| `npm run test:acceptance:static` | PASS — migration safety/negative cases, schema contracts, accepted 22B mocks, readiness, canonical Portfolio/Dashboard/Ask/Notifications, adapter/connection/identity/history/aggregate/customer and bounded performance regressions |
| `node --import tsx scripts/wave5-security-checks.ts` | PASS — trusted-service/security source contracts |
| `node --import tsx scripts/stripe-entitlement-order-checks.ts` | PASS — deterministic mocked ordering semantics unchanged |
| `node node_modules/next/dist/bin/next typegen` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `npm run lint` in clean candidate | PASS — 0 errors, 23 existing warnings; no rule/ignore changes |
| Targeted ESLint on every changed runtime/test file | PASS — rerun after final hostile-auth hardening |
| `npm run build:app` | PASS — final Next 16.2.4 production build, 68 static pages; existing middleware convention warning |
| `git diff --check` / index inventory and sensitive-pattern scan | PASS before local checkpoint |

Focused tests/type/lint/build were rerun after the final provenance and
contradictory-auth-state cases. The full source acceptance chain passed; no
reset-based suite was used to claim preservation of the recovered database.

**Deliberately not run:** full `test:acceptance`, local Auth/PostgREST/browser
stack and database-writing integration suites. They require stack setup/reset
or database mutation, unnecessary for these non-schema changes and incompatible
with preserving the recovered instance without new investigation. No real RLS
behavior is claimed proven by mocked clients; existing accepted DB evidence is
retained. No DB service was started, reset, seeded or modified in this sprint.
Original local PostgreSQL remained stopped; its volume/backup were untouched.
Browser/device and actual deployment/provider tests remain future release gates.

## External and engineering release gates

- Written account-specific provider eligibility, broker/account permissions,
  licensing/processing terms, quotas/cost limits and incident owners remain open.
  Free/Build and Commercial authentication are distinct; public pricing is not a
  signed quote or approval to provision a plan.
- Qualified owner/counsel/privacy decisions remain required for legal entity/
  controller mismatch, jurisdiction and promotions/advice perimeter, AI processing/
  model fallback, retention/rights/backups/transfers and notices/acknowledgements.
- Existing authenticated `create_connected_portfolio` is still exact-owner but
  not database-cohort-enforced. App admission is not a claim of DB-wide rollout
  enforcement. Review this boundary before beta; no permission was weakened.
- Fresh Vercel metadata access is incomplete: customer identity/protection visible,
  Git-trigger fields omitted and separate Staging not visible through the current
  connector. This is a visibility limitation, not evidence the stopped state
  changed. Do not push until project-specific deployment consequences are verified
  and a narrow isolation action is explicitly approved.
- 22D requires explicit real-account/participant consent and scope approval,
  verified read-only identity/environment, approved budget and an operator/second
  verifier. Stage 25 additionally requires admitted cohort, DB admission decision,
  support/monitoring/stop readiness and necessary legal/provider decisions.

**Highest-value next milestone:** close one provider/qualified-review decision
packet and the safe source-publication gate, then prepare the exact internal-pilot
release candidate (including the database admission decision) for one explicit
22D authorization. Independent synthetic work is complete; do not treat external
approval as an engineering test or reopen the settled 22B proof.

## Source-control checkpoint

Checkpoint is local only on the foundation branch. Remote remained at
`b41f76f3f3cb82613a6bf9d6b66b29e835649018` on the read-only Git check; the accepted
22B closure commit is already one unpublished ancestor. No push, merge,
deployment, cloud setting change, credential read/rotation, real brokerage access,
paid service or customer-data deletion occurred. Ignored local evidence and
encrypted credentials remain excluded and untouched.
