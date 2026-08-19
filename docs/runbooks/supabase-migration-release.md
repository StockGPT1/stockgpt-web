# Supabase migration release runbook

## Purpose and authority

This runbook governs every StockGPT schema change after the Stage 03 canonical baseline. It defines a manual, approval-gated, forward-only process. It does not authorise any production operation by itself.

The project-local Supabase CLI pinned in `package.json` and the files under `supabase/migrations/` are the implementation source of truth. Remote Supabase records applied migration versions in `supabase_migrations.schema_migrations`; normal `db push` applies only versions not already recorded.

The Stage 03 history consists of 26 immutable files:

- the first 25 are explicit production-history alignment markers;
- `20260709230153_add_portfolio_objective_preference.sql` is the squashed current-state baseline;
- every future migration must use a new 14-digit timestamp strictly greater than `20260709230153`.

The hashes in `supabase/migration-baseline-manifest.json` protect this compatibility history. Never edit, delete, rename or replace those files after Stage 03.

## Environment roles

### Local

- Local Supabase is the canonical development, reset and type-generation environment.
- It uses the checked-in migrations and deterministic synthetic seed.
- `npx supabase db reset --local` is allowed and intentionally destructive only to the local database.
- Production credentials and production data are neither needed nor permitted.

### Staging or preview

- An isolated, non-production Supabase project or branch may validate migrations when one is available and explicitly approved.
- Use synthetic or test data only. Never copy production financial data into it.
- A remote reset is permitted only after a human confirms that the exact target is disposable.
- This repository proves a Vercel web staging project exists; it does **not** prove that a hosted Supabase staging project or branch exists.

### Production

- Production receives reviewed forward migrations only.
- Never seed, reset or casually repair migration history.
- Every mutation requires explicit human approval after local and applicable staging evidence is reviewed.
- The exact remote authentication/linking mechanism is operator- and environment-specific and must not be stored in this repository.

## Normal future schema-change workflow

1. Start from an approved Git branch and verify branch, HEAD, upstream and clean status.
2. Create a new migration with `npx supabase migration new <descriptive_name>`.
3. Confirm its timestamp is strictly greater than `20260709230153`.
4. Do not edit any Stage 03 baseline or history-marker migration.
5. Implement forward SQL in the new migration. Generated types must follow the migration, never substitute for it.
6. Run `npx supabase db reset --local` with the synthetic seed enabled.
7. Run `node scripts/verify-local-supabase-fixtures.mjs` to verify schema, seed, Auth, entitlement and RLS behaviour.
8. Regenerate `lib/database.types.ts` from local Supabase with `npm run types:gen:local`.
9. Run `npm run db:types:check`.
10. Run `npm run test:database-contract`.
11. Run `npm run db:migrations:check` and `npm run test:db-migrations`.
12. Run TypeScript, relevant tests, tracked-source lint and the production build.
13. Review the migration for destructive DDL, locks/table rewrites, backfills, RLS/grant/auth changes, data-loss risk, runtime compatibility during deployment and its rollback or forward-fix strategy.
14. Validate on an isolated staging/preview database when one is available and appropriate.
15. Review the complete Git diff and record results in the release checklist.
16. Obtain explicit release approval.
17. The production operator performs a dry-run against the verified production target.
18. Inspect the exact pending migration list. Only after a second explicit approval may the operator apply it.
19. Re-check migration history and application health, then preserve release evidence.

There is deliberately no repository script that links to or mutates production.

## Migration review checklist

Before approval, answer all of the following:

- Is the change additive and backward-compatible where practical?
- Could it lock or rewrite a large table?
- Does it delete, truncate, reinterpret or irreversibly transform data?
- Is a backfill bounded, restartable and observable?
- Can old and new application versions coexist while the release rolls out?
- Are rollback and forward-fix choices documented separately from code rollback?
- Do all new public tables have intentional grants and RLS?
- Are functions, triggers, policies, indexes, constraints and generated types included?
- Do local reset, synthetic seed and ownership-isolation checks still pass?

## Production release procedure

Production release is an operator action, not an agent default. Before any remote command:

1. Confirm the intended production project identity through the operator's trusted environment.
2. Record the exact Git SHA being released.
3. List the migration files included and confirm all timestamps exceed the Stage 03 tip.
4. Confirm local gates and applicable isolated staging checks passed.
5. Capture the current remote migration-status output for evidence.

> **REMOTE CONNECTION — DO NOT RUN DURING ORDINARY DEVELOPMENT.** The operator must use the separately approved authentication/linking mechanism, verify the target identity, and avoid exposing credentials in terminal output or logs.

The operator then runs the non-mutating preview:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

Inspect the exact pending versions and SQL files. Stop if the list differs from the approved release or includes any Stage 03 baseline file.

> **PRODUCTION MUTATION — EXPLICIT HUMAN APPROVAL REQUIRED AT THIS POINT.** The next command changes the production database. Never add `--include-seed`, never automate it from arbitrary branches, and never run it merely because the dry-run exited successfully.

Only the approved production operator may then run:

```bash
npx supabase db push --linked --skip-vault
```

Afterward:

1. Capture `npx supabase migration list --linked` again.
2. Confirm only the approved versions were added.
3. Run the approved application smoke and health checks.
4. Record operator, time, Git SHA, before/after migration lists, dry-run output and smoke results in the release checklist or release record.

The linking/profile/credential steps are intentionally not prescribed here. They must be separately scoped to the operator environment and exact project.

## Forward-only policy

- Never edit an already-applied migration to change production behaviour.
- Correct an applied change with a new reviewed timestamped forward migration.
- Never delete or rename a migration recorded by production.
- The 26 Stage 03 baseline/history-marker files are immutable compatibility history.
- Do not rewrite the squashed baseline for future feature work.
- Regenerate and commit database types after the migration proves the schema locally.

## Failed deployment and rollback policy

- Database rollback is normally another reviewed forward migration. Application rollback and database rollback are separate decisions.
- Prefer additive, expand/contract changes so old and new application versions remain compatible during rollout.
- Phase destructive changes and large backfills where practical; avoid coupling a long backfill to blocking DDL.
- If a migration partially fails, first inspect the actual remote schema and migration ledger. Do not blindly retry or paste SQL into the Dashboard.
- Preserve failure output and before/after evidence before deciding on recovery.

`migration repair` changes migration-history metadata; it does not make the schema match the ledger. It may be considered only when the ledger itself is proven incorrect, after exact diagnosis, backup/evidence capture, explicit human approval, and a documented before/after history plus recovery plan. It is never a convenience for turning a red status green. This runbook intentionally provides no repair command.

## Remote reset policy

> **`supabase db reset --linked` MUST NEVER be run against production.**

It may be used only against an explicitly disposable non-production environment after the operator verifies the exact project identity and accepts total data loss. Ordinary development uses `npx supabase db reset --local`.

## Production data and seeds

- Never apply `supabase/seed.sql` to production.
- Never copy the synthetic local fixtures into production.
- Production backfills belong in reviewed forward migrations or separately reviewed controlled jobs.
- Large backfills should be decoupled from blocking DDL where appropriate.
- Never copy real production financial data into local developer environments merely to test migrations.

## RLS and security review

For every migration touching user-owned data, review and test:

- whether RLS is enabled;
- policy names, commands and target roles;
- `USING` and `WITH CHECK` independently;
- grants and service-role-only surfaces;
- every `SECURITY DEFINER` function, including whether it is necessary;
- an explicit safe `search_path` for privileged functions;
- `auth.uid()` ownership checks;
- cross-user isolation with normal authenticated sessions;
- generated database types;
- the synthetic seed and RLS regression verifier.

New public tables must receive explicit grants appropriate to their Data API exposure rather than relying on platform defaults.

## Broker-era rule

No broker table containing user financial or account data may ship until its ownership model is explicit, RLS is defined and tested, provider credentials are absent from public client-readable tables, generated types are refreshed, local and applicable staging migration proof passes, and the change is a new forward migration. Broker integrations remain read-only and must never receive trade-execution permission.

## Release evidence

Copy `docs/runbooks/templates/supabase-migration-release-checklist.md` for each release. Store the completed record in the approved release/change-management location without credentials, production data or secret output.
