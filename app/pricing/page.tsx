import Link from "next/link";

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

const alphaFeatures = [
  "Everything in Core",
  "Real-time score updates",
  "Historical AI score charts",
  "Advanced screening filters",
  "Portfolio tracking & analytics",
  "API access",
  "Priority support",
];

export default function PricingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto bg-[#072116] text-[#faf6f0] lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(221,177,89,0.13),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(16,185,129,0.10),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(221,177,89,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035)_0_1px,transparent_1px_42px)] opacity-25" />
        <div className="absolute left-1/2 top-[55%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ddb159]/8" />
      </div>

      <div className="relative z-10 shrink-0 border-b border-[#ddb159]/15 bg-[#04180f]/88 px-4 py-3 backdrop-blur sm:px-6 lg:h-[62px]">
        <Link
          href="/"
          className="inline-flex items-center text-[18px] font-black text-[#faf6f0] transition hover:text-[#ddb159] sm:text-[20px]"
        >
          ← StockGPT
        </Link>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:h-[calc(100dvh-62px)] lg:min-h-0 lg:justify-center lg:overflow-hidden lg:py-5">
        <div className="shrink-0 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[11px]">
            Pricing
          </p>

          <h1 className="mt-2 text-[34px] font-black leading-[0.95] tracking-[-0.045em] sm:text-[42px] lg:text-[44px]">
            Unlock StockGPT
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-[14px] font-medium leading-relaxed text-[#faf6f0]/58 sm:text-[16px] lg:text-[15px]">
            Access the full ranking engine, insights, and market intelligence.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:mt-7 lg:min-h-0">
          <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/65 bg-[#0d3420]/58 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6 lg:p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#ddb159]/12 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.06),transparent_42%,rgba(221,177,89,0.05))]" />

            <div className="relative">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ddb159] sm:text-[11px]">
                Core
              </p>

              <div className="mt-2 flex items-end gap-2">
                <h2 className="text-[34px] font-black leading-none tracking-[-0.04em] sm:text-[40px] lg:text-[38px]">
                  £12
                </h2>
                <p className="pb-1 text-[13px] font-bold text-[#faf6f0]/55">
                  / month
                </p>
              </div>

              <p className="mt-2 text-[12px] font-medium text-[#faf6f0]/58 sm:text-[13px]">
                Full access to the core platform
              </p>

              <div className="mt-5 space-y-2.5 lg:mt-4 lg:space-y-2">
                {coreFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/88 sm:text-[13px] lg:text-[12.5px]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <form action="/api/create-checkout-session" method="post">
                <button
                  type="submit"
                  className="mt-6 flex h-11 w-full items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[13px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.2)] transition hover:bg-[#c9a04f] sm:h-12 sm:text-[14px] lg:mt-5"
                >
                  Start Core subscription
                </button>
              </form>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[#faf6f0]/12 bg-[#061b12]/62 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6 lg:p-5">
            <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-[#ddb159]/7 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.035),transparent_45%,rgba(221,177,89,0.035))]" />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#faf6f0]/45 sm:text-[11px]">
                    Alpha
                  </p>

                  <h2 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]/38 sm:text-[40px] lg:text-[38px]">
                    TBD
                  </h2>
                </div>

                <div className="shrink-0 rounded-full border border-[#ddb159]/30 bg-[#072116]/80 px-3 py-1 text-[9px] font-bold text-[#ddb159] sm:text-[10px]">
                  Coming soon
                </div>
              </div>

              <p className="mt-2 text-[12px] font-medium text-[#faf6f0]/35 sm:text-[13px]">
                For serious investors and analysts
              </p>

              <div className="mt-5 space-y-2.5 lg:mt-4 lg:space-y-2">
                {alphaFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <LockIcon />
                    <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/38 sm:text-[13px] lg:text-[12.5px]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <form action="/api/alpha-waitlist" method="post">
                <button
                  type="submit"
                  className="mt-6 flex h-11 w-full items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116]/55 text-[13px] font-black text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10 sm:h-12 sm:text-[14px] lg:mt-5"
                >
                  Join Alpha waitlist
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="mt-5 shrink-0 pb-2 text-center text-[11px] font-medium leading-relaxed text-[#faf6f0]/35 sm:mt-7 sm:text-[12px] lg:mt-5">
          StockGPT provides AI-generated rankings for informational purposes only.
          This is not financial advice.
        </p>
      </main>
    </div>
  );
}
