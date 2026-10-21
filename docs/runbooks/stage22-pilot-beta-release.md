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
| Accepted local checkpoint | `53a4ab672ccdebf2887693e5543f55cf81daefe5`; not pushed |
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
publication prerequisite.

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

Preferred proposal for later explicit approval: a **customer-project-only**
Ignored Build Step that skips `codex/broker-sync-foundation`, while preserving
any existing ignore rules and all other branches. The branch predicate alone is
`node -e "process.exit(process.env.VERCEL_GIT_COMMIT_REF === 'codex/broker-sync-foundation' ? 0 : 1)"`.
An operator must first inspect/compose the effective existing command, verify
that root `ignoreCommand` does not override it and test both foundation/main
outcomes without uploading code. Do not blindly replace an existing command.
Repository `git.deploymentEnabled` is shared configuration, not inherently a
customer-project-only isolation setting. A skipped build may still create Vercel
metadata and GitHub CI; this does not promise a push has zero side effects.
Nothing in this proposal is configured or executed by this sprint.

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
- No new DB policy/migration was introduced. The existing authenticated
  `create_connected_portfolio` RPC remains directly usable for an owned normalized
  account. App gates protect registration/discovery/projection routes; **do not
  describe them as database-wide cohort enforcement**. Resolve the database
  admission requirement explicitly before any real beta activation.
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
