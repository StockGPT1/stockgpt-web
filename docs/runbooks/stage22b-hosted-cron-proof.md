# Stage 22B hosted cron proof — completed and stopped

## Accepted closure — 2026-10-21

The native scheduled proof succeeded and shutdown was independently verified.
See [final evidence](../stage22b-final-proof-evidence.md). The preparation-era
instructions below remain historical safety constraints, not permission to
repeat the proof. Current source defaults off with an empty approval registry;
Staging has zero schedules and cron/Git auto-deployment disabled. No further
provider execution is authorised by this runbook.

Migration mapping: reviewed local `20261015160822_claim_exact_broker_sync_proof_job.sql`
is installed in hosted Staging history as
`20261021164515_claim_exact_broker_sync_proof_job`. Do not blindly apply the local
file again, rename historical migrations, or repair remote history automatically.
A future release needs an explicitly reviewed target-specific reconciliation.

Observed packaging caveat: `--local-config` selected the build configuration but
did not alone register the intended remote schedule when root config was absent.
The successful isolated artifact materialized the exact staging-only config at
root `vercel.json`; it never uploaded the customer root schedules. Audit the full
file inventory and verify live schedule definitions with cron execution disabled.
An earlier exact-path ignore allowlist uploaded only 16 root files; it was
rejected before upload and replaced by a directory-aware audited allowlist.
Never commit the activated artifact, receipt, digest or temporary schedule.

Shutdown order: disable project cron execution FIRST, disarm activation, deploy
the stopped artifact, then independently verify READY, zero schedules, disabled
Git automation and unchanged protection. Environment changes alone do not disarm
already-built deployments. Later reuse requires new explicit approval and a
fresh job; never retry a failed or uncertain one-shot run.

## Stop gate

Historical pre-activation gate (superseded by closure above): the proof endpoint is
implemented but activation defaults off and `APPROVED_STAGE22B_PROOFS` is empty.
No admin client, claim or provider request is reachable with the current empty
registry, even if environment flags are accidentally enabled. Never populate the
registry or enable execution without separate independent review and approval.
Mocked execution is NOT evidence of hosted scheduling or provider execution.

The ordinary `/api/cron/broker-sync` route/worker is unchanged. Do not schedule it
for this one-job proof: it defaults to two database-wide claims and cannot select
an approved job. Checking the queue then calling it with limit=1 races with
concurrent enqueue/claim operations. Do not use that workaround.

## Exact scope and isolated config

- Team: `team_eUm0mdcYHHHcNo4D5tMm9cHQ` (`stockgpt1s-projects`).
- Project: `stockgpt-staging`, `prj_AxbNJT8VObcG020Abob7Vu5XhdMo` ONLY.
- Database: `https://oocvbilwiosehfqpzges.supabase.co` ONLY.
- Prohibited: customer project `prj_QzlZVgUZ5qIC5SwYz5k3ThQKkQNo` and
  Production Supabase `rfloxmydpbgyyaesysbv`.

`config/vercel.stage22b-proof.json` contains exactly one daily schedule, at
07:17 UTC, for `/api/cron/broker-sync-proof`. The stopped config contains zero.
Neither changes the root `vercel.json` or its ten schedules. `--local-config`
selects the alternative config; it does NOT select a project. CLI 63.1.2 help
and official docs support explicit `--project`, `--scope`, `--target` and
`--local-config`. `--project` overrides the checkout's existing customer link.
The alternate build command rejects every project except the exact staging ID,
and requires its Production target and foundation branch. This is defense in
depth, not permission to deploy unreviewed code or a guarantee against an
operator deliberately overriding the build command.

Vercel-native crons execute only on Production-target deployments. For this
proof that means the separate NON-CUSTOMER staging project's Production target,
not StockGPT customer Production. Preview/custom targets reject. System project
ID and target metadata must be available at build/runtime; do not set fake system
identity values to get past a failure. `STOCKGPT_STAGE22B_TEAM_ID` is an operator
receipt after project/team verification, not an automatic Vercel identity claim.

## Exact-job DB foundation — local verified; hosted mapping recorded above

