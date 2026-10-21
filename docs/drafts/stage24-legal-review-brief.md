# Stage 24 — focused UK regulatory and privacy review brief

Status: **UNSENT REVIEW BRIEF**, 2026-10-21. Engineering source baseline
`f452ed70a33488c2eca662e7a288f1acf69838cd`. For qualified UK financial-services
counsel and a privacy professional; not legal advice, launch approval or an
assertion that an exemption applies. No notice or customer contract is changed.

## Decision requested

Please provide a written, feature-specific decision for (a) one consenting
internal adult participant with a single read-only broker account, and (b) a
later controlled beta. Identify conditions, prohibited features/claims,
jurisdictions, required documents and unresolved facts separately for each.
An internal pilot, research label, disclaimer or lack of trade execution must
not be assumed to settle the regulatory perimeter.

## Establish the actual entity first

There is a verified source inconsistency in `app/legal/page.tsx`:

- Terms identifies StockGPT, LLC as a Delaware limited liability company and
  gives a Wilmington mailing address (lines 148–150 at the baseline).
- Privacy identifies the controller as “StockGPT, LLC, UK” (line 444).

These statements do not establish which entity actually contracts, controls
processing, operates the service or is established in the UK. Do not correct the
notice by picking one description. The business owner must securely provide:

1. Formation/incorporation certificate, entity number and current registry
   extract; any UK company/branch registration and associated entity details.
2. Registered office, principal operating establishment, service/contact address,
   operating locations and the distinction from any mail-forwarding address.
3. Ownership/management and the entity named in existing provider, hosting,
   billing and AI contracts; evidence of authority to contract for the service.
4. Proposed contracting entity, controller(s), any joint-controller arrangements,
   actual target/participant jurisdictions and decision-making locations.
5. Existing regulatory permissions/exemptions or professional opinions, if any;
   ICO registration/fee status and representative/DPO assessments, where relevant.

Qualified reviewers should determine what applies. Do not place identity
documents, participant data or professional advice into public Git; retain only
approved document references, scope and decisions in the release register.

## Factual product and engineering scope

StockGPT imports accounts, positions, cash and activities into an owner-scoped
broker domain; connected Portfolios reference accounts without copying financial
truth into manual holdings. Unsupported assets remain represented; failed syncs
retain last-good state and honest freshness/performance limitations. No order,
transfer or withdrawal capability is included. Stage 22B proved only simulated
TEST/SANDBOX operation; real-account access remains unauthorized.

The synthetic readiness checkpoint adds bounded session-owned export, a
non-executable lifecycle inventory, outbound AI field minimization and default-off
server admission/stop controls. These are not a complete rights-response product,
retention policy or deletion executor. Application cohort checks are not proof
of database-wide enforcement; review the final sprint's independent security
evidence before pilot activation.

Review actual screens and outputs, not this product summary alone:

| Surface / source | Required review evidence |
|---|---|
| Portfolio/Dashboard, attention states, notifications and digest | Current screenshots and synthetic output corpus, personalization inputs, limitations, urgency and calls to action |
| Ask: `app/api/ask-stockgpt/route.ts`, `lib/ask-stockgpt-portfolio-context.ts` and final outbound minimizer | Exact system prompt, context allowlist, free text/history, models/fallback routing, sample safe/hostile answers and processor terms |
| AI Portfolio Draft: `lib/portfolio.ts` and builder UI | Preference-driven stock selection/weights, allocation amounts, expected-return/risk narratives and rebalancing language; no assumption this feature is approved |
| `/legal`, signup, Checkout, pricing, landing and affiliate material | Exact live wording/version, acknowledgements, risk/performance claims, marketing channels and proposed audiences |
| Broker flow, export and lifecycle | Data/processor inventory, grants/RLS review, consent journey, disconnect versus deletion, logs/backups and rights-response gaps |

## Regulatory determinations

Please assess the actual UK perimeter and any other relevant jurisdiction for:

1. Personalized research, portfolio attention states and AI answers; whether
   outputs recommend particular investments or are presented as suitable/based
   on personal circumstances. Assess AI Portfolio Draft separately, including
   allocations, expected-return estimates and risk-profile explanations.
