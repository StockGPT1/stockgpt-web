# Next milestone: provider/privacy readiness and controlled-pilot preparation

Date: 2026-10-21. Stage 22B is closed; do not repeat its engineering review or
hosted sync. Preserve the original 26-stage roadmap: Stage 22 is **First real
broker pilot**, Stage 23 **Second-broker abstraction proof**, Stage 24
**Compliance/legal launch review**, Stage 25 **Controlled production rollout**,
Stage 26 **Post-launch provider strategy**. 22C readiness and 22D pilot subdivide
Stage 22; neither replaces Stage 24. Planning is not an external approval.

## One consolidated delivery milestone

| Priority / lane | Work and owner | Dependencies | Verification / concrete completion |
|---|---|---|---|
| P0 / 22C engineering | Versioned provider/security packet: exact read-only endpoints, permission/Vault boundary, retention questions, failure limits, incident and credential-revocation owners | Can start now from source and accepted evidence | Every integration operation classified; no trading/manual-refresh/add-on permission; secret-exclusion and owner-isolation tests; unresolved items assigned named owners |
| P0 / 22C provider/business | Written Commercial production eligibility, intended broker/account support, permission model, redistribution/licensing, quotas, charges and security/onboarding requirements | Provider response and business owner; TEST success is not production approval | Dated provider evidence references exact proposed pilot scope; approved budget/limits and named escalation contact; no implicit plan activation |
| P0 / 24 engineering | Persisted-data/outbound-flow register and lifecycle dependency graph | Can run in parallel now, synthetic only | Every table and outbound context field classified by purpose, processor, owner, location evidence, secret category, export/deletion behavior and decision owner; no invented retention periods |
| P0 / 24 counsel/business | Resolve legal entity/controller, jurisdictions, regulatory perimeter, AI/marketing claims, processing terms/transfers, rights/retention/backups and incident responsibility | Professional/owner review, provider processing evidence | Written decisions tied to exact feature/jurisdiction and notice versions; no claim that tests/disclaimers establish compliance |
| P0 / 22D preparation | Participant/scope receipt, read-only identity checks, reconciliation, observability, consent and stop/rollback rehearsal | Checklist/synthetic rehearsal can begin now; real execution gated below | Zero/partial/multicurrency/unmapped/failure fixtures preserve last-good values and honest performance; exact account/environment and operator window; explicit future real-account approval |
| P1 / 25 engineering | Default-off owner/cohort admission, revocation/audit design; sanitized queue/freshness monitoring; release receipt and shutdown drills | Can build using synthetic users without changing subscription rules | Non-admitted/cross-owner denied server-side; no secrets or financial amounts in alerts; participant revocation and kill switch tested; no customer activation |
| P1 / 25 engineering | Synthetic owner-data export contracts and deletion dry-run inventory; browser/native handoff matrix; field-observability plan | Destructive lifecycle awaits approved retention specification; actual device tests need operator/device | Cross-owner access denied; credentials excluded; disconnect, Portfolio removal, credential revocation, broker-data deletion and account closure remain distinct; device claims match actual evidence |
| P1 / operations | Normal worker total-attempt/dead-letter policy proposal | Owner approval of retry/cost/support policy | Current backoff is capped, total attempts are not; proposed finite behavior tested before adoption, no silent scope expansion of accepted one-shot worker |

## Stage 24 decision packet: concrete source findings

- `app/legal/page.tsx` identifies a Delaware LLC in Terms but a UK controller
  in Privacy; owner/counsel must resolve actual identity. Do not automatically
  change entity or jurisdiction. Current legal version is 2026-05-17.
- Notices need factual review of SnapTrade, connected accounts/positions/cash/
  activity/history/context and processing relationships. Generic retention text
  is not an approved table-specific deletion specification.
- `PortfolioExportLink.tsx` exports currently loaded holdings/activity CSV; it
  is not a full rights export. No complete broker/history/account deletion
  product should be claimed. Define backup exceptions before destructive work.
- `app/api/ask-stockgpt/route.ts` sends source-aware financial context to
  OpenRouter. Inventory exact payload fields/model fallbacks and verify provider
  processing terms; its seven-day cleanup on access is best effort, not proof
  of scheduled retention enforcement. Test identifier/secret minimization.
