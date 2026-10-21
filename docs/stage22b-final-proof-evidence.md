# Stage 22B final hosted Sandbox evidence

Accepted 2026-10-21. Source baseline: `b41f76f3f3cb82613a6bf9d6b66b29e835649018`,
branch `codex/broker-sync-foundation`, plus the reviewed uncommitted proof source.
This report preserves the completed operational evidence; closure work does not
repeat provider calls or inspect customer Production.

## Scope and identity

- Vercel team `team_eUm0mdcYHHHcNo4D5tMm9cHQ`.
- Separate non-customer project `stockgpt-staging`, `prj_AxbNJT8VObcG020Abob7Vu5XhdMo`.
- Supabase Staging `oocvbilwiosehfqpzges` only.
- Dashboard TEST environment and Commercial API-key model verified; local Client
  ID matched without disclosure. The exact Sandbox connection was active/read-only.
- Consumer-key validity was established by the authorised read-only metadata
  check and successful native scheduled read-only collection. No key values,
  provider user secrets, raw payloads or portal URLs belong in this report.

## Native scheduled execution

| Evidence | Result |
|---|---|
| Proof deployment | `dpl_Bx4EYiXv3JTZVWpQdRg8Xip79rn4` |
| Exact fresh job | `bbc65b01-22d1-478c-95f5-1bf8fa979794` |
| Scheduled window | 2026-10-21 18:00 UTC / 19:00 UK BST |
| Native request | GET `/api/cron/broker-sync-proof`, HTTP 200 |
| Request timestamp | 2026-10-21T18:00:31.161Z |
| Request ID | `hdg65-1792605631161-6cac49aad25c` |
| Database start / completion | 18:00:32.082334Z / 18:00:36.707940Z |
| Result | succeeded; claimed=1; attempt_count=1; no error; lease cleared |
| Provider freshness | 2026-10-21T18:00:33Z |

No manual endpoint request, local worker invocation or Deployment Protection
bypass substituted for the native scheduled invocation.

## Durable reconciliation

- 2 accounts, 12 positions, 2 cash balances and 35 activities.
- Provider-price-based USD positions: 71,625.85064; cash: 37,500.
- Combined displayed value: **$109,125.85**, including **$37,500 cash**.
- Position and cash financial snapshots matched the approved before-state.
- Position/activity canonical instrument IDs remained null. Synthetic broker
  facts were not promoted as verified real-market identities.
- Manual holdings, ledger and Portfolio rows remained unchanged. Earlier four
  jobs remained unchanged, including three terminal failures. Final queue:
  two succeeded, three terminal failures, zero outstanding.
- Position/cash/activity ownership violations: zero. Existing connected
  Portfolio and All Investments values remained intact; no manual copies,
  double counting or invented performance.

## Shutdown independently verified

- Cron execution disabled immediately after success, before stopped deployment.
- Activation read back false; original source approval registry remains empty.
- Final stopped deployment `dpl_5AFJKiBbR6tZhHaFBQpgSF9MPnzY`: READY.
- Submitted 18:00:48.399Z; independent verification 18:03:39.170Z.
- Zero registered schedules; automatic Git deployments disabled; Deployment
  Protection unchanged.
- Customer Production remained `dpl_H4NwgfBnaw7kXLyP8c6PVKok31Ax`, unchanged.
- The original worktree's 1,019 file hashes and Git status were preserved during
  operations. The later closure checkpoint contains no activated artifact.

## Migration and recovery provenance

Reviewed local migration:
`supabase/migrations/20261015160822_claim_exact_broker_sync_proof_job.sql`.
Hosted Staging history records:
`20261021164515_claim_exact_broker_sync_proof_job`.
These represent the same reviewed function, not two migrations to replay.
Service-role-only execution was verified. Future target releases must review
this version mapping; no blind replay or automatic history repair.

The original PostgreSQL 17 volume was backed up offline outside the repository
and recovered without reset/reseeding. Real local ownership, concurrency,
post-commit duplicate, privilege, lease and financial-preservation tests passed;
generated local types matched. Backup contents and credentials are excluded.

## Evidence boundaries and remaining gates

Real evidence covers the Self-directed Sandbox and one native hosted tick.
Cash-only/no-transactions/no-accounts, hostile identities, timeouts and failure
preservation have deterministic local/mock evidence; selector-dependent provider
scenarios and live reconnect are not claimed as externally exercised. SnapTrade's
documented selector was absent on two live test-key portal attempts.

No trading, manual refresh, paid add-on, real brokerage or customer Production
operation occurred. Stage 22C commercial/security readiness and Stage 24 privacy/
legal decisions remain required before separately approved Stage 22D real-account
testing. Stage 22B success does not itself approve production keys or beta users.
