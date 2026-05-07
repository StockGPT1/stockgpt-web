import Link from "next/link";

type PricingSearchParams = {
  waitlist?: string;
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-emerald-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-[#faf6f0]/30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const coreFeatures = [
  "Full S&P 500 stock rankings",
  "AI scores updated every market open",
  "World news with sentiment analysis",
  "Personal watchlist",
  "Stock detail pages with sector peers",
  "Email weekly market briefings",
];

const premiumFeatures = [
  "Everything in Core",
  "Real-time score updates",
  "Historical AI score charts",
  "Advanced screening filters",
  "Portfolio tracking & analytics",
  "API access",
  "Priority support",
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<PricingSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const waitlistStatus = params.waitlist;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(221,177,89,0.13),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(16,185,129,0.10),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(221,177,89,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035)_0_1px,transparent_1px_42px)] opacity-25" />
        <div className="absolute left-1/2 top-[55%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/8" />
      </div>

      <div className="relative z-10 flex h-[52px] shrink-0 items-center border-b border-[#ddb159]/15 bg-[#04180f]/88 px-4 backdrop-blur sm:px-6 lg:h-[52px]">
        <Link
          href="/"
          className="inline-flex items-center text-[17px] font-black text-[#faf6f0] transition hover:text-[#ddb159] sm:text-[20px]"
        >
          ← StockGPT
        </Link>
      </div>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 lg:overflow-hidden lg:px-6 lg:py-3">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col lg:h-full lg:min-h-0 lg:justify-center">
          <div className="shrink-0 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[11px] lg:text-[10px]">
              Pricing
            </p>

            <h1 className="mt-2 text-[34px] font-black leading-[0.95] tracking-[-0.045em] sm:text-[42px] lg:mt-1 lg:text-[38px] xl:text-[42px]">
              Unlock StockGPT
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-[14px] font-medium leading-relaxed text-[#faf6f0]/58 sm:text-[16px] lg:mt-2 lg:text-[14px]">
              Access the full ranking engine, insights, and market intelligence.
            </p>

            {waitlistStatus === "joined" && (
              <p className="mx-auto mt-3 max-w-md rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-[12px] font-bold text-emerald-200 lg:mt-2 lg:py-1.5">
                You have joined the Premium waitlist.
              </p>
            )}

            {waitlistStatus === "error" && (
              <p className="mx-auto mt-3 max-w-md rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-200 lg:mt-2 lg:py-1.5">
                Something went wrong. Please try again.
              </p>
            )}

            {waitlistStatus === "missing-email" && (
              <p className="mx-auto mt-3 max-w-md rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-200 lg:mt-2 lg:py-1.5">
                Please enter an email address to join the waitlist.
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-4 pb-6 sm:mt-8 lg:mt-5 lg:grid-cols-2 lg:items-stretch lg:gap-5 lg:pb-0">
            <div className="relative flex min-h-[455px] overflow-hidden rounded-3xl border border-[#ddb159]/65 bg-[#0d3420]/58 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:min-h-[465px] sm:p-6 lg:h-[370px] lg:min-h-0 lg:p-5 xl:h-[390px]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#ddb159]/12 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.06),transparent_42%,rgba(221,177,89,0.05))]" />

              <div className="relative flex w-full flex-col">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[11px] lg:text-[10px]">
                  Core
                </p>

                <div className="mt-2 flex items-end gap-2 lg:mt-1">
                  <h2 className="text-[34px] font-black leading-none tracking-[-0.04em] sm:text-[40px] lg:text-[34px] xl:text-[38px]">
                    £12
                  </h2>
                  <p className="pb-1 text-[13px] font-bold text-[#faf6f0]/55 lg:text-[12px]">
                    / month
                  </p>
                </div>

                <p className="mt-2 text-[12px] font-medium text-[#faf6f0]/58 sm:text-[13px] lg:mt-1 lg:text-[12px]">
                  Full access to the core platform
                </p>

                <div className="mt-5 space-y-2.5 lg:mt-4 lg:space-y-1.5 xl:space-y-2">
                  {coreFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/88 sm:text-[13px] lg:text-[12px] xl:text-[12.5px]">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <form
                  action="/api/create-checkout-session"
                  method="post"
                  className="mt-auto pt-5 lg:pt-3 xl:pt-4"
                >
                  <div className="mb-2 hidden h-9 lg:block xl:h-10" />

                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[13px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.2)] transition hover:bg-[#c9a04f] sm:h-12 sm:text-[14px] lg:h-10 lg:text-[13px] xl:h-11"
                  >
                    Start Core subscription
                  </button>
                </form>
              </div>
            </div>

            <div className="relative flex min-h-[455px] overflow-hidden rounded-3xl border border-[#faf6f0]/12 bg-[#061b12]/62 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:min-h-[465px] sm:p-6 lg:h-[370px] lg:min-h-0 lg:p-5 xl:h-[390px]">
              <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-[#ddb159]/7 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.035),transparent_45%,rgba(221,177,89,0.035))]" />

              <div className="relative flex w-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#faf6f0]/45 sm:text-[11px] lg:text-[10px]">
                      Premium
                    </p>

                    <h2 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]/38 sm:text-[40px] lg:mt-1 lg:text-[34px] xl:text-[38px]">
                      TBD
                    </h2>
                  </div>

                  <div className="shrink-0 rounded-full border border-[#ddb159]/30 bg-[#072116]/80 px-3 py-1 text-[9px] font-bold text-[#ddb159] sm:text-[10px]">
                    Coming soon
                  </div>
                </div>

                <p className="mt-2 text-[12px] font-medium text-[#faf6f0]/35 sm:text-[13px] lg:mt-1 lg:text-[12px]">
                  For serious investors and analysts
                </p>

                <div className="mt-5 space-y-2 lg:mt-4 lg:space-y-1.5 xl:space-y-2">
                  {premiumFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <LockIcon />
                      <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/38 sm:text-[13px] lg:text-[12px] xl:text-[12.5px]">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <form
                  action="/api/premium-waitlist"
                  method="post"
                  className="mt-auto pt-5 lg:pt-3 xl:pt-4"
                >
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="Email for waitlist"
                    className="mb-2 h-9 w-full rounded-full border border-[#ddb159]/20 bg-[#04180f]/70 px-4 text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/60 xl:h-10"
                  />

                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116]/55 text-[13px] font-black text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10 sm:h-12 sm:text-[14px] lg:h-10 lg:text-[13px] xl:h-11"
                  >
                    Join Premium waitlist
                  </button>
                </form>
              </div>
            </div>
          </div>

          <p className="shrink-0 pb-6 text-center text-[11px] font-medium leading-relaxed text-[#faf6f0]/35 sm:text-[12px] lg:mt-3 lg:pb-0 lg:text-[11px] xl:mt-5 xl:text-[12px]">
            StockGPT provides AI-generated rankings for informational purposes only.
            This is not financial advice.
          </p>
        </div>
      </main>
    </div>
  );
}
