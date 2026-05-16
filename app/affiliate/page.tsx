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
      <div className="rounded-2xl border border-[#00ff88]/25 bg-[#00ff88]/10 p-4 text-sm font-bold leading-6 text-[#a7f3d0] shadow-[0_0_28px_rgba(0,255,136,0.08)]">
        Application received. We will review your details and contact you if you
        are approved.
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
        Please complete your name, email and main platform before submitting.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
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
    <main className="affiliate-page sg-candle-scrollbar h-[100dvh] overflow-y-auto bg-[#072116] text-[#e8f5e9]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=IBM+Plex+Mono:wght@500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .affiliate-page {
          font-family: "DM Sans", Inter, Arial, sans-serif;
          scroll-behavior: smooth;
        }

        .affiliate-heading {
          font-family: "Playfair Display", Georgia, serif;
          letter-spacing: -0.05em;
        }

        .affiliate-data {
          font-family: "IBM Plex Mono", "Courier New", monospace;
          letter-spacing: -0.035em;
        }

        .affiliate-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 80px rgba(0,0,0,0.24);
          transition: transform 300ms ease, border-color 300ms ease, box-shadow 300ms ease, background 300ms ease;
        }

        .affiliate-card:hover {
          transform: translateY(-5px);
          border-color: rgba(212,175,55,0.42);
          background: rgba(212,175,55,0.055);
          box-shadow: 0 30px 100px rgba(0,0,0,0.36), 0 0 48px rgba(212,175,55,0.10);
        }

        .affiliate-grid {
          background-image:
            linear-gradient(rgba(212,175,55,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.035) 1px, transparent 1px);
          background-size: 74px 74px;
          animation: affiliateGridMove 24s linear infinite;
          mask-image: radial-gradient(circle at 50% 12%, black 0%, transparent 78%);
        }

        .affiliate-glow {
          animation: affiliateGlow 5s ease-in-out infinite;
        }

        @keyframes affiliateGridMove {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-74px,74px,0); }
        }

        @keyframes affiliateGlow {
          0%, 100% { opacity: 0.32; transform: scale(0.98); }
          50% { opacity: 0.68; transform: scale(1.04); }
        }

        @media (prefers-reduced-motion: reduce) {
          .affiliate-grid,
          .affiliate-glow {
            animation: none !important;
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(212,175,55,0.15),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(0,255,136,0.08),transparent_32%),linear-gradient(180deg,#072116,#03140c)]" />
        <div className="affiliate-grid absolute inset-0 opacity-55" />
        <div className="affiliate-glow absolute left-1/2 top-[8%] h-[340px] w-[680px] -translate-x-1/2 rounded-full bg-[#D4AF37]/12 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[#00ff88]/8 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/18 bg-[#03140c]/82 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/landing" className="relative h-9 w-[132px] sm:h-10 sm:w-[155px]">
            <Image
              src="/logo.png"
              alt="StockGPT"
              fill
              priority
              className="object-contain object-left drop-shadow-[0_0_18px_rgba(212,175,55,0.16)]"
              sizes="155px"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/landing"
              className="hidden rounded-full border border-white/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8] transition hover:border-[#D4AF37]/45 hover:text-[#D4AF37] sm:inline-flex"
            >
              Landing
            </Link>

            <Link
              href="/pricing"
              className="hidden rounded-full border border-white/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#94a3b8] transition hover:border-[#D4AF37]/45 hover:text-[#D4AF37] sm:inline-flex"
            >
              Pricing
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/8 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#D4AF37] transition hover:bg-[#D4AF37]/14 sm:text-xs"
            >
              Log In →
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="lg:pt-4">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37] shadow-[0_0_34px_rgba(212,175,55,0.08)] sm:text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.8)]" />
              StockGPT Partner Program
            </p>

            <h1 className="affiliate-heading max-w-4xl text-[46px] font-black leading-[0.92] text-[#e8f5e9] sm:text-6xl lg:text-[72px] xl:text-[84px]">
              Earn by sending serious investors to StockGPT.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[#94a3b8] sm:text-lg lg:text-xl">
              Apply to become an approved StockGPT affiliate partner. Built for
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
                  className="affiliate-card rounded-3xl p-5"
                >
                  <p className="affiliate-data text-4xl font-black text-[#D4AF37] drop-shadow-[0_0_22px_rgba(212,175,55,0.22)]">
                    {main}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#94a3b8]">
                    {sub}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-[#D4AF37]/18 bg-[#D4AF37]/8 p-5">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#D4AF37]">
                Premium partner standard
              </p>
              <p className="mt-3 text-sm leading-7 text-[#94a3b8]">
                StockGPT should be positioned as AI research, rankings and
                intelligence. No cheap signal-group language. No guaranteed
                return claims. No financial advice.
              </p>
            </div>

            <p className="mt-5 text-xs leading-6 text-[#4a6a5a]">
              Commission terms can be adjusted for final approved partner
              contracts. This page collects applications; partner links are
              issued after approval.
            </p>
          </div>

          <div className="rounded-[1.7rem] border border-[#D4AF37]/24 bg-white/[0.045] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.42),0_0_80px_rgba(212,175,55,0.08)] backdrop-blur-xl sm:rounded-[2rem] sm:p-6 lg:p-8">
            <div className="mb-6 border-b border-white/[0.08] pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37] sm:text-[11px]">
                Apply for approval
              </p>
              <h2 className="affiliate-heading mt-2 text-3xl font-black tracking-[-0.04em] text-[#e8f5e9] sm:text-4xl">
                Partner application
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#94a3b8]">
                Tell us where you would promote StockGPT and why your audience is
                a strong fit.
              </p>
            </div>

            <div className="mb-5">
              <StatusMessage status={params.application} />
            </div>

            <form action="/api/affiliate-application" method="post" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                    Name
                  </span>
                  <input
                    name="full_name"
                    required
                    placeholder="Your name"
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none transition placeholder:text-[#94a3b8]/50 focus:border-[#D4AF37]/60 focus:shadow-[0_0_24px_rgba(212,175,55,0.10)]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                    Email
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none transition placeholder:text-[#94a3b8]/50 focus:border-[#D4AF37]/60 focus:shadow-[0_0_24px_rgba(212,175,55,0.10)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                  Main platform
                </span>
                <input
                  name="platform"
                  required
                  placeholder="TikTok, Instagram, LinkedIn, newsletter, Discord, website..."
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none transition placeholder:text-[#94a3b8]/50 focus:border-[#D4AF37]/60 focus:shadow-[0_0_24px_rgba(212,175,55,0.10)]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                    Audience size
                  </span>
                  <input
                    name="audience_size"
                    placeholder="e.g. 8,000 followers"
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none transition placeholder:text-[#94a3b8]/50 focus:border-[#D4AF37]/60 focus:shadow-[0_0_24px_rgba(212,175,55,0.10)]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                    Audience type
                  </span>
                  <input
                    name="audience"
                    placeholder="Investors, finance students, traders..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 text-sm font-bold text-[#e8f5e9] outline-none transition placeholder:text-[#94a3b8]/50 focus:border-[#D4AF37]/60 focus:shadow-[0_0_24px_rgba(212,175,55,0.10)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                  Why would you be a strong partner?
                </span>
                <textarea
                  name="message"
                  rows={5}
                  placeholder="Tell us how you would promote StockGPT, your audience, and why the fit makes sense."
                  className="w-full rounded-2xl border border-white/[0.08] bg-[#03140c] px-4 py-3 text-sm font-bold leading-7 text-[#e8f5e9] outline-none transition placeholder:text-[#94a3b8]/50 focus:border-[#D4AF37]/60 focus:shadow-[0_0_24px_rgba(212,175,55,0.10)]"
                />
              </label>

              <button
                type="submit"
                className="group relative flex h-13 w-full items-center justify-center overflow-hidden rounded-full bg-[#D4AF37] text-sm font-black uppercase tracking-[0.16em] text-[#03140c] shadow-[0_18px_52px_rgba(212,175,55,0.22)] transition hover:-translate-y-1 hover:bg-[#ddb159] hover:shadow-[0_24px_70px_rgba(212,175,55,0.34)]"
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
          <p className="mb-5 inline-flex rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
            Partner Standards
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              [
                "Premium positioning",
                "StockGPT should be presented as a premium AI investing research platform, not a hype signal group.",
              ],
              [
                "Clear compliance",
                "Content must avoid financial advice claims, guaranteed returns, or misleading performance promises.",
              ],
              [
                "Useful distribution",
                "Ideal partners have audiences interested in investing, business, finance careers, AI tools or market research.",
              ],
            ].map(([title, copy]) => (
              <article
                key={title}
                className="affiliate-card rounded-[1.7rem] p-6"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/28 bg-[#D4AF37]/10 text-2xl text-[#D4AF37] shadow-[0_0_28px_rgba(212,175,55,0.10)]">
                  ✦
                </div>
                <h3 className="affiliate-heading text-3xl font-black tracking-[-0.04em] text-[#e8f5e9]">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#94a3b8]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[#D4AF37]/22 bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(255,255,255,0.035)_45%,rgba(0,255,136,0.035))] p-6 shadow-[0_34px_100px_rgba(0,0,0,0.34)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#D4AF37]">
                Ready to partner?
              </p>
              <h2 className="affiliate-heading mt-3 text-4xl font-black leading-tight text-[#e8f5e9] sm:text-5xl">
                Build a serious affiliate channel around a serious product.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#94a3b8]">
                Apply once. If approved, you will receive the correct tracking
                process and partner guidance.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href="#top"
                className="hidden"
                aria-hidden="true"
              >
                Top
              </a>
              <Link
                href="/landing"
                className="inline-flex w-full items-center justify-center rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/10 px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#D4AF37] transition hover:-translate-y-1 hover:bg-[#D4AF37]/16"
              >
                View Landing Page →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#D4AF37] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#03140c] transition hover:-translate-y-1 hover:bg-[#ddb159]"
              >
                View Subscription →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 border-t border-white/[0.08] pt-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="relative h-11 w-[160px]">
              <Image
                src="/logo.png"
                alt="StockGPT"
                fill
                className="object-contain object-left"
                sizes="160px"
              />
            </div>
            <p className="mt-4 max-w-xl text-[11px] leading-6 text-[#4a6a5a]">
              StockGPT is an AI-powered research and ranking tool. All content is
              for informational and educational purposes only. Nothing on this
              platform constitutes financial advice, investment advice, or a
              recommendation to buy or sell any security. Past performance is not
              indicative of future results.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm font-bold text-[#94a3b8] sm:flex-row sm:justify-end">
            <Link href="/landing" className="hover:text-[#D4AF37]">
              Landing
            </Link>
            <Link href="/pricing" className="hover:text-[#D4AF37]">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-[#D4AF37]">
              Log In
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
