# Stage 22A SnapTrade Sandbox evidence

This report is intentionally secret-free. It contains no credentials, SnapTrade user secret, raw provider payload, Connection Portal URL, account number or financial amount.

- Status: `COMPLETE — additional provider scenarios pending`
- Run date: `2026-10-02`
- Branch SHA at proof: `92cd3970026212b0936d2139a2852aa93977439a`
- SnapTrade SDK: `snaptrade-typescript-sdk@12.2.7`
- Key classification: Commercial test / non-production
- Broker: `SANDBOX`
- Connection permission: `read`

## Externally proven

The live non-production SnapTrade API and Connection Portal proved the Self-directed (default) happy path:

| Evidence | Actual result |
| --- | --- |
| Provider user registration | succeeded; credential stored through the existing private metadata + Supabase Vault boundary |
| Connection Portal | ephemeral, broker restricted to `SANDBOX`, connection type `read` |
| Provider discovery | one active read-only Sandbox connection discovered for the proof identity |
| Accounts | 2 |
| Positions | 9 |
| Cash balances | 2 |
| Activities | 31 |
| Unsupported instruments | all 9 positions preserved with unresolved `instrument_id`; none dropped or fabricated |
| Candidate validation | succeeded |
| Atomic promotion | succeeded; latest local sync job was `succeeded` |
| Connected Portfolio projection | succeeded for one selected account |
| Manual holdings copied | 0 |

Observed normalized activity types included adjustment, buy, contribution, distribution, dividend, external asset transfers, fee, interest, internal asset/cash transfers, rebate, reinvestment, return of capital, reverse split, sell, spinoff, split, stock dividend, stock merger, tax, transfer and withdrawal. The existing Stage 14 classifier remains conservative for ambiguous transfer/adjustment evidence.

Ordinary Portfolio/Dashboard/Ask/Notifications reads remain database-only. The portal, discovery and sync worker were the only provider-call boundaries used. Provider prices remained account evidence and were not written as global market facts.

## Deterministically tested only

The following accepted semantics remain covered by local deterministic suites but were not externally provider-smoked:

- Cash-only: zero holdings is distinct from unavailable holdings; known cash remains factual.
- No transactions: holdings/cash may promote without fabricating activity or performance history.
- No accounts: no zero-value or connected Portfolio is fabricated.
- Invalid credentials, account locked and rate-limited failures: no empty candidate is promoted; errors are sanitized and retry/terminal handling remains bounded.
- Disabled/reconnect behavior: last-good normalized facts remain available and duplicate StockGPT account/Portfolio identity is prevented.

No external evidence is claimed for these scenarios.

## Pending provider follow-up

SnapTrade's public Sandbox documentation says the portal should offer Self-directed, Cash only, No transactions, No accounts and error scenarios. In two isolated Commercial test-key portal attempts, the live portal did not expose or apply the documented selector and returned the Self-directed default dataset both times. The documented Connection Portal API has no scenario-selection parameter.

StockGPT did not invent an undocumented parameter, create further duplicate connections, delete the successful connections, weaken validation or fabricate scenario evidence. Provider/documentation clarification remains pending.

The test-key force-disable endpoint and live reconnect were not exercised. Deterministic reconnect/last-good tests remain the evidence until that provider path is explicitly available and approved.

## Security and external-call record

- A private credential row and exactly one associated Vault secret existed for the successful proof identity before the local verification reset.
- Public broker-domain tables exposed zero credential, secret, raw-payload or portal-URL columns.
- No credential value, user secret, raw provider payload or portal URL is stored in tracked files or this report.
- External call types used: register provider user, generate read-only Sandbox portal, list connections, list accounts, list positions, list balances and list paginated activities.
- Manual refresh calls: none.
- Trading/order calls: none.
- Historical-value or other paid add-ons: none.
- Real brokerage connections: none.
- Production SnapTrade key, production Supabase, deployment, Stripe and email: none.
