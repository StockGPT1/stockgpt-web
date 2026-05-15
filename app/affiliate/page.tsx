import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "StockGPT Affiliate Program",
  description:
    "Apply to become a StockGPT affiliate partner and earn commission from approved subscriber referrals.",
};

type AffiliateSearchParams = {
  application?: string;
};

function StatusMessage({ status }: { status?: string }) {
  if (status === "submitted") {
    return (
      <div className="rounded-2xl border border-[#00ff88]/25 bg-[#00ff88]/10 p-4 text-sm font-bold text-[#a7f3d0]">
        Application received. We will review your details and contact you if you
        are approved.
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
        Please complete your name, email and main platform before submitting.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
        Something went wrong. Please try again.
      </div>
    );
  }

  return null;
}

export default async function AffiliatePage({
  searchParams,
}: {
  searchParams?: Promise<AffiliateSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="h-[100dvh] overflow-y-auto bg-[#072116] text-[#e8f5e9]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(221,177,89,0.12),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(0,255,136,0.10),transparent_32%),linear-gradient(180deg,#072116,#03140c)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,136,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,136,0.04)_1px,transparent_1px)] bg-[size:76px_76px] opacity-35" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#03140c]/78 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/landing" className="relative h-10 w-[155px]">
            <Image
              src="/logo.png"
              alt="StockGPT"
              fill
              priority
              className="object-contain object-left"
              sizes="155px"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/landing"
              className="hidden rounded-full border border-white/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8] transition hover:border-[#00ff88]/40 hover:text-[#00ff88] sm:inline-flex"
            >
              Landing
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[#00ff88]/40 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#00ff88] transition hover:bg-[#00ff88]/10"
            >
              Log In →
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
              ✦ StockGPT Partner Program
            </p>

            <h1 className="font-serif text-5xl font-black leading-[0.95] tracking-[-0.05em] text-[#e8f5e9] sm:text-6xl lg:text-7xl">
              Earn by sending serious investors to StockGPT.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#94a3b8]">
              Apply to become an approved StockGPT affiliate partner. This is for
              finance creators, investing communities and operators who can
              promote the product with credibility.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["40%", "founding commission"],
                ["12 mo", "recurring window"],
                ["30 day", "tracking window"],
              ].map(([main, sub]) => (
                <div
                  key={sub}
                  className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
                >
                  <p className="font-mono text-4xl font-black text-[#ddb159]">
                    {main}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#94a3b8]">
                    {sub}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs leading-6 text-[#4a6a5a]">
              Commission terms can be adjusted for final approved partner
              contracts. This page collects applications; partner links are
              issued after approval.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
            <div className="mb-6">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00ff88]">
                Apply for approval
              </p>
              <h2 className="mt-2 font-serif text-3xl font-black tracking-[-0.04em]">
                Partner application
              </h2>
            </div>

            <div className="mb-5">
              <StatusMessage status={params.application} />
            </div>

            <form action="/api/affiliate-application" method="post" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                    Name
                  </span>
                  <input
                    name="full_name"
                    required
                    placeholder="Your name"
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/50 focus:border-[#00ff88]/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                    Email
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/50 focus:border-[#00ff88]/50"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                  Main platform
                </span>
                <input
                  name="platform"
                  required
                  placeholder="TikTok, Instagram, LinkedIn, newsletter, Discord, website..."
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/50 focus:border-[#00ff88]/50"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                    Audience size
                  </span>
                  <input
                    name="audience_size"
                    placeholder="e.g. 8,000 followers"
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/50 focus:border-[#00ff88]/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                    Audience type
                  </span>
                  <input
                    name="audience"
                    placeholder="Investors, finance students, traders..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/50 focus:border-[#00ff88]/50"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                  Why would you be a strong partner?
                </span>
                <textarea
                  name="message"
                  rows={5}
                  placeholder="Tell us how you would promote StockGPT, your audience, and why the fit makes sense."
                  className="w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 py-3 text-sm font-bold leading-7 text-[#e8f5e9] outline-none placeholder:text-[#94a3b8]/50 focus:border-[#00ff88]/50"
                />
              </label>

              <button
                type="submit"
                className="group relative flex h-13 w-full items-center justify-center overflow-hidden rounded-full bg-[#ddb159] text-sm font-black uppercase tracking-[0.16em] text-[#03140c] shadow-[0_18px_52px_rgba(221,177,89,0.20)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(221,177,89,0.32)]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-700 group-hover:translate-x-full" />
                <span className="relative">Submit Application →</span>
              </button>

              <p className="text-[11px] leading-6 text-[#4a6a5a]">
                Approved partners receive their tracking link after review.
                Please keep all content educational and compliant. StockGPT is
                not financial advice.
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/[0.08] bg-[#06180f] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-5 inline-flex rounded-full border border-[#00ff88]/20 bg-[#00ff88]/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#00ff88]">
            Partner standards
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              [
                "Premium positioning",
                "No cheap signal-group language. StockGPT should be positioned as AI research, rankings and intelligence.",
              ],
              [
                "Clear compliance",
                "Content must avoid financial advice claims and must not promise guaranteed returns.",
              ],
              [
                "Useful distribution",
                "Ideal partners have audiences interested in investing, markets, finance careers, business or AI tools.",
              ],
            ].map(([title, copy]) => (
              <article
                key={title}
                className="rounded-[1.7rem] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
              >
                <h3 className="font-serif text-3xl font-black tracking-[-0.04em] text-[#e8f5e9]">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#94a3b8]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-t border-white/[0.08] pt-8 sm:flex-row">
          <p className="text-sm font-bold text-[#94a3b8]">
            © StockGPT. Affiliate applications are reviewed manually.
          </p>
          <div className="flex gap-5 text-sm font-bold text-[#94a3b8]">
            <Link href="/landing" className="hover:text-[#00ff88]">
              Landing
            </Link>
            <Link href="/pricing" className="hover:text-[#00ff88]">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-[#00ff88]">
              Log In
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