- Analytics/Speed Insights behavior needs payload/cookie assessment, not an
  assumption about whether consent is legally required.
- AI Portfolio Draft preferences, allocations, expected-return/risk narratives
  require a product/regulatory scope decision; disclaimers alone do not settle
  it. Preserve accepted accounting, four statuses and research limitations.
- Approved wording needs coherent signup/Checkout acknowledgement versions.
  Native privacy/store/payment assertions require current professional/store
  verification; historical `docs/IOS_APP.md` is not current legal authority.

## Stage 22D real-account gate (NOT authorised by this plan)

Proceed only with necessary 22C provider/security approval, Stage 24 pilot-specific
privacy/consent/processing decisions, participant consent, exact permitted account
scope, explicit user approval, approved credential provisioning/budget and an
operator covering the whole observation/shutdown window. Required reconciliation:
account identities, position/cash/activity counts, currency/provenance, unsupported
assets, freshness and known/unavailable performance; never force a return number.
Use independent durable-state verification and tested stop behavior. No trading,
manual refresh/add-ons or broad participant access implied. Do not reuse a
Sandbox receipt/registry to approve real connections.

## Stage 25 limited-beta completion gate

Only admitted users can connect; subscription semantics unchanged. Approved
notices/acknowledgements and provider scope precede exposure. Support/privacy/
incident owners, resource budget/cohort size, migration provenance, monitoring,
shutdown/rollback and approved lifecycle procedures must be operational.
Production deployment, keys, real participants and paid services need explicit
authorisation. Real-device return proof is required for native readiness claims.
Field p75 LCP/INP/CLS remain unmeasured: targets 2.5s/200ms/0.10 are not results.
Stage 23 and Stage 26 remain separate roadmap work, not silent additions here.

## Shared Git/Vercel source-control risks and safe publication

This closure creates a **local-only** checkpoint. The same repository feeds
customer `stockgpt-web` (`prj_QzlZVgUZ5qIC5SwYz5k3ThQKkQNo`) and separate
`stockgpt-staging` (`prj_AxbNJT8VObcG020Abob7Vu5XhdMo`). At proof shutdown,
Staging Git deployments and cron execution were disabled; customer automatic
deployments remained enabled. These settings are operational snapshots, not
permanent guarantees. A branch push can start customer Preview builds/CI; a
merge or Production-branch update can deploy customer Production. No push now.

Before later publication, independently reverify remote SHA/branch protection,
both projects' Git triggers/Production branches/ignored-build rules, environment
scopes and project/team IDs. Obtain approval for any resulting customer Preview
deployment or an explicitly approved isolation change; do not silently disable
customer controls. If no deployment is allowed, retain the local commit or a
sanitized offline Git bundle until a supported release path is approved.

Keep root customer `vercel.json` and its ten schedules unchanged. An alternate
config in Git does not redirect Git deployments. The accepted staging artifact
requires an audited source whitelist and exact staging config materialized at
artifact root; `--local-config` alone did not prove remote schedule registration.
Never publish activated approval receipts, credential-pair digests, local helpers,
environment files, archives or backups. Check source/artifact inventory and
secret scan before any separately approved upload. Verify live schedules while
cron execution remains disabled. Do not blindly replay the hosted migration:
reviewed local version 20261015160822 maps to hosted Staging 20261021164515.

## Recommended next implementation (one handover)

The synthetic engineering batch below has now been implemented in the
accelerated readiness sprint; see [verification](readiness-sprint-verification.md).
External commercial/legal approvals and real-account activation remain pending.
The next handover is the consolidated provider/qualified-review decision packet
plus approved source-publication isolation, not another Stage 22B review.

Authorise **one synthetic-only readiness batch**: data-flow/processor register,
lifecycle dry-run/export contracts, AI-context minimization/claims tests, and
default-off cohort/observability/stop controls, while provider and counsel work
their decision packets in parallel. Reuse accepted suites; no new framework or
real credentials. Close with one evidence matrix linking each approval to its
exact implementation/test, then request one narrowly scoped 22D pilot approval.
Do not block independent engineering on unanswered commercial/legal questions,
but never treat engineering completion as permission to expose real data.
