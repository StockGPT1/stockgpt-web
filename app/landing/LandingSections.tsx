"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

/* ================================================================== */
/*  Below-the-fold landing sections                                    */
/*                                                                     */
/*  Everything after the scroll story: normal document flow,           */
/*  Revolut-style rounded glass cards, scroll-triggered reveals,       */
/*  pricing, FAQ, trust band, closing CTA and the full site footer.    */
/*  Rendered inside .sl-root, so the landing's sl-* utilities apply.   */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  Socials — single source of truth for the whole landing            */
/* ------------------------------------------------------------------ */

export const SOCIALS = [
  {
    label: "TikTok — @stockgptltd",
    href: "https://www.tiktok.com/@stockgptltd",
    icon: (
      <path d="M16.6 3c.4 2.1 1.9 3.7 4 4v3.1c-1.5 0-2.9-.5-4-1.3v6.7a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.2a2.9 2.9 0 1 0 2 2.7V3h3z" />
    ),
  },
  {
    label: "Instagram — @stockgptpro2",
    href: "https://www.instagram.com/stockgptpro2",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" strokeWidth="2" stroke="currentColor" />
        <circle cx="12" cy="12" r="4.1" fill="none" strokeWidth="2" stroke="currentColor" />
        <circle cx="17.2" cy="6.8" r="1.3" />
      </>
    ),
  },
  {
    label: "X — @stockgptpro",
    href: "https://x.com/stockgptpro",
    icon: (
      <path d="M18.9 2H22l-7.9 9.1L23.2 22h-6.8l-5.3-6.6L5 22H1.9l8.5-9.7L1.3 2h7l4.8 6.1L18.9 2zm-1.2 18h1.7L7.3 3.9H5.5L17.7 20z" />
    ),
  },
];

