import type { Metadata } from "next";
import Link from "next/link";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";
import { LegalConsentLine } from "@/components/LegalConsentLine";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";

export const metadata: Metadata = {
  title: "Pricing | StockGPT AI Market Research Plans",
  description:
    "Choose a StockGPT plan for AI-powered stock rankings, portfolio insights and market research tools.",
};

type PricingSearchParams = {
  waitlist?: string;
  feature?: string;
};

const includedNow = [
  "Full S&P 500 AI rankings",
  "AI score context and model confidence",
  "Portfolio tools, watchlist and alerts",
  "World news with affected tickers",
  "Stock detail pages and peer comparison",
  "Ask StockGPT research assistant",
];

const comingSoon = [
  "Real-time score updates",
  "Historical AI score charts",
  "Advanced screening filters",
  "Deeper portfolio analytics",
  "API access",
  "Priority support",
];

function CheckIcon() {
  return <span className="mt-0.5 text-[13px] font-black text-emerald-300">✓</span>;
}

function LockIcon() {
  return <span className="mt-0.5 text-[13px] font-black text-[#faf6f0]/28">✦</span>;
}

function UpgradeNotice({ feature }: { feature?: string }) {
  if (!feature) return null;

  const label = feature
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <p className="mx-auto mt-3 max-w-xl rounded-2xl border border-[#ddb159]/28 bg-[#ddb159]/10 px-4 py-3 text-[12px] font-bold leading-5 text-[#f4d27a]">
      Unlock {label} with StockGPT Core. Review the plan below, then confirm before Stripe checkout.
    </p>
  );
}

function CoreCard({
  title,
  price,
  cadence,
  badge,
  note,
  plan,
  highlighted = false,
}: {
  title: string;
  price: string;
  cadence: string;
  badge?: string;
  note: string;
  plan: "monthly" | "annual";
  highlighted?: boolean;
}) {
  return (
    <div
      className={[
        "relative flex min-h-[420px] overflow-hidden rounded-3xl border p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6 lg:min-h-0",
        highlighted
          ? "border-[#ddb159]/70 bg-[#0d3420]/64"
          : "border-[#ddb159]/28 bg-[#0b2b1d]/54",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#ddb159]/12 blur-3xl" />
      <div className="relative flex w-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159]">
              {title}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <h2 className="text-[38px] font-black leading-none tracking-[-0.04em] sm:text-[42px]">
                {price}
              </h2>
              <p className="pb-1 text-[13px] font-bold text-[#faf6f0]/55">
                {cadence}
              </p>
            </div>
          </div>
          {badge && (
            <span className="shrink-0 rounded-full border border-[#ddb159]/35 bg-[#ddb159]/12 px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
              {badge}
            </span>
          )}
        </div>

        <p className="mt-3 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">
          {note}
        </p>

        <div className="mt-5 rounded-2xl border border-[#ddb159]/16 bg-[#04180f]/42 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Included now
          </p>
          <div className="mt-3 grid gap-2">
            {includedNow.map((feature) => (
              <div key={feature} className="flex items-start gap-2.5">
                <CheckIcon />
                <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/86">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form action="/checkout/confirm" method="get" className="mt-auto pt-5">
          <EndorselyReferralInput />
          <input type="hidden" name="plan" value={plan} />
          <button type="submit" className="flex h-11 w-full items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[13px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.2)] transition hover:bg-[#c9a04f] sm:h-12">
            Review {title}
          </button>
          <LegalConsentLine className="mt-3" />
        </form>
      </div>
    </div>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<PricingSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const waitlistStatus = params.waitlist;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(221,177,89,0.13),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(16,185,129,0.10),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(221,177,89,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035)_0_1px,transparent_1px_42px)] opacity-25" />
      </div>

      <div className="relative z-10 flex h-[52px] shrink-0 items-center justify-between border-b border-[#ddb159]/15 bg-[#04180f]/88 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="inline-flex items-center text-[17px] font-black text-[#faf6f0] transition hover:text-[#ddb159] sm:text-[20px]">
          ← StockGPT
        </Link>
        <Link href="/legal" className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ddb159] transition hover:text-[#f0c867]">
          Legal
        </Link>
      </div>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[11px]">
              Pricing
            </p>
            <h1 className="mt-2 text-[36px] font-black leading-[0.95] tracking-[-0.045em] sm:text-[48px]">
              Choose your StockGPT plan
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[14px] font-medium leading-relaxed text-[#faf6f0]/58 sm:text-[16px]">
              Core is live now. Executive remains waitlist-only while we build the advanced tier properly.
            </p>
            <UpgradeNotice feature={params.feature} />

            {waitlistStatus === "joined" && (
              <p className="mx-auto mt-3 max-w-md rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-[12px] font-bold text-emerald-200">
                You have joined the Executive waitlist.
              </p>
            )}
            {waitlistStatus === "error" && (
              <p className="mx-auto mt-3 max-w-md rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-200">
                Something went wrong. Please try again.
              </p>
            )}
            {waitlistStatus === "missing-email" && (
              <p className="mx-auto mt-3 max-w-md rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-200">
                Please enter an email address to join the waitlist.
              </p>
            )}
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_1fr_0.92fr]">
            <CoreCard title="Core monthly" price="£18.99" cadence="/ month" note="Flexible monthly access to the current Core platform." plan="monthly" />
            <CoreCard title="Core annual" price="£189.99" cadence="/ year" badge="Best value — 2 months free" note="Annual access with the same Core features, priced as 2 months free versus monthly." plan="annual" highlighted />

            <div className="relative flex min-h-[420px] overflow-hidden rounded-3xl border border-[#faf6f0]/12 bg-[#061b12]/62 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6">
              <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-[#ddb159]/7 blur-3xl" />
              <div className="relative flex w-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#faf6f0]/45">
                      Executive
                    </p>
                    <h2 className="mt-3 text-[38px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]/38">
                      Waitlist
                    </h2>
                  </div>
                  <div className="shrink-0 rounded-full border border-[#ddb159]/30 bg-[#072116]/80 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#ddb159]">
                    Coming soon
                  </div>
                </div>

                <p className="mt-3 text-[12px] font-medium leading-5 text-[#faf6f0]/38">
                  Executive is not live yet. Join the waitlist for advanced features when they are ready.
                </p>

                <div className="mt-5 rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/45">
                    Coming soon
                  </p>
                  <div className="mt-3 grid gap-2">
                    {comingSoon.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <LockIcon />
                        <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/38">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <form action="/api/premium-waitlist" method="post" className="mt-auto pt-5">
                  <input name="email" type="email" required placeholder="Email for waitlist" className="mb-2 h-10 w-full rounded-full border border-[#ddb159]/20 bg-[#04180f]/70 px-4 text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/60" />
                  <button type="submit" className="flex h-11 w-full items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116]/55 text-[13px] font-black text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10">
                    Join Executive waitlist
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="pb-6 pt-6 text-center">
            <p className="text-[11px] font-medium leading-relaxed text-[#faf6f0]/35 sm:text-[12px]">
              StockGPT provides AI-generated rankings for informational purposes only. This is not financial advice.
            </p>
            <div className="mt-3 flex justify-center">
              <LegalFooterLinks className="justify-center text-[#faf6f0]/42" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
