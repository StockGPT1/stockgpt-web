# Supabase migration release checklist

## Change identity

- Migration name and timestamp:
- Git commit SHA:
- Author:
- Reviewer:
- Production operator:
- Affected tables/functions/policies:

## Risk review

- Data or backfill impact:
- Destructive DDL/data-loss assessment:
- Lock/table-rewrite assessment:
- Auth/RLS/grant impact:
- Runtime compatibility during rollout:
- Rollback or forward-fix plan:

## Local and staging evidence

- Clean local reset result:
- Synthetic seed/Auth/RLS verifier result:
- Generated-type drift result:
- Database contract and migration-safety results:
- TypeScript/test/lint/build results:
- Isolated staging result, or reason not applicable:

## Production approval and release

- Pre-release migration-status evidence location:
- Production dry-run pending versions:
- Explicit production approval and approver:
- Production apply timestamp:
- Production operator:
- Post-release migration-list result:
- Post-release application smoke/health result:
- Evidence/log location with secrets removed:

## Recovery notes

- Rollback/forward-fix decision:
- Follow-up owner and deadline:
