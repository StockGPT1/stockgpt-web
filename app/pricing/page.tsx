import type { Metadata } from "next";
import Link from "next/link";
import { EndorselyReferralInput } from "@/components/EndorselyReferralInput";
import { LegalConsentLine } from "@/components/LegalConsentLine";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { StockIcon } from "@/components/StockIcon";

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
  "AI score context and confidence",
  "Portfolio, watchlist and alerts",
  "World news with affected tickers",
  "Stock pages and peer comparison",
  "Ask StockGPT assistant",
];

const comingSoon = [
  "Real-time score updates",
  "Historical AI score charts",
  "Advanced screening filters",
  "Deeper portfolio analytics",
  "API access",
  "Priority support",
];

function Tick({ muted = false }: { muted?: boolean }) {
  return (
    <span className={muted ? "mt-0.5 shrink-0 text-[11px] font-black text-[#faf6f0]/28" : "mt-0.5 shrink-0 text-[11px] font-black text-emerald-300"}>
      <StockIcon name={muted ? "ask" : "check"} className="size-3.5" />
    </span>
  );
}

function UpgradeNotice({ feature }: { feature?: string }) {
  if (!feature) return null;

  const label = feature.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <p className="mx-auto mt-2 max-w-xl rounded-2xl border border-[#ddb159]/28 bg-[#ddb159]/10 px-4 py-2 text-[11px] font-bold leading-5 text-[#f4d27a] sm:text-[12px]">
      Unlock {label} with StockGPT Core. Review the plan below, then confirm before Stripe checkout.
    </p>
  );
}

function FeatureList({ muted = false }: { muted?: boolean }) {
  const items = muted ? comingSoon : includedNow;

  return (
    <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/42 p-3">
      <p className={muted ? "text-[9px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/45" : "text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]"}>
        {muted ? "Coming soon" : "Included now"}
      </p>
      <div className="mt-2 grid gap-1.5">
        {items.map((feature) => (
          <div key={feature} className="flex min-w-0 items-start gap-2">
            <Tick muted={muted} />
            <span className={muted ? "min-w-0 text-[11px] font-semibold leading-snug text-[#faf6f0]/38" : "min-w-0 text-[11px] font-semibold leading-snug text-[#faf6f0]/84"}>
              {feature}
            </span>
          </div>
        ))}
      </div>
    </div>
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
    <div className={[
      "relative flex min-w-0 overflow-hidden rounded-[24px] border p-4 shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5 lg:p-4 xl:p-5",
      highlighted ? "border-[#ddb159]/70 bg-[#0d3420]/64" : "border-[#ddb159]/28 bg-[#0b2b1d]/54",
    ].join(" ")}>
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#ddb159]/12 blur-3xl" />
      <div className="relative flex w-full min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[10px]">
              {title}
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap items-end gap-2">
              <h2 className="text-[34px] font-black leading-none tracking-[-0.05em] sm:text-[38px] xl:text-[40px]">
                {price}
              </h2>
              <p className="pb-1 text-[12px] font-bold text-[#faf6f0]/55 sm:text-[13px]">
                {cadence}
              </p>
            </div>
          </div>
          {badge && (
            <span className="max-w-[140px] shrink-0 truncate rounded-full border border-[#ddb159]/35 bg-[#ddb159]/12 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#ddb159] sm:max-w-[190px] sm:px-3 sm:text-[9px]" title={badge}>
              {badge}
            </span>
          )}
        </div>

        <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/58 sm:text-[12px]">
          {note}
        </p>

        <FeatureList />

        <form action="/checkout/confirm" method="get" className="mt-auto pt-4 lg:pt-3">
          <EndorselyReferralInput />
          <input type="hidden" name="plan" value={plan} />
          <button type="submit" className="flex h-10 w-full items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[12px] font-black text-[#072116] shadow-[0_10px_24px_rgba(221,177,89,0.18)] transition hover:bg-[#c9a04f] sm:h-11 sm:text-[13px]">
            Review {title}
          </button>
          <LegalConsentLine className="mt-2" />
        </form>
      </div>
    </div>
  );
}

