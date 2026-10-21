# Stage 22C — provider enquiry for review

Status: **UNSENT DRAFT**. Prepared 2026-10-21 against local checkpoint
`f452ed70a33488c2eca662e7a288f1acf69838cd`. Business-owner review is required
before sending. This is not approval to enable Production, accept a plan or spend.

## Proposed message

Subject: StockGPT — Commercial read-only internal pilot: approval and terms

Hello SnapTrade team,

StockGPT is preparing a controlled internal pilot of a read-only portfolio
research integration. We use your Commercial API-key model: backend registration,
per-user credentials stored behind an encrypted secret boundary, and the
Connection Portal forced to `connectionType: read`. We are not requesting trading,
transfers, manual refresh, recent-orders access or historical-data add-ons.

Our TEST/SANDBOX integration has passed connection, discovery, validation, atomic
promotion and a native scheduled hosted synchronization. The accepted run
reconciled two simulated accounts, 12 positions, two cash balances and 35
activities. Failed or incomplete collections retain last-good state. Customer
page reads use our normalized database, not synchronous broker requests. The
temporary proof is stopped. No real brokerage account has been connected.

We propose one consenting internal adult participant, one specifically approved
broker/account and an operator-covered reconciliation window before any beta.
Trading 212 is a candidate only, not an already approved pilot target. Please
confirm the exact broker, account types, jurisdiction and access before we select
the participant's account. We do not want to change authentication models.

Please provide one dated written response covering:

1. **Eligibility and onboarding:** Does our existing Commercial account permit
   this internal real-account pilot? Which Production Access/KYC, company,
   broker-specific or security reviews are mandatory first? Identify documents,
   application steps, expected turnaround and the owner of each decision.
2. **Exact scope and read-only guarantee:** Which proposed UK account types and
   broker integration are supported? Is `read` enforced at the connection and
   reconnect layers? How can we independently verify the actual granted access
   and reliably revoke it without requesting trading permissions?
3. **Complete cost and limits:** Confirm the applicable agreement/plan, any
   platform minimum, connected-user versus connection billing, inactive or
   disconnected-user charges, rate/request limits, automatic refresh cadence,
   overage behavior and support level. Is this one-participant pilot permitted
   on our current plan, and at what maximum cost? Can paid refresh, orders and
   add-ons remain disabled, and can a hard spend cap be enforced? We have not
   authorized a paid upgrade.
4. **Data and processing rights:** Supply the applicable developer agreement,
   DPA/security documentation, processor/controller roles, subprocessors,
   processing locations, transfer safeguards and incident-notification terms.
   Confirm permitted storage, display, export and derived-analysis use of account,
   position, cash and activity facts, including any broker/market-data licensing
   restrictions and requirements for delayed/unavailable information.
5. **AI boundary:** May minimized user-owned portfolio facts be sent to our
   contracted AI gateway/model providers for user-requested explanation? Please
   specify prohibited fields/uses, onward-processing and retention restrictions.
   We do not equate identifier removal with anonymization and can keep this
   feature disabled for pilot broker data pending written clearance.
6. **Operations and lifecycle:** Confirm reconnect, disconnection, credential
   revocation, user deletion and stored-data/backup behavior as distinct actions.
   State retention obligations, deletion confirmation, supported retry/backoff
   guidance, status/escalation channels and incident responsibilities. Identify
   which obligations remain ours. We will approve a bounded production retry
   policy before unattended operation.
7. **Outstanding test evidence:** The documented Sandbox scenario selector did
   not appear/apply on two isolated Commercial TEST portal attempts. Cash-only,
   no-transaction, no-account and selector-dependent failures are covered locally,
   not externally proven. Please advise whether alternative documented test
   mechanisms exist and which reconnect/failure evidence you require for pilot
   approval. We will not use undocumented portal parameters.

Please distinguish conditions for this **one-person internal pilot** from those
for a later limited beta. No response will be treated as a change to our plan,
permission scope or account unless our business owner explicitly approves it.
Please do not request API secrets or participant financial data by email; direct
us to an approved secure process if confidential evidence is required.

Thank you,
StockGPT

## Review and reply register

Business owner supplies the final legal entity, pilot jurisdiction, proposed
broker/account type, incident contact and approved budget before sending; none is
inferred from the website notice. Use an existing verified provider contact or
authenticated support channel, not a new unverified recipient. Do not attach raw
payloads, credentials, participant identifiers or activated proof receipts.

Ask the provider to return the following format for items 1–7, so engineering can
consume one complete decision packet rather than repeated approvals:

| Item | Decision / permitted scope | Agreement or policy reference and date | Mandatory action and owner | Pilot blocker? | Beta-only requirement / review trigger |
|---|---|---|---|---|---|
| 1–7 | To be completed by provider | Pending | Pending | Pending | Pending |

Close 22C only when the owner accepts the written scope, actual cost/limits,
processing rights, escalation/revocation responsibilities and secure onboarding
steps. Local tests and TEST authentication do not supply commercial clearance.

## Source facts versus unanswered questions

Official public pages checked 2026-10-21; these are not account-specific terms:

- [Personal vs Commercial](https://docs.snaptrade.com/docs/personal-vs-commercial)
  separates integration model from billing plan. No Personal/OAuth migration is
  proposed.
- [Broker access](https://docs.snaptrade.com/docs/broker-access-guide) distinguishes
  immediate, approval-dependent and bring-your-own-key access. Provider trading
  capability does not authorize StockGPT to request it.
- [Pricing](https://snaptrade.com/pricing) advertises Build $0/up to five
  connections and Launch $100/month plus per-user charges; these are reference
  figures, not an approved StockGPT quote.
- [Billing](https://docs.snaptrade.com/docs/billing) makes charges dependent on
  agreement and usage. The enquiry deliberately asks for a complete account-
  specific quote instead of assuming that a free TEST key permits a free pilot.

Engineering evidence: [accepted hosted proof](../stage22b-final-proof-evidence.md),
[readiness assessment](../provider-legal-readiness-assessment.md), and
[data inventory](../privacy-data-inventory.md). Share sanitized relevant excerpts
only; first verify the exact evidence filenames and current scope before sending.