Forward migration `20261015160822_claim_exact_broker_sync_proof_job.sql` now
defines the service-role-only RPC below. It was first applied and tested on the
verified isolated local database on 2026-10-16; the separately approved hosted
installation uses the version mapping above. Never migrate another target as
a side effect of deployment.
`claim_exact_broker_sync_proof_job(job_id, user_id, connection_id, provider_id,
external_connection_id, institution_id, external_institution_id, worker_id)`.

Required transaction contract:

1. Fixed empty search_path; schema-qualified objects; EXECUTE revoked from
   public/anon/authenticated, granted only to service_role. No browser RPC.
2. Lock the exact job, then its exact owned connection (same order as promotion).
   Verify all pinned IDs, SnapTrade provider and institution-alias relationship;
   connection must be pending/active. Never match on institution name/ticker.
3. Require job status=queued, attempt_count=0, no started_at/lease, available_at
   <= DB now(). Refuse running, expired running, retryable and completed jobs.
   Also reject completed/error/provider-freshness residue and infinite eligibility
   timestamps. Check for other outstanding queued/running/retryable jobs and
   refuse visible conflicts; terminal history remains untouched. This check is
   a conservative statement-snapshot veto, NOT global exclusion (see below).
4. Lease only that UUID once using DB time, increment to attempt_count=1 and
   return that one row with a fixed 300-second lease. Concurrent/double delivery
   must yield at most one committed lease. A locked/missing/ineligible job returns
   zero rows; invalid inputs, mismatched identities or visible queue conflicts
   raise fixed errors with no identifying detail. A rolled-back claim consumes
   no attempt, as expected for normal transaction semantics.
   Never delegate to the global claim function or fall back to another job.
5. No insert/enqueue, provider call or financial mutation in the claim. Reuse
   existing strict candidate validation and atomic promotion after leasing.

### Atomic guarantees versus operational safeguards

The job is locked by exact UUID with `FOR UPDATE SKIP LOCKED`. Its owned
connection is locked next, matching promotion's job -> connection order. Provider,
institution alias and institution evidence receive shared row locks. The RPC
matches owner, connection, provider UUID/key (`snaptrade`), external connection,
institution UUID and external institution alias against actual database rows.
Names, symbols and caller-provided assertions cannot replace those relationships.
Only that job is updated; no enqueue, financial writes or provider requests.

The service-role caller supplies the expected tuple from a separately reviewed
approval receipt. This RPC is NOT a database approval registry: a privileged
caller can supply another internally consistent tuple. It cannot itself prove
Commercial TEST credentials, read-only portal permission, Sandbox classification,
deployment identity or a trustworthy receipt; those facts are absent from the
current schema and remain external activation gates. The approval registry in
application preparation remains empty, keeping the HTTP endpoint in refusal mode.

At READ COMMITTED the outstanding-job veto cannot see concurrent/uncommitted
inserts or prevent a later enqueue. No predicate, advisory or table-wide lock is
introduced. The **atomic guarantee is exact-job selection and one fresh claim**,
not global queue emptiness, global exclusivity or provider execution exactly once.
The read-only preflight's single-job result is operational evidence only. Quiesce
all other producers/workers under explicit approval during the proof; stop if
that cannot be established. Other normal workers may reclaim an expired lease
or retryable failure because their existing RPC is intentionally unchanged.
One-shot here means this RPC never reclaims an attempted job; it does not disable
normal recovery, privileged writes, or later processing elsewhere.

### Local recovery and PostgreSQL evidence — 2026-10-16

- Docker `desktop-linux` uses the local named pipe, Linux engine. The preserved
  `supabase_db_stockgpt-web-local` volume has matching CLI/compose project labels,
  PG_VERSION=17 and system identifier `7692187049475596325`.
- An owner-only offline tar backup outside Git was verified by extraction and
  byte comparison against the read-only volume before any modifying startup.
  Exact backup location and verification hash remain in protected local recovery
  evidence outside the repository; they are not needed in deployment source.
  The backup and protected verification copy are sensitive local data, NOT source
  review artifacts. Do not upload or commit them.
