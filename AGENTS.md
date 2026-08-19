# StockGPT Engineering Constitution

This file applies to the entire repository unless a more deeply nested `AGENTS.md` explicitly overrides part of it.

## 1. Next.js version rule

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project may use Next.js APIs, conventions, and file structures that differ from model training data.

Before writing or modifying Next.js application code:

- Read the relevant documentation in `node_modules/next/dist/docs/`.
- Follow the documentation shipped with the installed Next.js version.
- Heed deprecation notices.
- Do not rely on remembered Next.js behaviour when the local documentation can answer the question.

<!-- END:nextjs-agent-rules -->

## 2. Product purpose

StockGPT is investment research and portfolio-intelligence software.

Its purpose is to help users:

- understand stocks and portfolios,
- prioritise research,
- understand portfolio risks and concentration,
- interpret changes in holdings and markets,
- organise portfolio information,
- ask questions about research and portfolio context.

StockGPT is not to become a brokerage execution engine as part of the current architecture.

## 3. Brokerage integration boundary

Current brokerage integrations are strictly READ-ONLY.

Agents must not:

- add order placement,
- add trade execution,
- add order queues,
- request write/trading permissions from brokers,
- add withdrawal or money-transfer capability,
- add endpoints that could execute trades,
- silently broaden brokerage permissions.

Broker integrations may read only the data required for supported portfolio functionality, such as:

- accounts,
- balances,
- positions,
- holdings,
- supported transaction/activity history,
- connection status,
- relevant account metadata.

If a provider supports both read and trading permissions, StockGPT must explicitly request read-only access.

## 4. Provider-neutral brokerage architecture

StockGPT must not be architected around one broker or aggregator.

Broker-facing code should use a provider-neutral domain model so implementations such as:

- SnapTrade,
- Trading 212 direct,
- eToro direct,
- or future providers

can be replaced or added without rewriting the StockGPT portfolio product.

Provider-specific payloads and identifiers must be translated at the integration boundary rather than leaking throughout application components.

## 5. Broker data correctness

Connected brokerage data is sensitive financial data and must be treated as high-integrity data.

Core rules:

- Never replace a known-good portfolio state with a failed, incomplete, partial, or unvalidated sync.
- Preserve last-known-good connected portfolio data when a provider is unavailable.
- Distinguish `last_attempted_sync` from `last_successful_sync`.
- Sync processes must be idempotent where practical.
- Replayed or duplicate provider events must not duplicate portfolio state.
- Do not interpret a provider timeout as an empty account.
- Do not interpret an unsupported security as a zero-value holding.
- Do not silently drop holdings that StockGPT cannot analyse.
- Unsupported assets should remain represented in portfolio totals where reliable value data exists and should be identified as unsupported/tracked-only.
- Connected quantities and broker-reported balances must not become manually editable unless an explicitly designed override system is introduced later.

Webhooks should normally trigger reconciliation/synchronisation rather than being treated as authoritative portfolio truth by themselves.

## 6. Canonical portfolio intelligence

StockGPT must converge on one canonical portfolio-assessment system.

The canonical user-facing states are:

- `on_track` → On track
- `monitor` → Monitor
- `review` → Review
- `urgent_review` → Urgent review

User-facing visual severity should use the agreed restrained traffic-light progression:

- green,
- yellow,
- orange,
- red.

Broker connection state is separate from portfolio assessment state.

Components must not independently invent conflicting recommendation/action vocabularies.

Where relevant, portfolio assessment should be derived from structured evidence such as:

- stock view,
- portfolio fit,
- concentration/sizing,
- change since entry,
- event risk,
- data freshness,
- evidence confidence.

Dashboard, Portfolio Health, alerts, Ask StockGPT, holding detail and related surfaces should consume the same canonical assessment rather than independently recreate it.

Stale or incomplete data must reduce confidence and must not create false high-confidence urgency.

## 7. Financial-language constraint

Do not casually introduce language that turns StockGPT into an execution/recommendation product.

Avoid introducing action-oriented wording such as:

- Buy now,
- Sell immediately,
- Execute this trade,
- Buy £X,
- Sell X shares,
- Trim exactly X%,

unless a future explicitly approved product/compliance change authorises it.

Prefer research-state language and transparent evidence.

## 8. Database and Supabase rules

Database changes must be reproducible.

- Schema changes require committed migrations.
- Do not manually alter the production schema as part of normal implementation.
- Keep generated Supabase TypeScript types in sync with the intended schema.
- Treat migration history and generated types as part of application correctness.
- Normal user-facing server code should use authenticated user-scoped access where possible.
- Service-role access is backend-only.
- Never expose the Supabase service-role key to client code.
- Never trust a user-supplied ownership identifier merely because a route is server-side.
- Resolve ownership server-side.
- RLS must be considered for every new user-owned table.

Before destructive schema changes, document migration/rollback implications.

Current Supabase topology:

- `StockGPT` is the only cloud Supabase project and is the production project.
- Do not create another cloud Supabase project or branch without explicit user approval after disclosing the expected cost.
- After Stage 03 reconciles schema and migrations, normal development database work uses local Supabase with synthetic data.
- Production Supabase may be inspected read-only when necessary for schema reconciliation.
- Local development and Vercel staging must never receive the production `SUPABASE_SERVICE_ROLE_KEY`.
- The `stockgpt-staging` Vercel project remains the persistent web staging environment, but must not receive broad production-database write credentials.
- Production migrations are applied only through the controlled migration process after explicit review and approval.
- Routine local Supabase work must use the project-local CLI and explicitly local commands where the CLI supports a local/linked choice.
- Do not run `supabase link`, `db pull`, `db push`, `migration repair` or `db reset --linked` during ordinary development. Any remote operation requires a separately scoped, reviewed and explicitly approved task.

## 9. Sensitive data and secrets

Never commit, print, expose, or deliberately log:

- broker credentials,
- broker API secrets,
- SnapTrade user secrets,
- SnapTrade consumer secrets,
- Supabase service-role keys,
- Stripe secret keys,
- MFA codes,
- raw authentication payloads,
- refresh tokens,
- other retrievable credentials.

Sensitive external-provider errors should be scrubbed before logging or surfacing to users.

Secrets must remain server-side.

Do not place sensitive information in URLs, browser-visible state, analytics events, client logs, or error messages.

## 10. Production safety

Production is not a development sandbox.

Unless the user explicitly authorises a production operation:

- do not mutate production database data,
- do not mutate production schema,
- do not rotate production secrets,
- do not change production Stripe objects,
- do not connect real brokerage accounts,
- do not deploy directly to production,
- do not merge directly into `main`.

Use branches, previews, staging/test environments and provider sandboxes for implementation.

No agent may create a paid cloud project or resource, enable a paid feature, or materially increase recurring infrastructure cost without explicit user approval after stating the expected cost.

## 11. Git discipline

- Never assume `main` represents the currently deployed production build.
- At the start of work, inspect the current branch and HEAD.
- Do not switch branches, merge, rebase or cherry-pick unless the task explicitly requires it.
- Do not bring newer `main` commits into the broker-sync foundation branch unless explicitly instructed.
- Avoid unrelated changes.
- Keep implementation stages small enough to review.
- Do not rewrite existing history.
- Do not force-push unless explicitly authorised.
- Before finishing a task, report the branch, resulting commit SHA, and working-tree state.

## 12. Error handling

Do not hide operational failure merely to preserve a successful-looking UI.

Avoid patterns where:

- a database write fails but the parent operation reports success,
- an external provider fails and the result is silently converted to empty data,
- errors are swallowed with no useful internal signal,
- partial state is presented as complete state.

User-facing errors may be intentionally generic for security/privacy reasons, but infrastructure failures must still be observable internally.

## 13. Data provenance and honesty

When portfolio values, historical series, inferred activity, reconstructed data, market data or FX data are not exact, preserve that distinction.

Do not manufacture certainty.

Where applicable distinguish:

- provider-reported,
- StockGPT-computed,
- reconstructed,
- estimated,
- partial,
- stale,
- unsupported.

