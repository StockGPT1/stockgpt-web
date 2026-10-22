# Stage 22D / 25 controlled release and publication gates

Date: 2026-10-21. Planning/runbook only; no push, deployment, activation,
provider request or customer-data action performed by this document. Preserve
the original roadmap: 22D is the internal pilot within Stage 22; Stage 24 is
legal/compliance review; Stage 25 is controlled production rollout. Stages 23
and 26 remain separate work.

## Fresh verification, not assumptions

| Identity | Expected value / evidence |
|---|---|
| Repository / branch | `StockGPT1/stockgpt-web` / `codex/broker-sync-foundation` |
| Accepted local readiness baseline | `f452ed70a33488c2eca662e7a288f1acf69838cd`; not pushed |
| Team | `team_eUm0mdcYHHHcNo4D5tMm9cHQ` |
| Separate Staging project | `stockgpt-staging`, `prj_AxbNJT8VObcG020Abob7Vu5XhdMo` |
| Customer project, excluded | `stockgpt-web`, `prj_QzlZVgUZ5qIC5SwYz5k3ThQKkQNo` |
| Supabase Staging / excluded Production | `oocvbilwiosehfqpzges` / `rfloxmydpbgyyaesysbv` |
| Last accepted stopped Staging deployment | `dpl_5AFJKiBbR6tZhHaFBQpgSF9MPnzY`, zero schedules, cron/Git automation disabled |

The stopped state above is accepted 22B evidence, **not a new live verification**.
This sprint's read-only Vercel connector found the customer project under the
expected team and reported protection `all_except_custom_domains`. It did not
expose production-branch/Git-trigger fields. The exact Staging project lookup
returned `not_found` in this connector scope; that is an access/visibility
limitation, not proof of deletion or changed settings. No token retrieval or
permission workaround was attempted. Fresh authorized metadata access is a
publication prerequisite. Fresh 2026-10-21 inspection again returned the exact
customer project/team and protection setting, with latest READY Production
deployment `dpl_5CY81bBDsXPrbaL6vhn6d4crVcjV`. This differs from the historical
22B customer deployment; no change was made or attributed by this sprint.
The same scoped Staging lookup again returned HTTP 404 `not_found`. The connector
response still omits Git linkage, production branch, ignore command and automatic
deployment controls. Those fields are **unknown**, not implicitly unchanged.
No CLI credential files, tokens, environment values or protected URLs were read
to work around the visibility limit. Read-only Dashboard/API access to these
exact settings remains required before publication.

The explicitly Preview-filtered customer deployment list independently returned
READY `dpl_5Yeko3umQw3fZVVRcfRZ4zB7KRjX` for this foundation branch at
`b41f76f3f3cb82613a6bf9d6b66b29e835649018` (and the previous `b18a3e0` Preview).
This is concrete evidence of prior feature-branch customer deployments, not
proof that present trigger settings are unchanged. Raw `target: null` is not a
classification failure when the API's Preview-filtered list is the evidence.

## Publish local source without surprise deployments

Vercel's [Git integration](https://vercel.com/docs/git) deploys non-production
branches as Preview by default. The accepted shutdown disabled Staging Git
automation, not the customer project's integration. A foundation-branch push can
therefore expose a customer Preview and consume build resources without merging
to `main`. Local commits and a different config filename are not isolation.

Before any separately approved push:

1. Recheck local branch, commits, remote HEAD/divergence and exact staged/source
   inventory. Scan for secrets, local helpers, active proof receipts, archives
   and environment files. Preserve empty Sandbox/proof approval registries.
2. Obtain fresh metadata for both projects: repository link, production branch,
   Git automation, ignored-build command, branch tracking, target/branch-scoped
   environment **names/types/scopes only**, Deployment Protection, cron state and
   current deployment SHA. Reconcile migration provenance before any release:
   local `20261015160822` maps to Staging `20261021164515`; never replay blindly.
3. If customer Preview must not run, request an explicit project-level,
   branch-specific isolation action by an authorized operator before pushing.
   Do not globally disable customer Production automation. Vercel supports
   [branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration);
   unspecified branches default enabled. Alternatively, a reviewed project-only
   [Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel)
   can skip the exact foundation branch (exit 0 skips; exit 1 builds), but source
   `ignoreCommand` can override the dashboard setting. Verify the effective rule,
   not merely its presence. This sprint changes neither setting nor root config.