2. Financial promotions across product, landing pages, email, notifications,
   affiliates and social channels: who communicates/approves them, available
   permissions/exemptions, audience restrictions and records required.
3. Any relevant investment-recommendation, market-abuse/conflict or data-licensing
   requirements; paid/affiliate incentives and disclosure obligations.
4. Whether particular features should stay disabled or be narrowed for the
   internal pilot pending authorization, approval or a different operating model.
   Specify permitted evidence-explanation examples and prohibited outputs.
5. Pilot participation terms, complaints/support and operational responsibilities;
   whether any consumer, accessibility, vulnerable-user or other obligations
   apply to the proposed facts. Do not infer participant waiver of mandatory rights.

The FCA's [financial-promotion overview](https://www.fca.org.uk/firms/financial-promotions-adverts)
and [PERG 13.3](https://handbook.fca.org.uk/handbook/perg13/perg13s3) are starting
points, not a determination for StockGPT. The latter distinguishes public
communications from personal recommendations; delivery through a website is
not by itself decisive. Counsel should use current law and the actual product.

## Privacy determinations and implementation instructions

Please return decisions against the [actual data inventory](../privacy-data-inventory.md),
not a generic financial-app template:

- **Purpose and basis:** category-by-category purposes/lawful bases; participant
  information and broker authorization; distinguish pilot participation, required
  processing, optional AI use and marketing consent. Determine special-category
  exposure through free text and whether DPIA/automated-decision assessment is
  required. Do not treat consent as an automatic solution to every purpose.
- **Recipients and transfers:** roles, DPAs, subprocessors, regions and transfer
  evidence for SnapTrade, Supabase, Vercel, Stripe, OpenRouter/model providers,
  email/analytics and operators. A UK/EU database region does not establish all
  recipients' locations. Determine appropriate safeguards and assessments.
- **AI:** approve exact context categories and provider/model routing, fallback,
  retention, training and onward-processing terms. Financial context with IDs
  removed may still be personal data. User-entered text/history needs its own
  safeguards. State whether broker-derived AI use must remain disabled initially.
- **Retention and rights:** approve periods and triggers by secret, raw financial,
  derived history, chat, operational log, audit and backup category; legal holds,
  restoration/re-erasure behavior and cross-processor requests. Existing seven-day
  Ask cleanup on access is best effort, not guaranteed expiry. Append-only
  accounting does not itself establish an indefinite legal retention obligation.
- **Lifecycle and notice:** distinguish provider disconnect, connected-Portfolio
  removal, provider credential revocation, broker-data erasure and account closure.
  Specify owner verification, export completeness, access/portability response,
  correction/restriction/objection handling and operational response deadlines.
- **Incident and customer communications:** approved breach escalation, role and
  contact ownership, notification decision process, notice/terms/acknowledgement
  versions, cookie/analytics review and any representative/registration actions.

Relevant ICO starting points are [AI guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/),
[storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
and [erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/).
Retention must be justified for the purpose; the guidance supplies no universal
financial-app duration. ICO notes parts of its guidance are under review after
the Data (Use and Access) Act: reviewers must confirm current law/commencement,
not assume older guidance is complete.

## One consolidated response and release gate

Return one register, splitting pilot blockers from beta-only work:

| Decision ID | Finding / applicable rule or contract | Required product/document/control change | Owner | Pilot blocking? | Beta blocking? | Evidence / review trigger |
|---|---|---|---|---|---|---|
| ENTITY / REG / AI / PRIVACY / RIGHTS / OPS | Pending qualified review | Pending | Pending | Pending | Pending | Pending |

Required closeout: signed/dated scope opinion, confirmed entity/controller,
approved feature/claim restrictions, processing/transfer terms, lawful-basis and
retention schedule, factual notices and participant acknowledgement, rights and
incident procedures, and named decision owners. Engineering implements approved
decisions with synthetic tests; no destructive deletion or live access is implied.

Provider contract/permission clearance and explicit operator-covered Stage 22D
authorization remain separate. Neither this brief nor a professional review
automatically authorizes spending, deployment, real-account connection or beta
admission. No enquiry has been sent and no contract accepted.
