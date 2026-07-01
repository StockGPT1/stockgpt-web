import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalCandleScrollbar } from "@/components/LegalCandleScrollbar";

export const metadata: Metadata = {
  title: "Legal | StockGPT, LLC",
  description:
    "StockGPT, LLC legal terms, subscription agreement, privacy policy, cookie policy, investment disclaimer, and affiliate terms.",
};

const lastUpdated = "17 May 2026";

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-[2rem] border border-[#ddb159]/18 bg-[#061b12]/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-7 lg:p-9"
    >
      {eyebrow && (
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#ddb159]">
          {eyebrow}
        </p>
      )}

      <h2 className="text-3xl font-black tracking-[-0.04em] text-[#faf6f0] sm:text-4xl">
        {title}
      </h2>

      <div className="mt-6 space-y-5 text-sm font-medium leading-7 text-[#faf6f0]/66">
        {children}
      </div>
    </section>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-base font-black tracking-[-0.01em] text-[#ddb159]">
      {children}
    </h3>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2">{children}</ul>;
}

export default async function LegalPage() {
  await connection();

  return (
    <main
      id="legal-scroll-root"
      className="legal-page h-[100dvh] overflow-y-scroll bg-[#072116] pr-[22px] text-[#faf6f0]"
    >
      <LegalCandleScrollbar />

      <style>{`
        .legal-page {
          scroll-behavior: smooth;
          scrollbar-width: none;
        }

        .legal-page::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(221,177,89,0.13),transparent_26%),radial-gradient(circle_at_82%_16%,rgba(0,255,136,0.06),transparent_30%),linear-gradient(180deg,#072116,#03140c)]" />
        <div className="absolute left-1/2 top-[8%] h-[340px] w-[760px] -translate-x-1/2 rounded-full bg-[#ddb159]/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-[#ddb159]/18 bg-[#04180f]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-black uppercase tracking-[0.18em] text-[#ddb159]"
          >
            StockGPT, LLC
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/58 sm:text-xs">
            <a href="#terms" className="hover:text-[#ddb159]">
              Terms
            </a>
            <a href="#subscription" className="hover:text-[#ddb159]">
              Subscription
            </a>
            <a href="#privacy" className="hover:text-[#ddb159]">
              Privacy
            </a>
            <a href="#cookies" className="hover:text-[#ddb159]">
              Cookies
            </a>
            <a href="#disclaimer" className="hover:text-[#ddb159]">
              Disclaimer
            </a>
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-[2rem] border border-[#ddb159]/24 bg-[#04180f]/78 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
            Legal centre
          </p>

          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.055em] text-[#faf6f0] sm:text-6xl">
            StockGPT, LLC legal documents.
          </h1>

          <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-[#faf6f0]/58">
            Last updated: {lastUpdated}. These terms are written for StockGPT, LLC,
            a subscription-based AI stock research and ranking platform. They
            are not a substitute for review by a qualified solicitor or
            regulatory compliance adviser.
          </p>

        </section>

        <div className="grid gap-6">
          <Section
            id="terms"
            title="Terms of Service"
            eyebrow="Agreement 1"
          >
            <p>
              These Terms of Service govern your access to and use of StockGPT, LLC,
              including the website, dashboard, rankings, portfolio tools, AI
              chatbot, market news, reports, emails, subscriptions and any
              related services operated under the StockGPT, LLC brand.
            </p>

            <p>
              The service is operated by StockGPT, LLC, a Delaware limited
              liability company. Our mailing address is 2810 N Church St STE
              88611, Wilmington, DE 19802.
            </p>

            <p>
              Mailing address: 2810 N Church St STE 88611, Wilmington, DE 19802.
            </p>

            <Subheading>1. Acceptance of these Terms</Subheading>
            <p>
              By creating an account, accessing the website, starting a free or
              paid subscription, using the dashboard, submitting an affiliate
              application, or otherwise using StockGPT, LLC, you agree to these
              Terms. If you do not agree, you must not use the service.
            </p>

            <Subheading>2. What StockGPT, LLC provides</Subheading>
            <p>
              StockGPT, LLC provides AI-assisted market research tools, stock ranking
              outputs, portfolio research features, market-news summaries,
              educational analytics and model-generated information. StockGPT, LLC
              is designed to help users organise and research market information.
            </p>

            <p>
              StockGPT, LLC does not provide brokerage services, order execution,
              custody, regulated financial advice, tax advice, legal advice or
              personalised investment recommendations. We do not assess whether
              any investment is suitable for your personal circumstances.
            </p>

            <Subheading>3. No investment advice</Subheading>
            <p>
              All content on StockGPT, LLC is provided for informational and
              educational purposes only. Nothing on StockGPT, LLC is financial advice,
              investment advice, tax advice, legal advice, a personal
              recommendation, or a recommendation to buy, sell, hold, short or
              otherwise trade any security, instrument, asset or investment.
            </p>

            <p>
              You are solely responsible for your investment decisions. You
              should conduct your own research and, where appropriate, consult a
              qualified and regulated financial adviser before making any
              investment decision.
            </p>

            <Subheading>4. Model outputs and AI limitations</Subheading>
            <p>
              StockGPT, LLC uses quantitative models, third-party data, AI systems and
              automated processing to generate rankings, scores, summaries and
              research outputs. These outputs may be incomplete, delayed,
              inaccurate, misinterpreted, affected by data-provider errors, or
              unsuitable for your circumstances.
            </p>

            <p>
              Any words such as “ranking”, “score”, “signal”, “bullish”,
              “cautious”, “model view”, “AI trade plan”, “entry”, “risk”,
              “target”, “stop-loss”, “take-profit” or similar are model outputs
              and research labels only. They are not instructions and must not
              be treated as personalised advice.
            </p>

            <Subheading>5. Eligibility</Subheading>
            <p>
              You must be at least 18 years old and legally capable of entering
              into a binding agreement to use StockGPT, LLC. You must not use
              StockGPT, LLC where doing so would breach any law, regulation or rule
              applicable to you.
            </p>

            <Subheading>6. Account security</Subheading>
            <p>
              You are responsible for keeping your login credentials secure. You
              must not share your account, resell access, scrape content, bypass
              paywalls, or allow unauthorised users to access subscriber
              features through your account.
            </p>

            <Subheading>7. Acceptable use</Subheading>
            <p>You must not:</p>
            <List>
              <li>use StockGPT, LLC for unlawful, fraudulent or harmful purposes;</li>
              <li>
                copy, scrape, reverse-engineer or reproduce our rankings, models
                or interface;
              </li>
              <li>
                attempt to bypass authentication, subscription gates or rate
                limits;
              </li>
              <li>
                use the service to create misleading financial promotions;
              </li>
              <li>use outputs as the sole basis for investment decisions;</li>
              <li>upload malware, spam, malicious scripts or harmful content;</li>
              <li>misrepresent your affiliation with StockGPT, LLC;</li>
              <li>
                use StockGPT, LLC to provide regulated advice unless you are properly
                authorised to do so.
              </li>
            </List>

            <Subheading>8. Intellectual property</Subheading>
            <p>
              StockGPT, LLC, our branding, interface, ranking methodology,
              compilation of data, copy, graphics, software, workflows, product
              structure, model presentation and dashboard design are owned by us
              or licensed to us. You receive a limited, revocable,
              non-exclusive, non-transferable right to use the service for your
              own personal or internal research purposes while your account is
              active.
            </p>

            <Subheading>9. Third-party data and services</Subheading>
            <p>
              StockGPT, LLC may rely on third-party providers for market data, news,
              authentication, payments, hosting, analytics, AI functionality and
              infrastructure. We are not responsible for third-party outages,
              delays, inaccuracies or changes.
            </p>

            <Subheading>10. OpenAI and AI-provider disclaimer</Subheading>
            <p>
              StockGPT, LLC is independent. StockGPT, LLC is not affiliated with, endorsed
              by, sponsored by, certified by, or officially connected with
              OpenAI, ChatGPT, or any other AI provider unless expressly stated
              in writing. “OpenAI”, “ChatGPT”, “GPT” and related marks are the
              property of their respective owners. References to AI providers,
              models, APIs or technologies are for descriptive purposes only and
              must not be read as implying partnership or endorsement.
            </p>

            <Subheading>11. Availability and changes</Subheading>
            <p>
              We may update, suspend, withdraw, modify or discontinue any part
              of StockGPT, LLC at any time. We do not guarantee uninterrupted
              availability, live market accuracy, full coverage of every stock,
              or continuous access to any particular feature.
            </p>

            <Subheading>12. Beta and experimental features</Subheading>
            <p>
              Some features may be experimental, in beta, incomplete or subject
              to change. You use experimental features at your own risk.
            </p>

            <Subheading>13. Disclaimers</Subheading>
            <p>
              StockGPT, LLC is provided on an “as is” and “as available” basis. To
              the maximum extent permitted by law, we disclaim all warranties,
              representations and guarantees, whether express or implied,
              including accuracy, reliability, fitness for purpose, availability
              and non-infringement.
            </p>

            <Subheading>14. Limitation of liability</Subheading>
            <p>
              To the maximum extent permitted by law, StockGPT, LLC will not be
              liable for investment losses, trading losses, loss of profits, loss
              of opportunity, business interruption, data loss, indirect loss,
              consequential loss, or losses arising from reliance on AI outputs,
              rankings, news summaries or third-party data.
            </p>

            <p>
              Nothing in these Terms limits liability that cannot be limited by
              law, including liability for death or personal injury caused by
              negligence, fraud, fraudulent misrepresentation, or any statutory
              consumer rights that cannot be excluded.
            </p>

            <Subheading>15. Suspension and termination</Subheading>
            <p>
              We may suspend or terminate your access if you breach these Terms,
              misuse the service, create risk for StockGPT, LLC or other users,
              attempt to bypass access controls, misuse affiliate links, or use
              the platform in a way that may expose us to regulatory or legal
              risk.
            </p>

            <Subheading>16. Changes to these Terms</Subheading>
            <p>
              We may update these Terms from time to time. The latest version
              will be posted on this page. If changes are material, we may notify
              you by email, dashboard notice or another reasonable method.
              Continued use after changes means you accept the updated Terms.
            </p>

            <Subheading>17. Governing law</Subheading>
            <p>
              These Terms are governed by the laws of England and Wales, unless
              mandatory consumer protection laws in your country require
              otherwise. The courts of England and Wales will have jurisdiction,
              subject to any mandatory consumer rights.
            </p>

            <Subheading>18. Contact</Subheading>
            <p>For questions about these Terms, contact us at sales@stockgpt.pro.</p>
          </Section>

          <Section
            id="subscription"
            title="Subscription Agreement"
            eyebrow="Agreement 2"
          >
            <p>
              This Subscription Agreement forms part of the Terms of Service and
              applies when you purchase a paid StockGPT, LLC subscription.
            </p>

            <Subheading>1. Subscription access</Subheading>
            <p>
              A subscription gives you access to paid StockGPT, LLC features during
              the active subscription period, subject to these Terms, successful
              payment and any technical or legal limitations.
            </p>

            <Subheading>2. Billing</Subheading>
            <p>
              Subscription fees are billed in advance through our payment
              provider, Stripe, or another payment provider we may use in the
              future. Prices, billing periods, taxes and available plans are
              displayed before checkout.
            </p>

            <Subheading>3. Auto-renewal</Subheading>
            <p>
              Unless cancelled before the renewal date, your subscription will
              automatically renew for the next billing period and your payment
              method will be charged. You can cancel through the account area or
              Stripe billing portal where available.
            </p>

            <Subheading>4. Cancellation</Subheading>
            <p>
              You may cancel at any time. Cancellation stops future renewals but
              does not automatically refund the current billing period unless
              required by law or expressly stated by us.
            </p>

            <Subheading>5. Refunds</Subheading>
            <p>
              Because StockGPT, LLC provides digital content and online services,
              refunds are generally not provided for partial billing periods,
              unused access or changes of mind after access has begun, except
              where required by applicable consumer law or where we choose to
              provide a refund at our discretion.
            </p>

            <Subheading>6. Failed payments</Subheading>
            <p>
              If a payment fails, we or our payment provider may retry the charge
              and/or suspend access until payment is made.
            </p>

            <Subheading>7. Price changes</Subheading>
            <p>
              We may change prices or plan features. If a price change affects
              your active subscription, we will provide reasonable notice where
              required by law. Continued use after the change takes effect means
              you accept the new price.
            </p>

            <Subheading>8. Promotions and discount codes</Subheading>
            <p>
              Promotions, trials, coupons and discount codes are discretionary,
              may be withdrawn, may be limited to certain users, and may be
              subject to additional conditions.
            </p>

            <Subheading>9. No guaranteed investment outcome</Subheading>
            <p>
              Subscription fees are for access to software and research tools.
              Payment does not guarantee investment performance, profit, market
              accuracy, or any financial outcome.
            </p>

            <Subheading>10. Legal acceptance at checkout</Subheading>
            <p>
              By subscribing, you confirm that you have read and agree to the
              Terms of Service, Subscription Agreement, Privacy Policy, Cookie
              Policy and Investment Disclaimer.
            </p>
          </Section>

          <Section id="privacy" title="Privacy Policy" eyebrow="Agreement 3">
            <p>
              This Privacy Policy explains how StockGPT, LLC collects, uses, stores
              and shares personal data.
            </p>

            <Subheading>1. Controller</Subheading>
            <p>
              The controller is StockGPT, LLC, UK.
              Contact: sales@stockgpt.pro.
            </p>

            <Subheading>2. Personal data we collect</Subheading>
            <p>We may collect:</p>
            <List>
              <li>account data, including name, email address and login details;</li>
              <li>subscription and billing data processed through Stripe;</li>
              <li>
                portfolio inputs you choose to provide, such as ticker symbols,
                holdings, entry prices, allocation data and watchlists;
              </li>
              <li>
                usage data, including pages viewed, clicks, feature usage,
                device information, IP address and log data;
              </li>
              <li>
                communications, including support messages and affiliate
                applications;
              </li>
              <li>
                technical data needed for authentication, fraud prevention,
                analytics and security;
              </li>
              <li>
                AI interaction data, including questions submitted to Ask
                StockGPT, LLC and generated responses.
              </li>
            </List>

            <Subheading>3. How we use personal data</Subheading>
            <p>We use personal data to:</p>
            <List>
              <li>provide, secure and maintain StockGPT, LLC;</li>
              <li>create and manage accounts;</li>
              <li>process subscriptions and payments;</li>
              <li>display portfolio, watchlist and ranking features;</li>
              <li>respond to support requests;</li>
              <li>improve the product, user experience and performance;</li>
              <li>detect fraud, abuse and security issues;</li>
              <li>
                send service messages, legal updates and important account
                notices;
              </li>
              <li>process affiliate applications and partner relationships;</li>
              <li>comply with legal obligations.</li>
            </List>

            <Subheading>4. Lawful bases</Subheading>
            <p>
              Depending on the context, we rely on contract performance,
              legitimate interests, consent, and legal obligation. For example,
              we process account and subscription data to perform our contract
              with you, security logs for legitimate interests, marketing
              preferences where consent or legitimate interest applies, and tax
              or accounting records where legally required.
            </p>

            <Subheading>5. AI and portfolio inputs</Subheading>
            <p>
              If you enter portfolio information, watchlists or questions into
              StockGPT, LLC, we process that data to provide research features and AI
              responses. Do not upload sensitive personal data, private financial
              documents, account passwords, brokerage login details or
              information about other people.
            </p>

            <Subheading>6. Processors and third parties</Subheading>
            <p>
              We may use third-party providers including Supabase for
              authentication/database, Stripe for payments, Vercel for hosting,
              Render or similar infrastructure providers, analytics providers,
              market-data/news providers and AI/API providers. These providers
              process data only as needed to provide their services to us.
            </p>

            <Subheading>7. International transfers</Subheading>
            <p>
              Some providers may process data outside the UK. Where required, we
              use appropriate safeguards such as contractual protections,
              adequacy decisions or standard contractual clauses.
            </p>

            <Subheading>8. Data retention</Subheading>
            <p>
              We keep personal data only as long as reasonably necessary for the
              purposes described in this policy, including account operation,
              legal compliance, accounting, dispute resolution, fraud prevention
              and service improvement. You may request deletion, but some records
              may need to be retained where required by law or legitimate
              business needs.
            </p>

            <Subheading>9. Security</Subheading>
            <p>
              We use reasonable technical and organisational measures to protect
              personal data. No online service is completely secure, and you are
              responsible for keeping your login credentials safe.
            </p>

            <Subheading>10. Your rights</Subheading>
            <p>
              Depending on your location, you may have rights to access,
              correct, delete, restrict or object to processing of your personal
              data, request portability, withdraw consent, and complain to a
              data-protection authority.
            </p>

            <Subheading>11. Marketing</Subheading>
            <p>
              We may send marketing communications where permitted by law. You
              can unsubscribe using links in emails or by contacting us.
              Service, billing and legal notices are not marketing and may still
              be sent.
            </p>

            <Subheading>12. Children</Subheading>
            <p>
              StockGPT, LLC is not intended for children under 18. We do not knowingly
              collect data from children.
            </p>

            <Subheading>13. Changes</Subheading>
            <p>
              We may update this Privacy Policy. The latest version will appear
              on this page.
            </p>

            <Subheading>14. Contact</Subheading>
            <p>
              For privacy requests, contact sales@stockgpt.pro. You may also have
              the right to complain to the UK Information Commissioner’s Office
              or your local data-protection authority.
            </p>
          </Section>

          <Section id="cookies" title="Cookie Policy" eyebrow="Agreement 4">
            <p>
              This Cookie Policy explains how StockGPT, LLC uses cookies and similar
              technologies.
            </p>

            <Subheading>1. What cookies are</Subheading>
            <p>
              Cookies are small files stored on your device. Similar
              technologies include local storage, pixels, tags and device
              identifiers.
            </p>

            <Subheading>2. Types of cookies we use</Subheading>
            <List>
              <li>
                Strictly necessary cookies: required for login, security,
                session management, checkout and subscription access.
              </li>
              <li>
                Functional cookies: remember preferences and improve user
                experience.
              </li>
              <li>
                Analytics cookies: help us understand usage, performance and
                product issues.
              </li>
              <li>
                Marketing or referral cookies: may help track affiliate or
                campaign referrals where enabled.
              </li>
            </List>

            <Subheading>3. Third-party cookies</Subheading>
            <p>
              Stripe, Supabase, Vercel, analytics providers, affiliate platforms
              and other service providers may set or read cookies as part of
              their services.
            </p>

            <Subheading>4. Consent</Subheading>
            <p>
              Where required by law, we will ask for your consent before setting
              non-essential cookies. You can change browser settings to block or
              delete cookies, but some features may stop working.
            </p>

            <Subheading>5. Local storage</Subheading>
            <p>
              We may use browser local storage for preferences, recent searches
              and interface settings. Clearing browser storage may remove these
              preferences.
            </p>

            <Subheading>6. Updates</Subheading>
            <p>
              We may update this Cookie Policy as our technology stack changes.
            </p>
          </Section>

          <Section
            id="disclaimer"
            title="AI Research & Investment Disclaimer"
            eyebrow="Agreement 5"
          >
            <p>
              This disclaimer applies to all StockGPT, LLC rankings, scores, AI
              summaries, chatbot answers, news summaries, portfolio tools,
              watchlists, trade-plan labels, alerts, reports and emails.
            </p>

            <Subheading>1. Informational use only</Subheading>
            <p>
              StockGPT, LLC is an AI-powered research and ranking tool. It is not a
              regulated financial adviser, broker, investment manager or trading
              platform. Nothing on StockGPT, LLC is a personal recommendation or
              instruction to buy, sell, hold, short or trade any security.
            </p>

            <Subheading>2. No suitability assessment</Subheading>
            <p>
              We do not assess your financial situation, objectives, risk
              tolerance, tax position, investment horizon, liquidity needs,
              experience or suitability. Any portfolio feature is a research
              workflow, not a suitability assessment.
            </p>

            <Subheading>3. Market risk</Subheading>
            <p>
              Investing involves risk. Securities can fall in value. You may
              lose money. Past performance, historical data, backtests,
              rankings, AI outputs and model scores do not guarantee future
              results.
            </p>

            <Subheading>4. AI risk</Subheading>
            <p>
              AI systems can produce errors, outdated information, hallucinated
              explanations, incorrect summaries or misleading confidence. You
              must verify important information independently.
            </p>

            <Subheading>5. Data risk</Subheading>
            <p>
              Market data, prices, fundamentals, news and third-party data may
              be delayed, incomplete or inaccurate. StockGPT, LLC is not responsible
              for decisions made in reliance on such data.
            </p>

            <Subheading>6. User responsibility</Subheading>
            <p>
              You are solely responsible for your investment decisions. If you
              need advice, consult a qualified professional authorised to advise
              on investments in your jurisdiction.
            </p>
          </Section>

          <Section
            id="affiliate-terms"
            title="Affiliate Program Terms"
            eyebrow="Agreement 6"
          >
            <p>
              These Affiliate Program Terms apply to anyone applying for or
              participating in the StockGPT, LLC affiliate program.
            </p>

            <Subheading>1. Approval required</Subheading>
            <p>
              Submitting an application does not guarantee acceptance. We may
              approve, reject, suspend or terminate affiliates at our discretion.
            </p>

            <Subheading>2. Accurate promotion</Subheading>
            <p>
              Affiliates must present StockGPT, LLC accurately as an AI research and
              ranking tool. Affiliates must not describe StockGPT, LLC as guaranteed
              profit, financial advice, a trading signal group, a broker, a
              regulated adviser, or an FCA-approved investment recommendation
              service.
            </p>

            <Subheading>3. No misleading financial promotions</Subheading>
            <p>
              Affiliates must not make misleading, exaggerated or unsubstantiated
              claims, including claims about guaranteed returns, risk-free
              investing, certain profits, insider information, or specific
              investment outcomes.
            </p>

            <Subheading>4. Required disclosures</Subheading>
            <p>
              Affiliates must clearly disclose that they may receive commission
              if someone subscribes through their link. Disclosure must be clear
              and prominent, for example: “I may earn commission if you subscribe
              through my link.”
            </p>

            <Subheading>5. Content standards</Subheading>
            <p>
              Affiliate content must be professional, lawful, non-deceptive and
              consistent with StockGPT, LLC’s premium positioning. Affiliates must not
              use spam, fake accounts, fake reviews, bots, misleading scarcity,
              impersonation, unauthorised brand use or aggressive targeting.
            </p>

            <Subheading>6. Brand use</Subheading>
            <p>
              Affiliates may use approved StockGPT, LLC brand assets only in
              accordance with our guidelines. Affiliates must not alter logos,
              imply employment, imply regulatory approval, or suggest they speak
              on behalf of StockGPT, LLC unless authorised.
            </p>

            <Subheading>7. Commission</Subheading>
            <p>
              Commission rates, attribution windows, payment thresholds and
              payout schedules are set by StockGPT, LLC or the affiliate platform we
              use. We may change program terms prospectively.
            </p>

            <Subheading>8. Fraud and abuse</Subheading>
            <p>
              We may withhold or reverse commission for fraud, self-referrals,
              chargebacks, refund abuse, fake accounts, incentive abuse,
              prohibited advertising, misleading claims or breach of these
              terms.
            </p>

            <Subheading>9. Compliance</Subheading>
            <p>
              Affiliates are responsible for complying with applicable
              advertising, financial promotion, consumer protection, platform,
              tax and disclosure rules.
            </p>

            <Subheading>10. Termination</Subheading>
            <p>
              We may terminate affiliate participation at any time, especially
              where content creates legal, brand, regulatory or reputational
              risk.
            </p>
          </Section>

          <Section
            id="copyright"
            title="Copyright, Trademarks & Third-Party Brands"
            eyebrow="Agreement 7"
          >
            <p>
              StockGPT, LLC respects intellectual property rights and expects users,
              affiliates and partners to do the same.
            </p>

            <Subheading>1. StockGPT, LLC intellectual property</Subheading>
            <p>
              The StockGPT, LLC name, visual identity, UI, product design, copy,
              rankings presentation, methodology, software and related materials
              are owned by us or licensed to us.
            </p>

            <Subheading>2. Third-party marks</Subheading>
            <p>
              All third-party company names, logos, tickers, product names,
              services and trademarks belong to their respective owners. Their
              appearance on StockGPT, LLC does not imply endorsement, partnership or
              affiliation.
            </p>

            <Subheading>3. OpenAI / GPT clarification</Subheading>
            <p>
              StockGPT, LLC is not OpenAI, ChatGPT or an official OpenAI product.
              StockGPT, LLC is not endorsed by, sponsored by, certified by or
              affiliated with OpenAI unless expressly stated in a signed written
              agreement. References to AI, GPT, APIs or model providers are
              descriptive only.
            </p>

            <Subheading>4. Copyright complaints</Subheading>
            <p>
              If you believe content on StockGPT, LLC infringes your rights, contact
              sales@stockgpt.pro with sufficient information to identify the content,
              your ownership or authority, and the action requested.
            </p>
          </Section>
        </div>

        <footer className="mt-10 border-t border-[#ddb159]/14 py-8 text-xs font-medium leading-6 text-[#faf6f0]/38">
          <p>
            © {new Date().getFullYear()} StockGPT, LLC. All rights
            reserved.
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/" className="hover:text-[#ddb159]">
              Landing
            </Link>
            <Link href="/dashboard" className="hover:text-[#ddb159]">
              Dashboard
            </Link>
            <Link href="/pricing" className="hover:text-[#ddb159]">
              Pricing
            </Link>
            <Link href="/affiliate" className="hover:text-[#ddb159]">
              Affiliate
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