export function SocialIconLink({
  social,
  className = "",
}: {
  social: (typeof SOCIALS)[number];
  className?: string;
}) {
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={social.label}
      className={`sl-social grid size-11 place-items-center rounded-full border border-white/12 bg-white/[0.03] !text-white/55 no-underline backdrop-blur-sm transition hover:border-[#ddb159] hover:bg-[#ddb159]/10 hover:!text-[#ddb159] hover:shadow-[0_0_22px_rgba(221,177,89,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[17px]" fill="currentColor" aria-hidden="true">
        {social.icon}
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Reveal — IntersectionObserver-driven entrance                     */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.in = "1";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.dataset.in = "1";
            io.disconnect();
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-in="0"
      className={`ls-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Reveal>
        <p className="sl-mono text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
          {eyebrow}
        </p>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="mt-4 text-[clamp(30px,4.6vw,54px)] font-black leading-[1.03] tracking-[-0.04em] text-white">
          {title}
        </h2>
      </Reveal>
      {body && (
        <Reveal delay={160}>
          <p className="mx-auto mt-4 max-w-2xl text-[clamp(13px,1.25vw,16px)] font-medium leading-relaxed text-white/55">
            {body}
          </p>
        </Reveal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  1 · How it works                                                  */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    index: "01",
    title: "Create your free account",
    body: "No card required. You get the dashboard, your watchlist and a feel for the workflow in about a minute.",
  },
  {
    index: "02",
    title: "Meet your ranked universe",
    body: "500+ US stocks, scored across six factors every market day, sorted into one list you can actually work through.",
  },
  {
    index: "03",
    title: "Build, import and monitor",
    body: "Generate a portfolio from your risk profile or import real positions — then let the model watch exposure, alerts and weak ranks for you.",
  },
];

function HowItWorks() {
  return (
    <section className="relative px-5 py-[12vh] sm:px-8">
      <SectionHeading
        eyebrow="How it works"
        title={
          <>
            Up and running <span className="sl-gold">in three steps.</span>
          </>
        }
      />
      <div className="relative mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
        {/* connective gradient rail behind the cards */}
        <div
          aria-hidden="true"
          className="absolute left-[8%] right-[8%] top-[44px] hidden h-px bg-[linear-gradient(90deg,transparent,rgba(221,177,89,0.4)_18%,rgba(221,177,89,0.4)_82%,transparent)] md:block"
        />
        {STEPS.map((step, i) => (
          <Reveal key={step.index} delay={i * 110}>
            <div className="ls-card relative h-full rounded-[26px] border border-white/10 bg-white/[0.028] p-7 backdrop-blur-sm">
              <span className="sl-mono grid size-[54px] place-items-center rounded-2xl border border-[#ddb159]/35 bg-[#ddb159]/10 text-[15px] font-black text-[#ddb159]">
                {step.index}
              </span>
              <h3 className="mt-5 text-[19px] font-black tracking-[-0.02em] text-white">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[13px] font-medium leading-relaxed text-white/52">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · Feature grid                                                  */
/* ------------------------------------------------------------------ */

const FEATURES: {
  title: string;
  body: string;
  tag: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    title: "Daily rankings",
    body: "Every stock scored on quality, growth, value, momentum, risk and income — refreshed each market day.",
    tag: "The core engine",
    href: "/signup",
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    title: "Portfolio Builder",
    body: "Describe your risk appetite and horizon; get a fully-weighted draft allocation from the live rankings in seconds.",
    tag: "Risk-based generation",
    href: "/signup",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9l6.5 4" />
      </>
    ),
  },
  {
    title: "Position monitoring",
    body: "Import your real holdings and StockGPT tracks exposure, concentration, alerts and rank changes continuously.",
    tag: "Trading 212 CSV import",
    href: "/signup",
    icon: (
      <>
        <path d="M3 17l5-5 4 3 6-7 3 3" />
        <path d="M3 21h18" />
      </>
    ),
  },
  {
    title: "World News",
    body: "Global headlines mapped to the tickers and sectors they actually move, scored for impact in plain English.",
    tag: "Impact scoring",
    href: "/signup",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
  {
    title: "Ask StockGPT",
    body: "An AI analyst grounded in the same model that builds the rankings. Question a score, stress-test a thesis.",
    tag: "Answers with receipts",
    href: "/signup",
    icon: (
      <>
        <path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z" />
        <path d="M9 11h6" />
      </>
    ),
  },
  {
    title: "Alerts & reviews",
    body: "Action alerts when a holding deteriorates, stop-loss and take-profit guardrails, and review nudges that keep discipline.",
    tag: "Discipline, automated",
    href: "/signup",
    icon: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      </>
    ),
  },
];

function FeatureGrid() {
  return (
    <section className="relative px-5 py-[10vh] sm:px-8">
      <SectionHeading
        eyebrow="The terminal"
        title={
          <>
            Everything in <span className="sl-gold">one place.</span>
          </>
        }
        body="Six tools that share one brain. The rankings feed the portfolio, the portfolio feeds the alerts, and Ask StockGPT can explain any of it."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={(i % 3) * 90}>
            <Link
              href={feature.href}
              className="ls-card group relative flex h-full flex-col overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.028] p-7 no-underline backdrop-blur-sm"
            >
              <span className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[#ddb159]/0 blur-3xl transition-all duration-500 group-hover:bg-[#ddb159]/14" />
              <span className="grid size-12 place-items-center rounded-2xl border border-[#ddb159]/25 bg-[#ddb159]/8 text-[#ddb159]">
                <svg
                  viewBox="0 0 24 24"
                  className="size-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {feature.icon}
                </svg>
              </span>
              <h3 className="mt-5 text-[18px] font-black tracking-[-0.02em] !text-white">
                {feature.title}
              </h3>
              <p className="mt-2 flex-1 text-[12.5px] font-medium leading-relaxed !text-white/52">
                {feature.body}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="sl-mono text-[9px] font-black uppercase tracking-[0.18em] !text-[#ddb159]/75">
                  {feature.tag}
                </span>
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full border border-white/12 !text-white/45 transition group-hover:border-[#ddb159] group-hover:!text-[#ddb159]"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  3 · Value marquee — two drifting rows of product statements       */
/* ------------------------------------------------------------------ */

const VALUE_ROW_A = [
  "One score per stock",
  "Six factors, refreshed daily",
  "No spreadsheets",
  "Rank moves you can question",
  "Plain-English answers",
  "Built for retail investors",
];

const VALUE_ROW_B = [
  "Import from Trading 212",
  "Concentration warnings",
  "Stop-loss discipline",
  "Sector exposure maps",
  "Impact-scored news",
  "Cancel anytime",
];

function ValueChipRun({ items, half }: { items: string[]; half: string }) {
  return (
    <>
      {items.map((item) => (
        <span key={`${half}-${item}`} className="flex items-center gap-5 pr-5">
          <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[12px] font-black text-white/62">
            {item}
          </span>
          <span className="text-[9px] text-[#ddb159]/60">◆</span>
        </span>
      ))}
    </>
  );
}

function ValueMarquee() {
  return (
    <section aria-hidden="true" className="space-y-4 overflow-hidden py-[6vh]">
      <div className="sl-tape-track flex w-max items-center" style={{ animationDuration: "52s" }}>
        <ValueChipRun items={VALUE_ROW_A} half="a" />
        <ValueChipRun items={VALUE_ROW_A} half="b" />
      </div>
      <div
        className="sl-tape-track sl-tape-rev flex w-max items-center"
        style={{ animationDuration: "64s" }}
      >
        <ValueChipRun items={VALUE_ROW_B} half="a" />
        <ValueChipRun items={VALUE_ROW_B} half="b" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  4 · Pricing                                                       */
/* ------------------------------------------------------------------ */

const FREE_POINTS = [
  "Create your account in a minute — no card",
  "Explore the dashboard and workflow",
  "See how rankings, portfolio and news fit together",
];

const PRO_POINTS = [
  "Full daily rankings across 500+ US stocks",
  "Portfolio Builder, imports and monitoring",
  "World News with ticker impact mapping",
  "Ask StockGPT — the grounded AI analyst",
  "Action alerts, stop-loss and review discipline",
];

function CheckItem({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
          gold ? "bg-[#071b11]/15 text-[#071b11]" : "bg-[#ddb159]/12 text-[#ddb159]"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.2">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span
        className={`text-[13px] font-semibold leading-relaxed ${
          gold ? "text-[#071b11]/85" : "text-white/62"
        }`}
      >
        {children}
      </span>
    </li>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="relative px-5 py-[10vh] sm:px-8">
      <SectionHeading
        eyebrow="Pricing"
        title={
          <>
            Start free. <span className="sl-gold">Upgrade when it clicks.</span>
          </>
        }
        body="Everything upgrades inside the app — no sales calls, no lock-in."
      />
      <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal>
          <div className="ls-card flex h-full flex-col rounded-[28px] border border-white/10 bg-white/[0.028] p-8 backdrop-blur-sm">
            <p className="sl-mono text-[10px] font-black uppercase tracking-[0.26em] text-white/45">
              Free
            </p>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[44px] font-black leading-none tracking-[-0.04em] text-white">
                £0
              </span>
              <span className="text-[12px] font-bold text-white/40">forever</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3.5">
              {FREE_POINTS.map((point) => (
                <CheckItem key={point}>{point}</CheckItem>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-[12px] font-black uppercase tracking-[0.14em] !text-white no-underline transition hover:border-[#ddb159]/60 hover:bg-[#ddb159]/10"
            >
              Create free account
            </Link>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="ls-card relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#ddb159] bg-[linear-gradient(150deg,#f4d78a_0%,#ddb159_55%,#c08f2f_100%)] p-8 shadow-[0_30px_90px_rgba(221,177,89,0.28)]">
            <span className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-white/25 blur-3xl" />
            <div className="flex items-center justify-between">
              <p className="sl-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#071b11]/70">
                Pro
              </p>
              <span className="rounded-full bg-[#071b11] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                Full access
              </span>
            </div>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[44px] font-black leading-none tracking-[-0.04em] text-[#071b11]">
                £18.99
              </span>
              <span className="text-[12px] font-bold text-[#071b11]/60">/ month</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3.5">
              {PRO_POINTS.map((point) => (
                <CheckItem key={point} gold>
                  {point}
                </CheckItem>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#071b11] text-[12px] font-black uppercase tracking-[0.14em] !text-[#f4d78a] no-underline transition hover:brightness-110"
            >
              Start with Pro
            </Link>
            <p className="mt-3 text-center text-[10px] font-bold text-[#071b11]/55">
              Cancel anytime, inside the app.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  5 · Trust band                                                    */
/* ------------------------------------------------------------------ */

const TRUST_POINTS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Encrypted in transit",
    body: "Everything between you and StockGPT travels over TLS.",
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    title: "Payments by Stripe",
    body: "Card details never touch our servers — billing runs through Stripe.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3 10h18" />
      </>
    ),
  },
  {
    title: "Your data stays yours",
    body: "Export or delete your portfolios and history whenever you like.",
    icon: (
      <>
        <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    title: "Research, not advice",
    body: "Decision support with receipts — never guaranteed returns.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.5" />
      </>
    ),
  },
];

function TrustBand() {
  return (
    <section className="relative px-5 py-[9vh] sm:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm sm:p-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 90}>
              <div>
                <span className="grid size-11 place-items-center rounded-xl border border-[#ddb159]/25 bg-[#ddb159]/8 text-[#ddb159]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {point.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-[15px] font-black tracking-[-0.01em] text-white">
                  {point.title}
                </h3>
                <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-white/48">
                  {point.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  6 · FAQ                                                           */
/* ------------------------------------------------------------------ */

const FAQS = [
  {
    q: "What exactly is StockGPT?",
    a: "A research and ranking terminal. A model scores 500+ US stocks every market day across quality, growth, value, momentum, risk and income, and every tool on the site — rankings, portfolio builder, monitoring, news and the AI analyst — works from that same output.",
  },
  {
    q: "Is this financial advice?",
    a: "No. StockGPT is decision support: it shows you scores, ranks, exposures and the reasoning behind them, but it never tells you what you must buy or sell, and it never guarantees returns. Always do your own research.",
  },
  {
    q: "What do I get for free?",
    a: "Creating an account is free and doesn't need a card. You get the dashboard and a real feel for the workflow, so you can decide whether Pro is worth it before paying anything.",
  },
  {
    q: "What does Pro include?",
    a: "Everything: the full daily rankings, portfolio generation and monitoring, imports, world news with impact mapping, Ask StockGPT, and the alerting system. One plan, no tiers within tiers.",
  },
  {
    q: "Can I import my existing portfolio?",
    a: "Yes — import positions from a Trading 212 CSV export or add holdings manually. Once imported, monitoring, alerts and exposure analysis run over your real book.",
  },
  {
    q: "Can I cancel whenever I want?",
    a: "Yes. Subscriptions are managed inside the app and billed through Stripe — cancel in a couple of clicks and you keep access until the end of the period you've paid for.",
  },
];

function FaqSection() {
  return (
    <section id="faq" className="relative px-5 py-[10vh] sm:px-8">
      <SectionHeading
        eyebrow="Questions"
        title={
          <>
            Asked and <span className="sl-gold">answered.</span>
          </>
        }
      />
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQS.map((faq, i) => (
          <Reveal key={faq.q} delay={i * 60}>
            <details className="ls-faq group rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="text-[15px] font-black tracking-[-0.01em] text-white">
                  {faq.q}
                </span>
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-white/12 text-white/50 transition-transform duration-300 group-open:rotate-45 group-open:border-[#ddb159] group-open:text-[#ddb159]"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="px-6 pb-6 text-[13px] font-medium leading-relaxed text-white/55">
                {faq.a}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  7 · Closing CTA                                                   */
/* ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <section className="relative px-5 py-[10vh] sm:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-[#ddb159]/45 bg-[linear-gradient(155deg,#0d2a1b_0%,#071c11_55%,#04130b_100%)] px-6 py-16 text-center sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_-10%,rgba(221,177,89,0.22),transparent_65%)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[1.2em] left-1/2 -translate-x-1/2 whitespace-nowrap text-[16vw] font-black leading-none tracking-[-0.06em] text-white/[0.035]"
          >
            STOCKGPT
          </span>
          <p className="sl-mono relative text-[11px] font-black uppercase tracking-[0.34em] text-[#ddb159]">
            Ready when you are
          </p>
          <h2 className="relative mt-4 text-[clamp(32px,5.4vw,64px)] font-black leading-[1.02] tracking-[-0.045em] text-white">
            Your research, <span className="sl-gold">structured.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[clamp(13px,1.25vw,16px)] font-medium leading-relaxed text-white/55">
            One account. Every stock scored. A portfolio that watches itself. Start free
            and see the difference structure makes.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="fx-sheen inline-flex h-13 min-h-12 items-center justify-center rounded-full border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a_0%,#ddb159_55%,#c99a3e_100%)] px-8 text-[12px] font-black uppercase tracking-[0.16em] !text-[#071b11] no-underline shadow-[0_14px_50px_rgba(221,177,89,0.35)] transition hover:brightness-105"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="inline-flex h-13 min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] px-8 text-[12px] font-black uppercase tracking-[0.16em] !text-white no-underline transition hover:bg-white/[0.09]"
            >
              Log in
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  8 · Site footer                                                   */
/* ------------------------------------------------------------------ */

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Rankings", href: "/signup" },
      { label: "Portfolio Builder", href: "/signup" },
      { label: "World News", href: "/signup" },
      { label: "Ask StockGPT", href: "/signup" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Affiliate programme", href: "/affiliate" },
      { label: "Guides", href: "/guides/how-to-research-a-stock" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/legal#terms" },
      { label: "Privacy", href: "/legal#privacy" },
      { label: "All legal", href: "/legal" },
    ],
  },
];

function SiteFooter() {
  return (
    <footer className="relative border-t border-white/8 px-5 pb-10 pt-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="text-[22px] font-black tracking-[-0.03em] text-white">
            Stock<span className="sl-gold">GPT</span>
          </p>
          <p className="mt-3 max-w-[17rem] text-[12px] font-medium leading-relaxed text-white/45">
            AI-driven market insights. 500+ US stocks scored daily — one workflow for
            rankings, portfolio and research.
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            {SOCIALS.map((social) => (
              <SocialIconLink key={social.href} social={social} className="!size-10" />
            ))}
          </div>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="sl-mono text-[9.5px] font-black uppercase tracking-[0.26em] text-[#ddb159]/80">
              {column.heading}
            </p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[12.5px] font-bold !text-white/55 no-underline transition hover:!text-[#ddb159]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/8 pt-6">
        <p className="text-[10px] font-medium leading-5 text-white/32">
          StockGPT is a research and ranking tool. All content is for informational and
          educational purposes only and does not constitute financial advice or a
          recommendation to buy or sell any security. Investing involves risk — always do
          your own research. © 2026 StockGPT.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Assembly                                                          */
/* ------------------------------------------------------------------ */

export function LandingBelowFold() {
  return (
    <div className="ls-root relative bg-[#020806]">
      <style>{`
        .ls-reveal {
          opacity: 0;
          transform: translateY(26px);
          transition: opacity 700ms cubic-bezier(0.22, 0.9, 0.3, 1), transform 700ms cubic-bezier(0.22, 0.9, 0.3, 1);
          will-change: opacity, transform;
        }
        .ls-reveal[data-in="1"] { opacity: 1; transform: none; }
        .ls-card {
          transition: transform 350ms cubic-bezier(0.22, 1, 0.36, 1), border-color 350ms ease, box-shadow 350ms ease;
        }
        .ls-card:hover {
          transform: translateY(-5px);
          border-color: rgba(221, 177, 89, 0.4);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45), 0 0 40px rgba(221, 177, 89, 0.08);
        }
        .ls-faq p { animation: lsFaqIn 300ms ease; }
        @keyframes lsFaqIn { from { opacity: 0; transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) {
          .ls-reveal { transition: none; opacity: 1; transform: none; }
          .ls-card, .ls-card:hover { transform: none; }
          .ls-faq p { animation: none; }
        }
      `}</style>

      {/* soft seam out of the scroll story */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,#01110a,transparent)]"
      />

      <HowItWorks />
      <ValueMarquee />
      <FeatureGrid />
      <PricingSection />
      <TrustBand />
      <FaqSection />
      <ClosingCta />
      <SiteFooter />
    </div>
  );
}
