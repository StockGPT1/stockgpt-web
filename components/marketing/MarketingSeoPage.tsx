import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import { LandingOfferPopup } from "@/components/marketing/LandingOfferPopup";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { marketingPages, type MarketingPage } from "@/lib/marketingPages";

const BASE_URL = "https://stockgpt.pro";

function pathFor(page: MarketingPage) {
  return `/${page.kind}/${page.slug}`;
}

export function getMarketingMetadata(page: MarketingPage): Metadata {
  const canonical = pathFor(page);

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      title: page.title,
      description: page.description,
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
  };
}

function relatedPages(page: MarketingPage) {
  const currentIndex = marketingPages.findIndex(
    (candidate) => candidate.kind === page.kind && candidate.slug === page.slug,
  );

  return [1, 4, 9]
    .map((offset) => marketingPages[(currentIndex + offset) % marketingPages.length])
    .filter((candidate) => candidate.slug !== page.slug)
    .slice(0, 3);
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function MarketingSeoPage({ page }: { page: MarketingPage }) {
  const canonicalPath = pathFor(page);
  const source = `seo_${page.slug}`;
  const related = relatedPages(page);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "StockGPT", item: BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: page.kind === "use-cases" ? "Use cases" : page.kind === "guides" ? "Guides" : "Comparisons",
        item: `${BASE_URL}/${page.kind}`,
      },
      { "@type": "ListItem", position: 3, name: page.h1, item: `${BASE_URL}${canonicalPath}` },
    ],
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#fbfaf6] text-[#0a2d1d]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      <header className="border-b border-[#ddb159]/18 bg-[#04180f] text-white">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="StockGPT home" className="relative h-11 w-[150px] shrink-0">
            <Image src="/logo.png" alt="StockGPT" fill priority className="object-contain object-left" sizes="150px" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/demo" className="hidden rounded-full border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white sm:inline-flex">
              Product tour
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#072116]">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#dfe5dc] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(221,177,89,0.18),transparent_28%),radial-gradient(circle_at_12%_8%,rgba(7,33,22,0.08),transparent_26%)]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="inline-flex rounded-full border border-[#ddb159]/30 bg-[#fff8e6] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            StockGPT Research
          </p>
          <h1 className="mt-6 font-serif text-[42px] font-medium leading-[0.98] tracking-[-0.045em] text-[#071b11] sm:text-6xl lg:text-7xl">
            {page.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-[15px] font-medium leading-7 text-[#546359] sm:text-lg sm:leading-8">
            {page.intro}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedLink
              href="/demo"
              eventName="seo_page_cta_clicked"
              eventProperties={{ slug: page.slug, destination: "demo" }}
              className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#0a2d1d] px-7 text-center text-[12px] font-black uppercase tracking-[0.13em] !text-white"
            >
              Take the 60-second tour
            </TrackedLink>
            <TrackedLink
              href={`/signup?coupon=50PORTFOLIO2026&source=${source}`}
              eventName="seo_page_cta_clicked"
              eventProperties={{ slug: page.slug, destination: "signup" }}
              className="inline-flex min-h-13 items-center justify-center rounded-full border border-[#0a2d1d]/18 bg-white px-7 text-center text-[12px] font-black uppercase tracking-[0.13em] text-[#0a2d1d]"
            >
              Create account
            </TrackedLink>
          </div>
          <p className="mt-4 text-[11px] font-semibold text-[#6b776f]">
            Educational research only · not financial advice · no buy/sell signals
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="helps-heading">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">Practical workflow</p>
          <h2 id="helps-heading" className="mt-2 font-serif text-4xl tracking-[-0.035em] text-[#071b11] sm:text-5xl">
            What this helps with
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {page.helps.map(([title, copy], index) => (
              <article key={title} className="rounded-[24px] border border-[#dfe5dc] bg-white p-5 shadow-[0_14px_40px_rgba(7,27,17,0.045)]">
                <p className="font-mono text-[10px] font-black text-[#ddb159]">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-black tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[#66746b]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <article className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">Education first</p>
            <h2 className="mt-2 font-serif text-4xl leading-tight tracking-[-0.035em] text-[#071b11] sm:text-5xl">
              {page.education.heading}
            </h2>
            <div className="mt-6 grid gap-4 text-[15px] font-medium leading-8 text-[#58665d]">
              {page.education.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </article>
          <aside className="rounded-[28px] bg-[#071f15] p-6 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Common mistakes</p>
            <ul className="mt-5 grid gap-3">
              {page.education.mistakes.map((mistake) => (
                <li key={mistake} className="flex gap-3 text-sm font-semibold leading-6 text-white/66">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#ddb159]" />
                  {mistake}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="workflow-heading">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">Inside the product</p>
          <h2 id="workflow-heading" className="mt-2 font-serif text-4xl tracking-[-0.035em] text-[#071b11] sm:text-5xl">
            How StockGPT fits
          </h2>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {page.workflow.map(([title, copy], index) => (
              <article key={title} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-[24px] border border-[#dfe5dc] bg-white p-5">
                <span className="grid size-10 place-items-center rounded-full bg-[#ddb159] text-sm font-black text-[#072116]">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-lg font-black">{title}</h3>
                  <p className="mt-1 text-sm font-medium leading-6 text-[#66746b]">{copy}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-3 rounded-[28px] border border-[#ddb159]/25 bg-[#fff8e6] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
            <div>
              <p className="text-sm font-black text-[#071b11]">Continue inside the research workflow</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#66746b]">
                Build an educational Portfolio Draft or run a StockGPT Check to challenge an idea.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <TrackedLink
                href={`/signup?coupon=50PORTFOLIO2026&source=${source}_portfolio`}
                eventName="seo_page_cta_clicked"
                eventProperties={{ slug: page.slug, destination: "portfolio_draft" }}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0a2d1d] px-5 text-[11px] font-black !text-white"
              >
                Build Portfolio Draft
              </TrackedLink>
              <TrackedLink
                href={`/signup?coupon=50PORTFOLIO2026&source=${source}_stock_check`}
                eventName="seo_page_cta_clicked"
                eventProperties={{ slug: page.slug, destination: "stockgpt_check" }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0a2d1d]/18 bg-white px-5 text-[11px] font-black text-[#0a2d1d]"
              >
                Run StockGPT Check
              </TrackedLink>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-[#ddb159]/28 bg-[#061b12] p-6 text-white sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Important</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Research support, not a decision or signal.</h2>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-white/58">
            StockGPT provides educational and informational research. It does not provide financial advice, guarantee outcomes or tell you to buy or sell. Use every ranking, Portfolio Draft and trade-plan analysis as a starting point before making your own decision.
          </p>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">Questions</p>
          <h2 id="faq-heading" className="mt-2 text-center font-serif text-4xl tracking-[-0.035em] text-[#071b11] sm:text-5xl">
            Frequently asked questions
          </h2>
          <div className="mt-7 grid gap-3">
            {page.faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0} className="rounded-2xl border border-[#dfe5dc] bg-[#fbfaf6] p-5">
                <summary className="cursor-pointer list-none text-base font-black">{question}</summary>
                <p className="mt-3 text-sm font-medium leading-7 text-[#66746b]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] bg-[#fff8e6] p-7 text-center sm:p-10">
          <h2 className="font-serif text-4xl tracking-[-0.04em] text-[#071b11] sm:text-5xl">Research before you react.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#66746b]">
            See the complete fake-data workflow, then create an account when you are ready to start your own research.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedLink href="/demo" eventName="seo_page_cta_clicked" eventProperties={{ slug: page.slug, destination: "demo_final" }} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0a2d1d] px-7 text-[12px] font-black uppercase tracking-[0.12em] !text-white">
              Take the tour
            </TrackedLink>
            <TrackedLink href={`/signup?coupon=50PORTFOLIO2026&source=${source}`} eventName="seo_page_cta_clicked" eventProperties={{ slug: page.slug, destination: "signup_final" }} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#0a2d1d]/18 bg-white px-7 text-[12px] font-black uppercase tracking-[0.12em] text-[#0a2d1d]">
              Create account
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe5dc] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#8a6828]">Keep researching</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {related.map((relatedPage) => (
              <Link key={`${relatedPage.kind}-${relatedPage.slug}`} href={pathFor(relatedPage)} className="rounded-2xl border border-[#dfe5dc] bg-white p-4 transition hover:border-[#ddb159]">
                <p className="text-sm font-black">{relatedPage.h1}</p>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-[#66746b]">{relatedPage.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#061b12] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-white/45">© {new Date().getFullYear()} StockGPT LLC. Educational research only.</p>
          <LegalFooterLinks className="text-white/48" />
        </div>
      </footer>

      <LandingOfferPopup />
    </main>
  );
}