- Cached image `public.ecr.aws/supabase/postgres:17.6.1.159` ran PostgreSQL 17.6
  directly against that same volume, bypassing init scripts. WAL recovery completed.
  Initial inspection used network=none and default read-only SQL. CLI 2.115.0
  source showed ordinary `start` skips fresh seeding/migration on an existing
  volume but can reconcile extensions; that command was therefore NOT used.
- For the supported CLI migration/type operations the same DB was restarted on
  the standard project bridge, published ONLY at 127.0.0.1:54322, using the same
  volume and DB system identifier. An internal-only bridge initially blocked
  Windows host CLI connections; only that task-created network/container was
  replaced, not data. No volume was deleted or initialized.
- Before migration: three known synthetic seeded users, two synthetic Portfolios,
  two synthetic local broker connections, three positions, three cash rows, two
  activities, zero broker credentials/Vault secrets, zero jobs. All 47 applied
  migration versions matched; only the reviewed exact-job migration was pending.
- `migration up --local` used a separate credential-free local CLI directory
  containing copies of the reviewed config/migrations, not application env files.
  It applied only `20261015160822`; no reset or seed was run.
- `npm run test:stage22b-proof:database` PASSED against actual PostgreSQL.
  The post-commit duplicate test removes unrelated queued work BEFORE the second
  invocation and proves the committed job stays unchanged. The concurrency
  barrier tests competing proof/normal workers; a concurrent unrelated insert
  demonstrates the queue snapshot limitation. Fixture cleanup returned the
  original users/connections/financial counts and zero jobs.

For later reruns, verify this same local DB and migration state first; never reset
or seed to force a pass. With explicit local-test approval and no active workers:

```text
npm run test:stage22b-proof:database
```

This explicitly write-enabled test uses only the fixed local Docker container
`supabase_db_stockgpt-web-local` and local `psql`; it cannot take a URL/DSN. It
creates isolated synthetic users/connections/jobs/position/cash fixtures and
removes only its own rows in cleanup. It never loads `.env` or provider secrets.
It covers service-role grants/browser denial, every identity component,
conflicting alias, fresh/ineligible states, nonfinite/future eligibility times,
unrelated jobs, duplicate claims, competing proof/normal workers with an open
transaction barrier, expired leases, normal recovery and unchanged financial
records. A concurrent unrelated insert deliberately demonstrates the global
snapshot limitation rather than pretending to eliminate it. Failure/timeout
requires inspection of local fixtures before any rerun; do not clear unknown jobs.

`npm run test:stage22b-proof` includes deterministic source contracts and the
existing synthetic non-executing endpoint tests; it is now in static acceptance.
Source checks alone are NOT proof of PostgreSQL execution/locking. After migration,
fresh `gen types typescript --local` output from the recovered DB exactly matched
the prepared `lib/database.types.ts` declaration (LF-normalized). No unrelated
type/schema repair was necessary. Standard API/Auth integration scripts were not
run through a newly initialized stack: recovery intentionally started only the
existing PostgreSQL service. Existing broker validation/worker source and mocked
diagnostic regressions were run; do not label these as hosted/provider tests.

## TEST evidence, retries and activation requirements

Flags alone never authorize a job. A separately reviewed receipt must bind the
synthetic job/owner/connection/provider/institution IDs, read-only SANDBOX access
and the previously verified Commercial TEST key pair, plus the exact one or two
Sandbox external account UUIDs. A SHA-256 digest over
JSON([client ID, consumer key]) binds that receipt to the pair without storing
either credential. It does not independently prove that a pair is TEST; that
classification requires trusted operator/provider evidence. Do not generate a
receipt from an arbitrary key and call it TEST. The registry remains EMPTY.

The runtime preparation checks exact URL, rejects contradictory SUPABASE_URL,
requires explicit activation and a finite half-open window of at most two hours.
No real credentials were loaded to test this. Runtime key matching cannot be
used as an oracle: authorization comes first, messages contain fixed codes only.

### Implemented restricted execution — mock coverage plus accepted hosted tick

- Cron authorization precedes full runtime/receipt validation. Only then is the
  execution module imported, and it revalidates before creating its admin client.
  The admin client targets only the exact Staging URL, four approved RPC paths
  and bulk instrument-alias reads: max 64 DB requests, 10s per request, no redirect
  or Auth refresh/persistence. The exact-job claim is the ONLY claim call.
- The proof uses the existing collector, candidate validator and atomic promotion
  RPC directly. It deliberately does NOT import the normal worker/processor,
  whose retryable failure policy and identifying logs are inappropriate here.
- SDK 12.2.7 is runtime version-checked. Its supported `baseOptions.adapter`
  replaces the Axios network transport with a bounded native-fetch adapter.
  Non-success responses, including 429, throw a fixed non-Axios error; actual SDK
  mock regressions prove the built-in AxiosError/429 retry branch is not entered.
- GET-only endpoint allowlist: `/authorizations`, `/accounts`, and approved account
  `/positions/all`, `/balances`, `/activities`. The first response must prove the
  exact connection, external institution, stable `SANDBOX` slug, type=read and
  disabled=false. Before financial endpoints, account discovery must exactly
  match the reviewed receipt. Other account IDs and endpoints reject before send.
- Provider limits: 32 requests maximum; 120s collection deadline; 10s each request;
  4 MiB per response, 16 MiB cumulative. Redirects are manual/rejected; no request
  or SDK retry. Existing activity pagination/normalization/freshness checks remain.
- Overall execution aborts at 180s (or earlier activation-window expiry). Route
  maxDuration=240s; DB lease=300s. DB and provider signals bound in-flight work.
  A single sync uses several bounded reads, NOT one provider request.
- Duplicate/missing/ineligible claims return `not_claimed` without provider work.
  Definite collection/validation failure records terminal failure (`retryable=false`)
  without promotion. Unknown claim/promotion/failure acknowledgements return
  `indeterminate` and require inspection: no retry or compensating financial write.
- Runtime logs/response expose fixed codes/status and claimed count only, never
  IDs, secrets, URLs, raw errors/provider bodies or financial values. Mock tests
  cover approval/scope rejection, wrong account/connection/institution, trade and
  non-Sandbox denial, 429/network/redirect rejection, budgets, abort/deadline,
  duplicates, incomplete cash, promotion uncertainty and last-good preservation.

Before any activation, independently authenticate the Staging-only service-role
credential, re-confirm TEST classification and exact Sandbox receipt, review this
code, and quiesce all other queue producers/workers. No real credential was loaded
or provider request made in local testing. Do not infer TEST classification from
key format or flags. Do not reset an attempted job to reuse this proof.

Ordinary queue backoff is capped but total attempts are not. A broader max-attempt,
dead-letter and monitoring policy is a separate decision; no normal retry policy
was changed here. The current empty registry makes ZERO provider requests even
if cron auth and environment flags are present.

## Historical deployment procedure — completed once; no rerun authorised

The approved 2026-10-21 execution and shutdown are recorded in final evidence.
The procedure below is retained for audit, not an active instruction. Any future
use requires new explicit approval and fresh identity, receipt and job checks.

1. Review the complete diff; approve the forward migration/one-shot boundary,
   transport bounds, TEST receipt and exact synthetic job. Pass real local DB
   concurrency/ownership tests and the accepted application gates. Record the
   final approved commit SHA; preserve existing evidence and encrypted files.
2. Read-only inspect exact team/project, current staging deployment/branch,
   protection, automatic Git-deployment behavior, billing and function limits.
   Verify that staging-only configuration cannot be superseded mid-proof by an
   automatic Git deployment using the root config. STOP on ambiguity.