Deposits and withdrawals must not be presented as investment return.

Historical currency conversion must not silently use mathematically inappropriate current FX rates where historical accuracy matters.

## 14. Performance architecture

User-facing requests should not synchronously depend on slow brokerage providers where avoidable.

Preferred architecture:

provider → background sync/reconciliation → StockGPT database/cache → UI

rather than:

UI request → live broker request → page render.

Preserve last-known-good data and use explicit freshness state.

Avoid uncontrolled external API fan-out.

Avoid unbounded queries.

Large portfolio/activity workloads must be paginated or bounded intentionally per account/portfolio rather than by unsafe global caps.

## 15. Motion and responsive UI

StockGPT's authenticated product should feel crisp, coherent and professional.

The motion system must not become scroll-jacking or decorative clutter.

Core rules:

- Native browser scrolling remains the source of truth.
- Do not hijack wheel, trackpad, touch or scrollbar behaviour.
- Do not snap the user between ordinary application sections unless explicitly designed for a particular experience.
- Prefer restrained `transform` and `opacity` animation.
- Avoid layout-changing animation where possible.
- Major surfaces may subtly lift into their natural position as they enter focus.
- Animate the surface/container rather than independently animating every piece of text or financial data.
- Tables, forms, controls and high-density comparison surfaces should use minimal decorative motion.
- Do not hardcode global scroll positions or pixel timelines tied to one viewport size.
- Motion should be element/container-relative.
- Responsive reflow must remain correct if viewport size changes during scrolling.
- Prefer CSS Grid/Flexbox and container-aware responsive design over JS-driven layout measurement.
- Respect `prefers-reduced-motion`.
- Mobile browser chrome, orientation changes, safe areas, split-screen and browser zoom must be considered.

The visual goal is one continuous StockGPT workspace, not disconnected floating widgets.

## 16. Accessibility and interaction

- Do not make information available only through animation, colour, hover or pointer precision.
- Preserve keyboard navigation where applicable.
- Preserve clear focus states.
- Preserve semantic structure.
- Traffic-light status must include a text label, not colour alone.
- Motion reduction must not remove information or functionality.

## 17. Testing and regression policy

Every meaningful bug fix should receive a regression test where practical.

New financial/domain logic should be tested at the logic boundary rather than only through visual snapshots.

New broker logic should eventually cover:

- successful sync,
- partial sync,
- duplicate webhook/event,
- provider timeout,
- rate limiting,
- reconnect,
- revoked/invalid auth,
- unsupported instrument,
- zero holdings,
- multiple accounts,
- multi-currency data,
- disconnect during sync,
- stale-data fallback.

Do not weaken, delete or rewrite tests merely to make an implementation pass unless the expected behaviour itself has been deliberately changed.

When code is modified, run the relevant existing repository checks from `package.json` and any checks required by more specific scoped instructions.

If a check cannot run, report why rather than pretending it passed.

## 18. Scope discipline

Before editing:

- inspect the relevant implementation,
- trace important callers and consumers,
- understand shared types/state,
- identify whether the change affects authentication, subscription, portfolio state, market data, caching, mobile behaviour or external integrations.

Do not perform opportunistic visual redesign or unrelated refactoring during a narrowly scoped task.

However, if the requested change would build directly on a confirmed correctness/security defect, surface that dependency rather than layering new behaviour on top of it.

## 19. Architecture decisions

Do not make consequential product/architecture decisions silently.

If implementation requires an unresolved decision involving:

- user-visible financial semantics,
- ownership/data deletion behaviour,
- broker permission scope,
- provider source-of-truth rules,
- portfolio merging,
- account identity,
- compliance-sensitive wording,
- destructive migrations,
- irreversible data transformation,

stop and report the decision required rather than inventing policy.

## 20. Completion report

At the end of an implementation task, report:

- branch,
- commit SHA,
- files changed,
- migrations added/changed,
- tests/checks run and results,
- assumptions,
- remaining risks,
- manual follow-up required,
- working-tree status.

Do not claim something was tested, deployed, migrated or verified if it was not.
