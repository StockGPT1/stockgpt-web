# Stage 22C / 24 readiness assessment

Research date: 2026-10-21. Scope: synthetic/local engineering readiness, public
documentation and read-only cloud metadata only. No provider API requests,
commercial commitments, legal clearance or real-account access occurred. The
accepted Sandbox proof is evidence of that integration, not production approval.

## Evidence and decisions must remain separate

| Classification | Meaning |
|---|---|
| Confirmed source fact | Repository behavior, accepted proof evidence, or the linked public source says this |
| Engineering interpretation | Proposed control or prudent question; not a provider promise or legal conclusion |
| External decision | Written provider, business-owner or qualified-professional determination still required |

## 22C: Commercial provider readiness

Public sources checked, not account-specific contractual confirmation:

- [Authentication Methods](https://docs.snaptrade.com/docs/authentication-methods):
  Commercial API-key integrations manage end users and use their per-user
  credentials; Personal authentication is a different user model. StockGPT's
  existing Commercial/Vault boundary matches the former. No authentication-model
  migration is proposed.
- [Personal vs Commercial](https://docs.snaptrade.com/docs/personal-vs-commercial)
  distinguishes account model from plan name. A Free/Build label does not prove
  Personal authentication. Commercial production-key availability has approval
  requirements; accepted TEST evidence does not satisfy them.
- [Broker Access Guide](https://docs.snaptrade.com/docs/broker-access-guide):
  production access and broker-specific availability/approval differ. Its current
  table lists Trading212 as supporting read and trade; that is provider
  capability, **not StockGPT permission**. The proposed pilot remains read-only.
- [Connection Portal API](https://docs.snaptrade.com/reference/Authentication/Authentication_loginSnapTradeUser)
  documents `connectionType: read` as data-only; `trade` and
  `trade-if-available` are outside StockGPT scope. It also documents broker
  targeting and reconnect. Portal links are short-lived, not stored credentials.

Pricing is evidence to resolve, not permission to spend:

- [Public pricing](https://snaptrade.com/pricing) currently advertises Build at
  $0 with five connected accounts, and Launch at $100/month plus connected-user
  pricing ($2 real-time or $1 daily). These are not StockGPT's signed terms.
- [Billing guidance](https://docs.snaptrade.com/docs/billing) describes
  connected-user and usage charges, including possible platform/minimum fees;
  disconnected/inactive relationships can still matter within a billing period.
  Manual refresh can be billable and remains prohibited here.
- [Developer terms](https://snaptrade.com/developer-terms-of-use) and pricing
  material describe different plan presentations. Ask SnapTrade to confirm the
  actual dated account agreement, limits and permitted pilot rather than combining
  examples into a guaranteed quote. No plan was enabled or payment method added.

### One provider decision packet (business owner sends; not sent by this sprint)

Supply only the product description, read-only endpoint/permission inventory,
sanitized 22A/22B evidence, intended jurisdiction, account types, pilot size,
refresh cadence, security/lifecycle summary and named incident contact. Do not
attach credentials, raw holdings, participant identifiers or secret-bearing logs.

Require a dated response covering:

1. Commercial eligibility, production/KYC steps, allowed internal pilot and exact
   proposed broker/account types; whether additional broker approval is needed.
2. Read-only enforcement and reconnect/revocation semantics; no execution,
   transfers, manual refresh, paid historical add-ons or recent-orders dependency.
3. Signed pricing, billable-user definition, limits/rate limits, cadence,
   support/SLA, suspension, overage and spend-alert behavior. Set an explicit
   approved budget; absence of a card charge today is not a future cost cap.
4. Storage/display/derived-analysis and AI-sharing rights, security obligations,
   processing roles, subprocessor/region evidence, incident notification,
   disconnect versus deletion and retention/backup commitments.
5. Escalation path for the missing Sandbox selector, failure/reconnect evidence,
   unsupported assets and freshness. Mark which gaps block this pilot; do not
   invent external proof for locally tested cases.

**22C complete:** named owner accepts provider response and security packet for
the exact pilot scope; budget and support/incident/credential-revocation owners
are assigned. Production keys must later be provisioned through an approved
secure action, never this document or chat. Normal-worker backoff is capped but
total retry attempts are not; approve a finite retry/support policy separately
before unattended commercial operation. The accepted one-shot proof does not
silently change normal queue policy.

## 24: UK perimeter and privacy review packet

This is a qualified-review agenda, not legal advice or clearance. Applicability
depends on actual entity, jurisdictions, audience, instruments and behavior.

### Financial-regulatory questions

[FCA financial-promotion guidance](https://www.fca.org.uk/firms/financial-promotions-adverts)
requires careful assessment of promotions and points to PERG. A research label or
read-only broker permission does not alone determine whether StockGPT's actual
communications fall within scope.
[PERG 8.30B](https://handbook.fca.org.uk/handbook/perg8?timeline=true) addresses
personal recommendations, including recommendations presented as suitable or
based on personal circumstances. Ask qualified UK counsel to assess actual
personalized outputs, not only disclaimers or four-status vocabulary.

Review samples of onboarding, rankings, holding/Portfolio attention states,
notifications/digests, Ask responses, landing/affiliate marketing and AI Portfolio
Draft (including preference-driven allocations and risk/return narratives).
Determine whether particular outputs are regulated advice/personal
recommendations, financial promotions, or another regulated activity; whether an
authorization/approval/exemption is available; and which distribution restrictions
are necessary. Do not assume an internal pilot or disclaimer creates an exemption.

### Privacy questions and engineering evidence

- Resolve the actual legal entity/controller first: `app/legal/page.tsx` states
  Delaware LLC in Terms but UK controller in Privacy. Do not choose a jurisdiction
  or rewrite published wording without owner/counsel confirmation.
- Map SnapTrade, Supabase, Vercel, Stripe, OpenRouter/model providers,
  email/analytics and operator access by purpose, data categories, role,
  region, contract, onward recipients and lawful-basis decision. A database region
  alone is not evidence of every processor's location or terms.
- [ICO AI minimization guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/how-should-we-assess-security-and-data-minimisation-in-ai/)
  supports limiting information to what the task requires. Review the exact Ask
  allowlist, free-text input/history, routing/fallback models, training/retention
  terms and access controls; removing IDs is not anonymization of holdings.
- [ICO storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
  does not supply a universal retention duration. Decide purpose-specific periods,
  triggers, audit/legal holds and review owners. Current seven-day Ask cleanup on
  access is best effort, not proof of a guaranteed retention job.
- [ICO erasure guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)
  distinguishes valid requests, exceptions and backup handling. Preserve financial
  integrity while assessing applicable retention obligations; neither append-only
  design nor a broad audit claim automatically defeats erasure rights.
- [ICO international-transfer guide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/)
  requires a fact-specific transfer analysis. Counsel/privacy owner must determine
  whether adequacy, safeguards/assessment or another lawful mechanism is needed,
  alongside processor-contract and subprocessor review.

**24 completion evidence:** approved entity/jurisdiction and product perimeter;
lawful purposes/bases and processing-role matrix; processor/transfer terms;
versioned factual notice/acknowledgements; rights/export/deletion/backup and
incident procedures; documented DPIA/automated-decision assessment where required;
marketing/cookie/store review and named owners. None is claimed complete here.

## Parallel engineering versus approvals

Engineering may now finish synthetic export/lifecycle contracts, AI allowlisting,
owner/cohort admission, kill switches, sanitized observability and stop drills.
These are testable safeguards, not legal policy. No destructive executor,
automatic retention period, customer activation or new commercial permission is
implied. Provider/counsel decisions proceed concurrently; record their exact
scope, decision date, evidence reference and expiry/review trigger before 22D.