3. With separate credential-activation approval, configure required values ONLY
   in stockgpt-staging's Production target. Metadata-only inventory: CRON_SECRET,
   SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, SNAPTRADE_CLIENT_ID,
   SNAPTRADE_CONSUMER_KEY, STOCKGPT_ALLOW_SNAPTRADE_SANDBOX and the proof settings
   read in prepareStage22bProof. Secrets must be Secret type; no env pull/run,
   plaintext dumps, command-line credential arguments or copying customer values.
   Keep proof activation false initially. Disable unrelated legacy cron schedules
   BEFORE adding credentials, under separate approval; credentials could make
   those news/email/market jobs live. No Stripe/email/paid-provider credentials.
   Non-secret proof settings are STOCKGPT_STAGE22B_PROOF_ENABLED (false until
   approval), STOCKGPT_STAGE22B_TEAM_ID (exact team above),
   STOCKGPT_STAGE22B_KEY_CLASSIFICATION (commercial_test),
   STOCKGPT_STAGE22B_BROKER (SANDBOX), STOCKGPT_STAGE22B_JOB_ID (reviewed UUID),
   STOCKGPT_STAGE22B_NOT_BEFORE and STOCKGPT_STAGE22B_EXPIRES_AT (reviewed UTC
   window). Do not substitute operator-set values for missing Vercel system
   metadata. The service-role key must be confirmed as staging-only separately.
4. Verify exact staging URL and credential authentication with a separately
   authorized sanitized preflight. Verify exact Sandbox identity, one globally
   outstanding eligible job, all previous terminal failures preserved. Do not
   requeue or manufacture a job without separate approval.
5. Establish supported Vercel-native scheduled access through existing Deployment
   Protection. CRON_SECRET authenticates the app, not the platform protection
   layer. Do not disable protection, mint bypass credentials or test by calling
   the worker. Stop for platform guidance if native delivery cannot be verified.
6. Confirm billing: crons are included, Function usage is metered. Hobby daily
   timing may vary within an hour; Pro/Enterprise allows minute scheduling. Daily
   07:17 UTC is illustrative; approve the date/window and precision before use.
   No new plan/add-on/resource is authorized by this document.
7. After explicit deployment/activation approval, use the pinned CLI with exact
   project scope; DO NOT rely on .vercel/project.json (linked to customer web).
   The command template is:

   ```powershell
   npx vercel@63.1.2 deploy --project prj_AxbNJT8VObcG020Abob7Vu5XhdMo --scope stockgpt1s-projects --target production --local-config config/vercel.stage22b-proof.json --non-interactive
   ```

   This template alone is insufficient: apply the audited artifact-root packaging
   requirement documented above. Do not use --prebuilt from a root-config build, --force,
   --debug, --env/--build-env credential arguments or a different project. Check
   the resulting project/deployment ID, Git SHA/branch, target, runtime settings
   and live cron list: exactly the one proof path, never inherited legacy jobs.
8. Await ONE genuinely scheduled tick. Do not manually GET the route, use the
   Dashboard Run button or a local runner as scheduling proof. Evidence must link
   the cron schedule/time and deployment's sanitized request/runtime log with
   authenticated handler entry, one exact claim, outcome and durable staging
   job/financial evidence. HTTP 200 alone is not proof; require succeeded with
   claimed=1 and independent durable verification. Keep identifiers minimal;
   never log headers, keys, URLs bearing tokens, raw errors/payloads or finances.
9. Immediately disable project-wide cron execution FIRST, then disarm activation
   and the temporary schedule under approved operations. Redeploy the same reviewed code to the same staging project with
   config/vercel.stage22b-stopped.json using the same explicit flags. Verify live
   crons=[], no second claim and preserved job/history. A timeout may have written
   data: inspect only, never retry/requeue. If shutdown is uncertain, STOP and
   escalate; do not claim proof completion.

## Stop / rollback

Never roll back to a deployment whose config restores the ten legacy schedules
while staging credentials are active. Prefer disarming activation and deploying
the stopped config. Do not delete successful broker data, secrets or failure
history as cleanup. Recheck that the customer project, customer cron config and
Production Supabase remain untouched. Record the final stopped deployment and
schedule state, financial preservation and any unresolved provider/privacy gate.
Do not restore automatic Git deployments until a reviewed configuration strategy
prevents the root schedule matrix from being reactivated with these credentials.
Any change to staging auto-deployment or credential availability needs its own
explicit operator approval; this preparation makes neither change.

