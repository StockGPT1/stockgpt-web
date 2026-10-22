# Stage 24 - UK regulatory and privacy decision packet

Status: UNSENT; prepared 22 October 2026 for qualified advisers.
Source checkpoint: e6d2b67fd0130b54500bf3c57a59689652ea2528.
This is a factual instruction brief, not legal clearance or a changed notice.

## Recipient and send-ready enquiry

Recipient: a nominated UK financial-services regulatory solicitor, with
data-protection capability or a coordinated privacy specialist. No named adviser
or email has been nominated/verified. The Law Society's official
[Find a Solicitor](https://solicitors.lawsociety.org.uk/) is a verified selection
route, not the recipient and not itself a provider of legal advice.
Verify the selected firm and individual in the
[SRA register](https://www.sra.org.uk/consumers/register/) before engagement.

Subject: StockGPT - scoped UK regulatory/privacy review before read-only pilot

Hello,

We seek a coordinated UK financial-services and data-protection review for
StockGPT: initially one consenting internal adult with one read-only brokerage
account, then a separately authorized limited beta for UK users.

Please first complete a conflict check and propose a fixed-fee or capped scope,
lead adviser and delivery date. We are requesting a proposal, not accepting an
engagement or authorizing work/spend.

The supporting brief below describes the actual product, including stock
rankings, model-derived trade levels, preference-driven portfolio drafts and
portfolio-aware AI explanations. We need a feature-specific decision, not
reliance on an educational disclaimer or the absence of trade execution.

Please determine the correct contracting entity/controller; relevant investment
advice, recommendation and financial-promotion boundaries; permitted pilot/beta
features and claims; and the required privacy, processor, transfer, retention,
rights, consent and participant documents. Please identify what must stay
disabled and distinguish pilot-blocking from beta-only conditions.

Return one written decision register with the applicable rule/contract,
permitted scope, required change, evidence, owner and review trigger. Identify
any US/entity advice requiring separate counsel. Corporate documents and sample
screens/prompts can be supplied through your approved secure channel after
conflict checking.

Thank you,
StockGPT team

## Supporting brief - evidence established and still missing

### 1. Entity/controller

Inspected both pages of the locally held approved Certificate of Formation.
The document identifies **StockGPT, LLC**, formed under Delaware law, filed
**27 May 2026**, with a Secretary of State certified-copy cover dated
28 May 2026. Its registered office is in Newark, Delaware. The certificate
remains outside Git; authentication numbers, signatures and personal details
are not reproduced here.

This supports formation, not current good standing, ownership of this service,
UK establishment, contracting authority, controller identity or regulatory
permissions. No live registry authentication or current-standing check occurred.

Source discrepancy:
- app/legal/page.tsx:148-154 describes a Delaware LLC and a Wilmington
  mailing address.
- app/legal/page.tsx:444 calls the controller "StockGPT, LLC, UK".
- scripts/update_legal_entity_to_llc.py contains a text replacement from an older
  UK-company statement to Delaware wording, but does not remove that controller
  suffix. This explains a possible editing mechanism, not corporate authority.

A Newark registered office and Wilmington mailing address need not conflict.
A Delaware company can also have UK activities: the certificate neither proves
nor disproves them. Do not replace the privacy wording on that basis alone.

Owner must provide securely: current standing/registry evidence and amendments;
operating/ownership and authorized-signatory evidence; actual operating and
decision-making locations; any UK entity/branch registration; the operator named
in provider, hosting, payment and AI contracts; a signed operator/controller
statement; and relevant ICO/representative/DPO assessments. Counsel should
confirm entity linkage, UK/EU territorial application and factual notice wording.

### 2. Product experience counsel must assess

| Actual surface at reviewed source | Experience / question for counsel |
|---|---|
| Rankings and stock detail | Named equities, ranked scores and model/technical research context. Assess selection, evaluation, conflicts, marketing and any investment-recommendation obligations; do not assume public ranking is exempt. |
| Trade-level UI | Stock page has "AI Trade Plan", "Suggested Levels", "Entry", "Stop Loss", "Take Profit" and an "action summary" teaser. Unlocked TradeSetupCard uses model-derived levels/research states. Assess actual values, presentation and funnel, not research disclaimers alone. |
| AI Portfolio Draft | User budget, risk tolerance and horizon drive named-stock selection, percentage/dollar allocations and estimated shares; source also supplies expected annual return, risk narrative and periodic rebalancing wording. This AI-branded feature includes deterministic selection logic, not necessarily an LLM for every output. Separate clearance or exclusion is needed. |
| Portfolio/Dashboard/notifications | Owned holdings, cash, concentration and evidence drive On track / Monitor / Review / Urgent review. These are not trade commands, but their personalization, urgency and onward links require assessment. |
| Ask StockGPT | Free-text questions plus selected owned Portfolio/All Investments and ranking context. Instructions prohibit personalized transaction decisions; minimization removes stable identifiers but facts/questions can remain personal data. Assess both the prompt and adversarial answers; instructions are not proof of every output. |
| Broker connection | Explicit read-only authorization, account selection, background sync, then factual owner-scoped views. Unknown/unmapped/stale facts remain limited; no orders, transfers or fabricated performance. Internal pilot only is proposed. |
| Marketing and monetization | Landing/pricing, signup, subscription Checkout, notifications/email and affiliate copy can communicate product/financial claims. Review the full journey and audience, not only /legal. |

Review anchors: app/stock/[ticker]/page.tsx, components/TradeSetupCard.tsx,
lib/trading-levels.ts, lib/portfolio.ts, components/PortfolioBuilder.tsx,
app/api/ask-stockgpt/route.ts, lib/ask-stockgpt-portfolio-context.ts,
lib/ai/portfolio-context-policy.ts and app/legal/page.tsx.
These describe source at the checkpoint, not an independently audited live
deployment. Supply synthetic screen captures/output examples after engagement;
do not give counsel real participant holdings just to illustrate functionality.

Required decisions: UK regulated-advice and personal-recommendation perimeter;
financial promotions and any approval/exemption/audience restrictions;
investment-recommendation/conflict/market-abuse considerations where applicable;
AI Portfolio Draft and trade-level restrictions; and permitted pilot features
versus public beta. No trading, a disclaimer or an internal participant is
assumed to settle these issues. Ask whether other jurisdictions apply.

### 3. Data, AI and rights

Flow: broker/provider -> backend -> owner-scoped normalized data/history ->
StockGPT views; optional minimized context -> OpenRouter/model providers for
Ask. Separate sources include profile/Auth, Stripe, support, chat, email,
analytics, operational logs and backups. See
[data inventory](../privacy-data-inventory.md).

Secrets stay outside customer/AI context. Financial facts, source/coverage and
unknown values are preserved. IDs removed from AI context do not anonymize
holdings; user questions/history are separately supplied content. Current Ask
routing includes paid and free-model fallbacks. No runtime key/model settings
were inspected in this review: approve the exact recipients, retention/training
terms and routing/fallbacks, not merely the gateway brand.

Please return category/purpose-specific lawful bases, roles/DPAs/subprocessors,
UK/EU scope and international-transfer safeguards; DPIA/automated-decision
assessment where applicable; explicit broker-derived AI go/no-go; versioned
notice, terms, risk/claim and participant-information changes; distinct optional
AI/marketing choices where appropriate; and a justified retention/hold/backup
schedule. Broker authorization is not automatically GDPR consent for every use.

Current export is a bounded, non-transactional brokerage subset, not a complete
subject-rights export. Lifecycle code is inventory-only: provider disconnect,
Portfolio removal, credential revocation, stored-data erasure and account closure
are distinct. Full erasure/rights delivery is not implemented. Ask's seven-day
cleanup is best-effort on access, not guaranteed deletion. Please specify rights,
export completeness, correction/restriction, deletion/holds, backup treatment,
processor requests, support/complaints and incident responsibilities.

### 4. Decision and evidence register

Return: issue / fact still required / applicable current authority / permitted
pilot scope / beta scope / required control or document / owner / deadline.
A signed pilot-specific opinion, factual entity/controller statement, processing
terms, participant information and operational procedure are the acceptance
evidence, not this research. No contract or legal engagement is accepted here.

Primary reading, checked 22 October 2026: FCA
[financial promotions](https://www.fca.org.uk/firms/financial-promotions-adverts)
and [PERG 8](https://handbook.fca.org.uk/handbook/perg8); ICO
[AI guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/),
[international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-brief-guide-to-international-transfers/)
and [storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/).
ICO marks some guidance under review after the Data (Use and Access) Act;
counsel must confirm current law/commencement. These sources do not determine
StockGPT's legal position.

## Parallel technical gate - identified, NOT EXECUTED

Accepted synthetic/PostgreSQL/type/build evidence from e6d2b67 is retained.
Before the approved real-account artifact, the minimum remaining Auth/API/browser
matrix is:

1. Verified local synthetic full Supabase stack, no reset or destructive seed:
   node scripts/verify-local-supabase-fixtures.mjs
2. npm run test:profile-entitlement-security
3. npm run test:broker-secret-security
4. npm run test:broker-sync
5. npm run test:connected-portfolios
6. npm run test:wave4
7. npm run test:acceptance:browser

These use local Auth/API/RLS sessions, secret isolation, claim/promotion and
last-good behavior, exact-owner/read-only projection, history/context and
subscriber/mobile journeys. A fresh-scope approval/migration review remains
necessary before any hosted release; the new default-deny admission migration
has only been applied locally. Do not use a real account to finish this matrix.

The two existing browser tests cover pricing scroll and subscriber Dashboard,
manual/connected/All Investments context, capability-off connections, reduced
motion/mobile and external-request assertions. They do NOT prove a live provider
return, native-device behavior, or notification infrastructure-failure rendering.
Retain the accepted deterministic failure tests and explicitly verify relevant
failure UI during approved release smoke. Run from an audited secret-free local
source with external-network guard; do not load production .env.local.

Read-only Vercel check on 22 October 2026: customer project/team still match;
latest reported READY Production is dpl_5CY81bBDsXPrbaL6vhn6d4crVcjV, and the
Preview-filtered foundation list shows dpl_5Yeko3umQw3fZVVRcfRZ4zB7KRjX at
b41f76f. Connector still omits effective Git/ignore/production-branch settings;
the exact Staging project lookup returns 404 not_found in this scope.
This is a visibility blocker, not proof the project is gone or isolation works.
No settings, secrets, deployment or endpoint were changed/accessed to bypass it.

Publication remains NO-GO pending fresh authorized settings evidence for both
projects, a separately approved project-only isolation policy and explicit
publication approval. Keep Staging cron/Git stopped and all approval registries
empty. Original exact-proof migration mapping remains unchanged; never blindly
reapply it. No tests, migrations, worker or provider API were run for this packet.
