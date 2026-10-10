# Stage 22B Sandbox instrument identity foundation

This change does not provision aliases or modify staging data. There is no
approved identity contract linking the twelve imported Sandbox positions to the
synthetic development catalogue. Matching tickers are not identity evidence.
Those positions remain unresolved, with their provider valuation intact.

## Read-time boundary

The existing owner/RLS client reads positions for the exact connected account.
Provider identity comes from its connection's provider relation, not from a
symbol or request parameter. Normal provider aliases use `<provider>.instrument`
and the existing empty scope. Unique provider IDs are queried in batches of at
most 200, with paginated historical alias windows. Each resolution uses the
stored position's `as_of` evidence and half-open alias validity. Conflicting
persisted identity, expired windows and ambiguity fail closed. This produces
separate identity metadata; it does not rewrite broker records or fetch quotes.
Across all batches, an account read is limited to 10,000 alias rows and 50 pages
(1,000 rows per page). These generous metadata limits accommodate the supported
position workloads while bounding pathological alias history. Verified exact
counts stop pagination on a full final page without an out-of-range completion
probe. Counts must remain consistent across a batch. Overflow, truncation or
page failure rejects the entire identity lookup; no partial aliases or persisted
ID fallback are used. A sanitized identity-availability limitation is exposed,
while valid broker positions, cash and monetary totals remain visible.

## Sandbox fixture approvals

The opt-in flag alone cannot activate fixtures. A reviewed read-only Sandbox
connection allowlist must exactly match provider, internal/external connection,
institution/provider institution mapping, owner and account. The database does
not currently store an independently trustworthy Sandbox/read-only attestation;
no institution-name or process-flag assumption substitutes for it. That reviewed
allowlist remains empty, as does the instrument fixture registry.

Production deployments always reject fixture activation. Only explicit Preview,
or local development/test with no hosted deployment environment, is eligible;
missing/unknown environment evidence fails closed. A reviewed connection with
missing/conflicting evidence remains unresolved. Other provider connections keep
their normal alias path even if the process-wide opt-in is enabled.

Eligible fixture connections do not use normal provider aliases. Approvals use
`sandbox.fixture.<provider>.instrument`, an explicit nonempty fixture scope,
`synthetic_test_only` provenance, exact owner/account/connection IDs, exact provider external
instrument IDs and finite validity windows with both endpoints supplied. Multiple
applicable contracts or aliases cannot silently pick an identity. The approved
runtime contract registry is deliberately empty. No new environment configuration
or customer input can populate it.

Tests use entirely invented provider/listing identities, never AAPL/MSFT/NVDA or
the actual Sandbox external IDs. A future approval requires a separately reviewed
fixture identity contract; real-security verification remains a different task.

## Analytical coverage and financial preservation

Approved normal identities with rankings are `ranked`; resolved identities with
account valuation evidence but no ranking are `tracked_only`; unresolved assets
are `unsupported`. Every position remains in valuation, regardless of coverage.
Account price evidence is never promoted to global market data.

Synthetic identities are test-labelled, and their rankings/diagnostics are
withheld from customer assessment. Their presentation is `Analysis limited`
with an explicit synthetic-data explanation, not a new canonical status. The
fixture path tests identity and valuation plumbing without claiming a genuine
market assessment. Quantity, price, cash, value, activity and timestamp records
are never changed by resolution. No schema migration or generated type change
is required.
Each fixture position displays the explicit synthetic-test label, never the
ordinary resolved-instrument label. Source-scoped identity provenance also flows
through All Investments into Ask context. Ask receives per-holding test labels,
suppressed research status/reasons and null synthetic ranking/diagnostic fields;
the system prompt explicitly prohibits interpreting fixtures as verified research.
Research availability additionally requires ranked coverage, finite ranking
evidence and, for broker holdings, a verified non-fixture instrument identity.
Broker-position IDs key intelligence and provenance independently of canonical
instrument IDs, so two positions in one listing cannot overwrite each other.

## Local regressions

`npm run test:connected-portfolio-intelligence` includes fixture identity,
time-window, ambiguity, conflicting evidence, owner/account isolation,
idempotency, immutability and 0/10/50/200/401-ID batch budgets. Connected valuation
tests cover all three coverage categories, unsupported duplicate symbols,
synthetic ranking suppression, unknown cash/FX and unchanged financial totals.
Additional checks cover Production/missing environment, provider/connection/
institution conflicts, exact row/page boundaries, cross-batch budget overflow,
pagination errors, UI-label fallback, and connected/aggregate Ask provenance.
These are deterministic tests, not new hosted/provider evidence.