4. If isolation cannot be independently established, **do not push**. Retain local
   commits or an approved secret-free offline Git bundle. Creating a PR is not a
   safe workaround: it can also trigger builds. Future project-isolated artifact
   publishing needs separate authorization and exact target verification.
5. After an approved push, check remote SHA and both project event/deployment
   lists. Unexpected customer build/target/environment is a stop condition;
   follow the approved operator response, never silently change Production.

The implemented **uninstalled** customer-project-only proposal is
`node scripts/customer-project-ignore-build.mjs` as the customer Dashboard
Ignored Build Step. It exits 0 only for the exact customer project, GitHub
repository owner/name, foundation branch and Preview environment; it logs no
environment values. All other inputs exit 1, leaving normal builds eligible.
This is deliberately not a universal unknown-project kill switch. Missing system
metadata cannot establish isolation and blocks the publication receipt. Team
ownership is independently checked against API metadata; `VERCEL_ORG_ID` is not
assumed to be a Vercel build-system variable. Verify genuine system variables are
available at the ignore step; do not inject fabricated identity values.

The source is not connected to any customer setting, root config, npm build or
workflow. It does **not** prevent a push today. For an existing Dashboard ignore
rule, stop for exact rule composition review rather than replacing it: an
existing exit-0 skip must remain a skip outside this foundation predicate.
The supplied publication evaluator intentionally refuses that case until a
separate composition is reviewed. A repository `ignoreCommand`, including one
from an alternate effective config, can supersede the Dashboard command.
Repository `git.deploymentEnabled` is shared configuration, not inherently a
customer-project-only isolation setting. A skipped build may still create Vercel
metadata and GitHub CI; this does not promise a push has zero side effects.
Nothing in this proposal is configured or executed by this sprint.

### Exact later publication procedure — NOT EXECUTED

1. An authorized operator obtains fresh read-only project/API metadata for the
   exact team and both project IDs. Review all repository links, Preview and
   production branch rules, deploy hooks/CI triggers without exporting hook URLs,
   effective config/ignore precedence, system-variable availability, names/types/
   scopes of environment settings, protection and current deployments. No secret
   values are needed. Resolve the Staging connector access gap first.
2. With **separate explicit customer-settings approval**, preserve the existing
   Dashboard ignore value and source precedence evidence. If no prior rule exists
   and source cannot override it, install only the exact command above in the
   **customer** project. This does not alter Production branch or root schedules.
   If a rule already exists, review a composed rule before any change; never
   overwrite it. Independently verify effective customer foundation/Preview skip
   and main/Production preservation. The incoming Git revision must contain the
   helper; it is not present in the currently remote accepted baseline.
3. Keep Staging Git automation and cron disabled, zero schedules, proof disabled
   and registries empty. No auto-deployment must activate the proof or inherit
   customer credentials. Verify deployment metadata belongs to the exact project.
4. Run `node scripts/deployment-isolation-checks.mjs` locally. Build a secret-free
   receipt matching the tested structure in that script from the real reviewed
   metadata; **do not use its synthetic receipt as live evidence**. Call the pure
   `evaluatePublicationGate(receipt, { candidateSha, remoteSha, now })` exported by
   `scripts/publication-gate.mjs`. Every missing field, stale (>15 minutes)/future
   observation, changed SHA, effective config mismatch or unapproved side effect
   blocks. Compare fresh `git ls-remote origin refs/heads/codex/broker-sync-foundation`
   against the exact approved remote SHA; require a clean secret-scanned source
   inventory. The gate returns fixed blocker codes and has no cloud/push executor.
   A receipt is a reviewer attestation, not cryptographic proof or an authority to
   run any command. Current incomplete metadata produces **NO-GO**.
5. Obtain separate approval for the exact local SHA, GitHub CI effects and verified
   customer skipped-build metadata. Only then publish with the narrowly scoped
   `git push origin HEAD:refs/heads/codex/broker-sync-foundation`. No PR, merge,
   force-push, deploy or branch change is implied. Recheck remote SHA and both
   project events. Require no customer READY deployment from the new SHA and no
   Staging schedule or deployment activation. A skipped event is not a deployment
   of application runtime, but it and CI remain observable publication effects.
6. On any unverified consequence, **stop before push**. After an unexpected build,
   stop further publication and use only a separately approved project-scoped
   cancellation/rollback response; never automatically revert Git or customer
   Production. Preserve evidence. Restore the saved Dashboard rule only when
   explicitly approved and when no further foundation push can bypass isolation.
   Do not remove the isolation rule as an automatic post-push cleanup action.

The fixed customer root-config digest is normalized SHA-256
`029aab74a8f285c0bbf601d4651c346732dd48b18555fc512a8b6acfbf0f4e69`;
the ten cron definitions are unchanged. This intentionally narrow evaluator does
not assert that every possible Vercel policy is supported. An operator-approved
different isolation strategy needs its own reviewed evidence/tests rather than
falsifying this receipt. No publishing exception is granted by passing local
tests.

Authoritative behavior checked 2026-10-21:
[branch deployment defaults and rule precedence](https://vercel.com/docs/project-configuration/git-configuration),
[Dashboard skip exit semantics](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel),
[source ignoreCommand precedence](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand),
[genuine build system metadata](https://vercel.com/docs/environment-variables/system-environment-variables).

Keep customer root `vercel.json` and ten schedules unchanged. The 22B isolated
artifact required the exact Staging config materialized at artifact root and a
complete source whitelist; `--local-config` alone did not prove remote cron
registration. Preserve genuine build/revision identity; do not spoof system
variables. No active cron configuration or activation receipt belongs in the
normal shared-source checkpoint.

## 22D internal real-account pilot: executable approval checklist

Engineering can rehearse every control with synthetic fixtures now. Actual
execution remains **not authorized** until all gates below are signed off.

### Before connection

- Business/provider owner records 22C acceptance for the exact Commercial model,
  broker, account types, region, read-only access and budget; no TEST/Sandbox
  attestation is reused as real-account approval.
- Privacy/counsel owner approves pilot-specific notices, processing terms,
  purposes/retention and participant information; participant gives informed
  consent/acknowledgement as appropriate to the approved lawful basis. Consent
  does not replace other required legal grounds or approvals.
- User explicitly authorizes this real-account pilot, exact environments and
  participant/account scope. Provision secrets through the separately approved
  secure mechanism. No real credentials in fixtures, logs, exports or chat.
- Named operator covers connection, collection, reconciliation and shutdown;
  second verifier has read-only durable-state access. Budget, cadence, finite
  retry/escalation policy, alerts and emergency credential contacts are approved.
- Read-only provider connection evidence is checked independently; deny trade,
  `trade-if-available`, transfers, manual refresh and add-ons. Reject unexpected
  owner/provider/institution/account identity or environment before job claim.
- Server admission requires existing subscription entitlement **and** explicit
  cohort approval; missing configuration, expiry, revoked membership or kill
  switch denies admission. No browser-supplied owner/cohort authority.

### Observe and reconcile

- Record exact source revision, artifact/configuration hash, deployment/project,
  approved identity receipt, operator window and one bounded collection plan.
  Never claim local/manual execution as scheduled hosted evidence.
- Compare account/position/cash/activity identities and counts; currencies,
  quantities, provider values, timestamps and freshness; resolve differences
  without editing financial facts to force equality. Unsupported/unmapped assets
  remain visible and zero differs from unknown.
- Check one account to one connected Portfolio, idempotency and no manual holdings
  copies; All Investments inclusion/no-dedupe and cash/concentration safety.
  Preserve canonical four statuses, source provenance and history availability.
- Ordinary Portfolio/Dashboard/Ask/Notifications must read normalized state, not
  invoke a broker. Provider prices remain account evidence, not global quotes.
- Rehearse timeout/revocation/error behavior synthetically first; last-good facts
  survive with honest stale/error labels. Verify no credential/raw payload or
  sensitive identifier leaks into customer output, AI context or telemetry.

### Stop, reconcile and hand off

Unexpected permission, identity, disclosure, budget, validation/promotion error,
uncertain acknowledgement or missed operator window stops new admission and
further scheduling. Do not automatically retry or enqueue another proof.
Disable the relevant schedule/worker activation before deployment changes;
independently verify stopped configuration, jobs/leases, last-good facts and
customer Production unchanged. Disconnection, Portfolio removal, credential
revocation and data erasure are distinct approved actions, not automatic cleanup.
Retain only approved sanitized evidence and escalate any security incident under
the approved procedure; do not destroy evidence or invent retention periods.

**22D complete:** explicit approval plus observed real read-only pilot,
independent durable reconciliation, accepted limitations and verified stop. A
successful Sandbox run or synthetic rehearsal cannot close 22D.

## 25 controlled-beta backlog and activation criteria

| Can implement/test now, default off | Must be satisfied before real activation |
|---|---|
| Trusted per-owner cohort policy, expiry/revocation and global admission stop | Named approved cohort, jurisdiction, size/cost/support owners; existing entitlement semantics unchanged |
| Synthetic owner export and lifecycle dry-run contracts; no destructive executor | Approved rights/retention/backup/hold policy and verified authenticated operational workflow |
| AI field allowlist and synthetic secret/identity/provenance tests | Processor/model routing/terms, lawful sharing and factual notice decisions |
| Sanitized queue/freshness/failure observations and operator drills | Monitored support/incident coverage, finite retry policy and approved provider quotas |
| Reproducible artifact/target guards, browser/native return fixtures | Publication isolation and deployment approval, migrations reconciled, actual device proof where claimed |

Before beta, require 22C, necessary Stage 24 decisions and successful 22D; pass
the existing accounting/security/identity/history/context acceptance hierarchy
and new hostile-cohort/privacy tests. Confirm field telemetry configuration and
consent decisions; lab budgets do not establish field p75 Web Vitals. Record
kill-switch behavior explicitly: blocking new experimental operations is not
provider disconnect, credential revocation, financial-data erasure or removal of
last-good customer facts. No new participant, paid service or deployment is
authorized by this backlog.

## Single next external handover

### Implemented controls: configuration and limits (not activated)

- New app side effects require `STOCKGPT_BROKER_CONNECTIONS_ENABLED=true`,
  `STOCKGPT_BROKER_ROLLOUT_MODE=cohort`, the current session's existing subscription
  entitlement and exactly one matching trusted server-owned cohort entry. The
  registry is empty. Request fields/JWT user_metadata cannot admit a participant.
- `STOCKGPT_BROKER_ROLLOUT_STOPPED=true` stops new connect/discover/project
  operations. Invalid switch values refuse access. Existing normalized reads are
  retained. Admission expiry and per-operation scope are checked on every request.
- `STOCKGPT_BROKER_SYNC_STOPPED=true` rejects ordinary authenticated cron ticks
  before admin-client creation and job claiming. Invalid present values also stop.
  Absent/`false` preserves the accepted ordinary worker; no flag was configured by
  this sprint. This switch is not an instantaneous cancellation of an existing
  lease/provider request. Platform environment changes may need a new approved
  deployment; verify effective runtime behavior rather than assuming propagation.
- `summarizeBrokerSyncHealth` is a pure operator-summary foundation, not an HTTP
  endpoint. Max 1,000 rows; incomplete input is partial; fields are fixed states,
  counts and coarse freshness buckets only. It neither queries a queue nor
  authorizes an administrator. A future reader must provide trusted scope and
  completeness evidence before publishing a summary.
- Database admission now independently denies **new** connected Portfolio inserts
  unless an exact-owner/account trusted approval and enabled control both hold.
  Migration `20261021224826_protect_connected_portfolio_beta_admission.sql` was
  applied only to verified local Docker PostgreSQL; hosted application requires
  separate migration approval. `broker_rollout_private` is not API-exposed;
  clients cannot inspect or mutate its stopped singleton or empty approval table.
  No approval or enabled state was committed by tests. Existing owner-scoped
  projection lookup, rename/preferences/removal and manual accounting remain
  available. Existing source cannot be converted/remapped through direct DML.
  Control/approval shared locks serialize creation against a committed stop or
  revocation: an already admitted in-flight transaction may complete before the
  stop commits. This is admission control, not sync cancellation, provider
  revocation or erasure. Existing trusted service-role enqueue/promotion ownership
  is unchanged; it is not a claim that every backend operation is cohort-gated.
- Export/lifecycle foundations are not customer rights delivery or deletion
  authorization. Ask's automatic context allowlist does not anonymize financial
  holdings or redact user-authored questions/history. Processor/notice review is
  still required. Free-model fallback and existing AI feature eligibility were
  not silently redefined by this sprint.

Send the sanitized [provider/legal packet](../provider-legal-readiness-assessment.md)
to the business owner for provider confirmation and qualified counsel/privacy
review in parallel. Meanwhile finish the synthetic controls and link their tests
to this checklist. Request one precise 22D pilot approval only after those
decisions and safe publication access are available; do not reopen accepted 22B.

## Execution-ready internal pilot rehearsal

`npm run test:pilot-rehearsal` runs 65 deterministic, network-denied checks using
the existing portal helper, discovery, normalizer, shared worker/validator and
connected facts adapter with injected dependencies. It covers permission/scope,
duplicate ticks, errors, recovery, last-good preservation, disconnect, stop,
sanitized support summaries, unknown valuation/FX and genuine zero. Promotion is
a mock contract, not a new database atomicity claim. The synthetic receipt in
`lib/brokerage/pilot-readiness.ts` always reports `canActivateRealPilot: false`.
It permits one collection and an explicit <=240-second rehearsal budget, not
production request cancellation. No participant is enrolled by this utility.

For 22D, name exactly one consenting internal adult, one approved account,
broker/jurisdiction, `read` permission, time/cost window and attending operator.
Before connection, require written provider clearance and qualified entity,
regulatory/privacy decisions applicable to that specific pilot; approve the
participant information/acknowledgement and broker-derived AI scope. Record exact
identity/permission metadata, then one approved sync, independent account/position/
cash/activity reconciliation, stale/failure/stop checks and verified shutdown.
No-go on identity/permission uncertainty, unknown acknowledgement, cost overrun,
validation failure, missing operator or privacy/processing clearance. Do not retry
an uncertain write or erase last-good records to obtain a passing result.

### Pilot feature exclusions and current provider evidence (22 October 2026)

Trusted pilot cohort membership now denies Portfolio Draft generation/save and
portfolio-aware Ask by default. Separate feature approvals remain empty; an
expired/conflicting participant receipt cannot silently restore AI access.
Normal non-pilot customer entitlements are unchanged. Anonymous Portfolio Draft
generation is rejected. These are server entry-point controls, not regulatory
clearance or a replacement for provider/counsel approval. Never enable personalized
transaction instructions for the pilot.

Public [broker access documentation](https://docs.snaptrade.com/docs/broker-access-guide)
and [Commercial authentication guidance](https://docs.snaptrade.com/docs/personal-vs-commercial)
describe capability and onboarding, not permission for this account. The existing
non-secret Dashboard view shows TEST selected, Build and Production access locked.
The $0 Build label alone establishes neither Personal authentication nor live
broker eligibility. Obtain written confirmation whether this exact Commercial
Build/TEST account may connect one consenting internal Trading 212 participant,
or requires Production application, KYC/payment setup and a different key first.
Do not buy/activate anything to resolve that question without approval.

Trading 212 permission review must exclude order execution and money movement.
Confirm supported Invest/ISA account type and the minimum read scopes with the
provider; documentation with conflicting account-type descriptions is not an
approval. No real provider calls or account connection were made in this sprint.

CSV remains a separate reconstructed manual-state import, not live broker truth.
It now refuses unknown/non-USD execution-price currency, overlapping records,
invalid dates/numbers and ambiguous corporate actions rather than inventing basis.
Complete history and independent reconciliation remain necessary; apparently
plausible partial history cannot always be detected. Unsupported securities cause
non-mutating whole-file refusal, not silent omission. The UI and actions enforce
750 KiB raw UTF-8 / 900 KiB JSON-encoded text without increasing Next's request
limit. Never remove required history merely to fit that budget. This does not
change free/subscriber eligibility or bypass ranking RLS for an unentitled user.

Ready for business-owner review, **not sent**:
[provider enquiry](../drafts/stage22c-provider-enquiry.md) and
[UK legal/privacy brief](../drafts/stage24-legal-review-brief.md).
The latter records the Delaware-LLC versus UK-controller source inconsistency;
formation/registry, operating establishment and contracting/controller evidence
must settle it before notices are changed. Neither draft changes legal wording,
accepts a contract, authorizes real access or provides legal clearance.
