# Stage 22B — hosted Sandbox return-flow evidence

> Historical 2026-10-07 diagnostic evidence, preserved unchanged below. Its
> blocked verdict is superseded by [2026-10-21 final proof evidence](stage22b-final-proof-evidence.md).
> Historical pilot-stage naming does not override the current 22C readiness / 22D pilot split.

Date: 2026-10-07 (Europe/London).

Branch: `codex/broker-sync-foundation`.
Tested SHA: `e6a88b06e10ea11c3aaac1f5e491f598f695a21a`.

Status: **BLOCKED — hosted portal launch not proven.** Stage 22B is not complete.

## Externally proven on Vercel Preview

- Vercel deployment `dpl_GMY4rQhSu6572ggX3gHAL8ZrC29Y` was READY and its Git metadata matched the tested SHA and branch. The stable branch alias pointed to that deployment.
- The repository's synthetic active subscriber authenticated successfully on the Preview. Dashboard and Portfolio showed `Synthetic Growth Portfolio`, its two synthetic AAPL/MSFT holdings, known cash, and synthetic ranking/news fixtures. No real customer data was visible in the inspected customer surfaces.
- `/portfolio/connections` was enabled and displayed the read-only connection explanation and `Synthetic Brokerage One` / `Synthetic Alpha Account` fixture.
- Read-only queries were restricted to isolated staging project `oocvbilwiosehfqpzges`. They confirmed one configured SnapTrade provider, zero SnapTrade connections and zero SnapTrade credential records for the synthetic subscriber after the attempted portal launches. No credential values or Vault secret contents were queried.
- Two browser submissions of Connect account (accessibility click, followed by semantic click after checking the unchanged page and empty error console) did not visibly navigate or open a portal tab. The form action and method were correct. A successful POST, its response status, and provider registration were not established by the available browser diagnostics. This is not yet evidence of a provider-contract defect or an application-code defect.
- Deployment-scoped runtime logs inspected for this Preview showed the synthetic Dashboard/Portfolio chart diagnostics, but did not establish the Connect request outcome. No further connection attempts were made.

## Deterministically tested

- `npm run test:broker-connections` passed: connection/onboarding/projection/provider-call source contracts and the mocked read-only Sandbox portal regression.
- The accepted server-only guard forces `SANDBOX` only for the explicit Sandbox opt-in. The existing SDK helper requests `connectionType: "read"`; broker selection is not accepted from the browser.
- The pure portion of `npm run test:performance` passed its bounded 0/10/50/200-position and zero-provider-call checks. Its subsequent local database worker-load subtest was blocked because the Docker Linux engine was unavailable. The complete command did **not** pass.
- Ordinary rendering is provider-free by source-contract tests; runtime server-side provider-call counting was not independently captured during this hosted attempt.

## Pending hosted proof

- Manually verify whether the hosted Connect account button opens the Sandbox portal. Do not create repeated connections or select any real brokerage.
- Verify SANDBOX-only/read-only portal presentation; complete Self-directed/default only, with human handoff at the interactive provider step.
- Verify return to the same stable Preview origin, preserved authentication, discovery, secured worker execution, candidate validation/promotion, account projection and provider-free connected Portfolio reads.
- Complete mobile overflow/reduced-motion and browser/network privacy checks. No hosted connected-flow or field Core Web Vitals claim is made.
- Run the required focused post-proof regression/type/lint/build gate. No completion commit or push has been made for this evidence.

## Pending Stage 22C

Real Trading 212 Invest testing remains unstarted and requires separate approval. No Trading 212 credential was accessed or used. No real brokerage, trading, manual refresh, paid add-on, Stripe mutation or production deployment was performed in this run.

## Safety and limitations

Staging is designated synthetic-only. Browser authentication and fixture presentation were exercised there; no database writes were made through diagnostic SQL. No secrets, provider payloads or portal URLs are included in this report. Preview SnapTrade credentials are designated Commercial TEST by the approved configuration; their classification was not independently proven by a successful hosted provider response. No successful hosted SnapTrade call is claimed. Local Supabase was not started.