function ExecutiveCard() {
  return (
    <div className="relative flex min-w-0 overflow-hidden rounded-[24px] border border-[#faf6f0]/12 bg-[#061b12]/62 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5 lg:p-4 xl:p-5">
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-[#ddb159]/7 blur-3xl" />
      <div className="relative flex w-full min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#faf6f0]/45 sm:text-[10px]">
              Executive
            </p>
            <h2 className="mt-2 truncate text-[34px] font-black leading-none tracking-[-0.05em] text-[#faf6f0]/38 sm:text-[38px] xl:text-[40px]">
              Waitlist
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-[#ddb159]/30 bg-[#072116]/80 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#ddb159] sm:px-3 sm:text-[9px]">
            Coming soon
          </span>
        </div>

        <p className="mt-2 text-[11px] font-medium leading-5 text-[#faf6f0]/38 sm:text-[12px]">
          Executive is not live yet. Join the waitlist for advanced features when they are ready.
        </p>

        <FeatureList muted />

        <form action="/api/premium-waitlist" method="post" className="mt-auto pt-4 lg:pt-3">
          <input name="email" type="email" required placeholder="Email for waitlist" className="mb-2 h-10 w-full rounded-full border border-[#ddb159]/20 bg-[#04180f]/70 px-4 text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/60" />
          <button type="submit" className="flex h-10 w-full items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116]/55 text-[12px] font-black text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10 sm:h-11 sm:text-[13px]">
            Join Executive waitlist
          </button>
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
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#072116] text-[#faf6f0]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(221,177,89,0.13),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(16,185,129,0.10),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(221,177,89,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035)_0_1px,transparent_1px_42px)] opacity-25" />
      </div>

      <div className="relative z-10 flex h-[48px] shrink-0 items-center justify-between border-b border-[#ddb159]/15 bg-[#04180f]/88 px-4 backdrop-blur sm:px-6 lg:h-[46px]">
        <Link href="/" className="inline-flex min-w-0 items-center truncate text-[17px] font-black text-[#faf6f0] transition hover:text-[#ddb159] sm:text-[20px]">
          ← StockGPT
        </Link>
        <Link href="/legal" className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#ddb159] transition hover:text-[#f0c867]">
          Legal
        </Link>
      </div>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:py-4">
        <div className="mx-auto grid min-h-full w-full max-w-6xl grid-rows-[auto_1fr_auto]">
          <div className="text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[11px]">
              Pricing
            </p>
            <h1 className="mt-1.5 text-[34px] font-black leading-[0.95] tracking-[-0.045em] sm:text-[44px] lg:text-[46px] xl:text-[50px]">
              Choose your StockGPT plan
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-[#faf6f0]/58 sm:text-[15px] lg:text-[14px]">
              Core is live now. Executive remains waitlist-only while we build the advanced tier properly.
            </p>
            <UpgradeNotice feature={params.feature} />

            {waitlistStatus === "joined" && (
              <p className="mx-auto mt-2 max-w-md rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-[12px] font-bold text-emerald-200">
                You have joined the Executive waitlist.
              </p>
            )}
            {waitlistStatus === "error" && (
              <p className="mx-auto mt-2 max-w-md rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-200">
                Something went wrong. Please try again.
              </p>
            )}
            {waitlistStatus === "missing-email" && (
              <p className="mx-auto mt-2 max-w-md rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-200">
                Please enter an email address to join the waitlist.
              </p>
            )}
          </div>

          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_0.92fr] lg:items-stretch xl:gap-4">
            <CoreCard title="Core monthly" price="£18.99" cadence="/ month" note="Flexible monthly access to the current Core platform." plan="monthly" />
            <CoreCard title="Core annual" price="£189.99" cadence="/ year" badge="Best value — 2 months free" note="Annual access with the same Core features, priced as 2 months free versus monthly." plan="annual" highlighted />
            <div className="md:col-span-2 lg:col-span-1">
              <ExecutiveCard />
            </div>
          </div>

          <div className="pb-3 pt-4 text-center sm:pb-4 lg:pb-1 lg:pt-3">
            <p className="text-[10px] font-medium leading-relaxed text-[#faf6f0]/35 sm:text-[11px]">
              StockGPT provides AI-generated rankings for informational purposes only. This is not financial advice.
            </p>
            <div className="mt-2 flex justify-center">
              <LegalFooterLinks className="justify-center text-[#faf6f0]/42" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