## Local evidence and limitations

### Cumulative candidate inventory (against accepted HEAD)

The 17 reviewed implementation files below include the preserved earlier
preparation. Closure additionally includes sanitized historical/final evidence,
the milestone plan and verification record. Encrypted files and gitignored
helpers are excluded. Historical evidence is preserved with a superseding link.

```text
app/api/cron/broker-sync-proof/route.ts
config/vercel.stage22b-proof.json
config/vercel.stage22b-stopped.json
docs/implementation-status.md
docs/runbooks/stage22b-hosted-cron-proof.md
lib/brokerage/providers/snaptrade/proof-transport.ts
lib/brokerage/stage22b-execution.ts
lib/brokerage/stage22b-proof.ts
lib/database.types.ts
package.json
scripts/stage22b-build-guard.mjs
scripts/stage22b-exact-claim-source-checks.ts
scripts/stage22b-execution-checks.ts
scripts/stage22b-proof-checks.ts
scripts/verify-stage22b-exact-claim-local.mjs
supabase/migrations/20261015160822_claim_exact_broker_sync_proof_job.sql
tests/database-schema-contract.ts
```

Diff summary: one new exact-job RPC, compatible types/contracts, opt-in local DB
tests, disabled receipt-gated route orchestration, proof-specific bounded SDK/DB
transport, mocked execution tests and acceptance/runbook updates. The two alternate
cron configs/build guard remain unchanged from preparation. Customer vercel.json,
normal worker/claim/failure/promotion, provider collector/normalizer and Portfolio
financial calculations were NOT changed. Local PostgreSQL was stopped cleanly
after verification; its container, original volume and offline backup are retained.

### Historical pre-activation quality gate

- PASS: real local PostgreSQL exact-claim suite; fresh local-generated type
  comparison; migration safety and negative cases; broker worker/diagnostic source
  and mocked validation regressions; complete `test:acceptance:static`; final
  focused proof/execution suite; Next typegen; `tsc --noEmit`; changed-file lint;
  production Next 16.2.4 build (68 static pages); `git diff --check`.
- The production build used a local-only preload outside Git to prime Next's env
  cache from an empty directory, a minimal child environment with synthetic keys,
  and the existing non-local HTTP(S) denial guard. Preflight verified zero loaded
  env files. No `.env.local` credentials were loaded, and no provider network smoke
  is implied. That synthetic `.next` build is a test artifact, not a deployment.
- Normal `npm run lint` remains blocked by six pre-existing errors in the
  gitignored `.stage22b-local/disable-network.cjs` helper: line 5 has one
  `@next/next/no-assign-module-variable` and one `no-require-imports`; lines 8,
  10, 11 and 14 each have one `no-require-imports`. There are 23 existing warnings.
  No lint rule/config/helper was changed to hide this. Candidate-source lint is
  separate from that normal-command failure. A diagnostic whole-source lint run
  excluding only `.stage22b-local/**` passed with 0 errors and 23 warnings.
- At that local-only checkpoint no full DB-reset acceptance, new API/Auth stack,
  browser journey, hosted invocation or real provider test was run. The financial fixtures were
  preserved; no unrelated migrations or destructive seeding were used.

`npm run test:stage22b-proof` uses synthetic configuration/IDs/keys, injected time,
in-memory requests and network denial. It tests authorization, scope/evidence
rejection, single-job eligibility, no record mutation, safe logs and byte-for-byte
preservation of root cron config. It does NOT test a real DB claim, provider,
Deployment Protection, deployment or scheduled invocation. The full acceptance
command resets/writes local Supabase; it must not run during this code-only task.

References checked: Vercel CLI global options (local-config and project precedence),
CLI 63.1.2 deploy --help, Vercel system environment variables, and cron quickstart.

- https://vercel.com/docs/cli/global-options
- https://vercel.com/docs/environment-variables/system-environment-variables
- https://vercel.com/docs/cron-jobs/quickstart
- https://vercel.com/docs/cron-jobs/usage-and-pricing
