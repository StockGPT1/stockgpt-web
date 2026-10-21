# Stage 22B local closure checkpoint verification

Date: 2026-10-21. Baseline
`b41f76f3f3cb82613a6bf9d6b66b29e835649018`, branch
`codex/broker-sync-foundation`. This checkpoint consolidates independently
reviewed proof source and sanitized closure/planning documentation. No push,
deployment, cloud setting change or provider call forms part of closure testing.

## Reproducible source scope

Use the committed source and lockfile, Node 24, installed pinned dependencies,
no real environment files and no gitignored local helpers. Build/test in a clean
checkout, not an operational artifact containing secrets. Dependencies must be
inside the build filesystem root: Turbopack rejects an external node_modules
junction. No dependency or build configuration was changed to work around it.

Set `STOCKGPT_EXTERNAL_NETWORK_DISABLED=true`,
`STOCKGPT_BROKER_CONNECTIONS_ENABLED=false` and synthetic
`STOCKGPT_USD_FX_RATES_JSON={"USD":1,"GBP":0.8,"EUR":0.9,"CHF":0.85}`.
Preload `scripts/local-only-network-guard.mjs` with Node `--import` using an
absolute file URL. Remove inherited provider/database/billing/cloud credentials
from the child environment. No `.env.local` is copied into the candidate.

## Local database preflight and completed checks

- Docker endpoint: local Windows Docker Desktop Linux named pipe, not remote TCP.
- Exact container and volume: `supabase_db_stockgpt-web-local`.
- Image `public.ecr.aws/supabase/postgres:17.6.1.159`; PostgreSQL 17.6;
  database `postgres`; system identifier `7692187049475596325`.
- Published database port restricted to 127.0.0.1:54322.
- 48 migrations, tip 20261015160822; zero jobs; expected synthetic rows:
  3 users, 2 Portfolios, 2 connections, 3 positions, 3 cash rows, 2 activities.
- `node scripts/verify-stage22b-exact-claim-local.mjs --allow-local-db-writes`:
  PASS. Actual PostgreSQL privileges, exact ownership, independent post-commit
  duplicate claim, competing workers, queue snapshot race, retry/lease behavior
  and financial/connection preservation. Own fixtures cleaned up; original row
  counts and zero jobs reverified. No migration/reset/seed was needed.
- `npm run db:types:check`: PASS; fresh LOCAL generation matches committed types.
- Local database stopped afterwards; original volume and backup preserved.

## Candidate-source checks

Final results below are from the completed local gate. The static
umbrella includes migration safety/negative tests, schema contracts, proof mocks,
canonical Portfolio/Dashboard/Ask/Notifications, adapter, connection health,
identity, history/All Investments, customer/security source contracts and bounded
performance fixtures. It does not imply a new hosted smoke or full Auth-stack run.

| Command | Final result |
|---|---|
| `npm run test:acceptance:static` | PASS, including proof/adapter/history/identity/customer and 0/10/50/200-position bounded fixtures |
| `node node_modules/next/dist/bin/next typegen` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `npm run lint` (clean candidate) | PASS: 0 errors, 23 existing warnings |
| `npm run build:app` | PASS: Next 16.2.4 production build, 68 static pages; existing middleware deprecation warning |
| `git diff --check` | PASS |

The Portfolio test hierarchy already ran inside static acceptance, so
`build:app` avoided repeating it. The final build ran with the external HTTP(S)
denial preload and credential-free environment. This is lab/build evidence, not
new field performance or provider evidence. Final original-index safety checks
and explicit-file staging precede the local-only commit.

One existing broker log-source assertion initially failed on CRLF source because
its exact anchored regex retained a carriage return. The checkpoint adds only
`trimEnd()` to extracted log lines before the unchanged payload allowlist.
No runtime logging, allowed fields or financial/provider logic changed.

The first clean build attempt also rejected the external dependency junction;
copying the already installed dependencies into the isolated checkout resolved
that harness constraint without a package/configuration change.

Full `test:acceptance` and browser/Auth-stack database acceptance are deliberately
not rerun: the umbrella resets Supabase, incompatible with preserving the
recovered database. Existing accepted evidence is retained; this is a relevant
checkpoint gate, not a claim of a fresh full release matrix.

## Source and operational safety

Root customer `vercel.json`, normal global worker, provider collector/normalizer,
Portfolio calculations and existing RLS remain unchanged. Both Sandbox fixture
approval registries and the one-shot proof approval registry remain empty.
No activated receipt/digest, secret, environment file, operational helper,
archive, raw provider payload, database/backup contents or deployment artifact
belongs in the Git index. Historical sanitized evidence is explicitly superseded
by the final report rather than deleted. Future Git publication needs the
separate deployment-isolation approval in the next-milestone plan.
