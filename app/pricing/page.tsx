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
      className="size-4 shrink-0 text-[#faf6f0]/25"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const basicFeatures = [
  "Full S&P 500 stock rankings",
  "AI scores updated every market open",
  "World news with sentiment analysis",
  "Personal watchlist",
  "Stock detail pages with sector peers",
  "Email news digests",
];

const proFeatures = [
  "Everything in Basic",
  "Real-time score updates",
  "Historical AI score charts",
  "Custom screening filters",
  "Portfolio tracking & analytics",
  "API access",
  "Priority support",
];

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col overflow-y-auto bg-[#072116] text-[#faf6f0]">
      <div className="shrink-0 border-b border-[#ddb159]/15 bg-[#04180f] px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-[18px] font-black text-[#ddb159] sm:text-[20px]">
          ← StockGPT
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:justify-center lg:py-10">
        <div className="text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159] sm:text-[11px]">
            Pricing
          </p>

          <h1 className="mt-2 text-[34px] font-black leading-[0.95] tracking-[-0.045em] sm:text-[40px]">
            Unlock StockGPT
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-[14px] font-medium leading-relaxed text-[#faf6f0]/55 sm:text-[16px]">
            Access the full ranking engine, insights, and market intelligence.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:mt-10">
          <div className="relative overflow-hidden rounded-3xl border border-[#ddb159] bg-[linear-gradient(160deg,#0d3420,#082519)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:p-6">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#ddb159]/8 blur-3xl" />

            <div className="relative">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159] sm:text-[11px]">
                Basic
              </p>

              <h2 className="mt-1 text-[32px] font-black leading-none tracking-[-0.04em] sm:text-[36px]">
                Free
              </h2>

              <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/50 sm:text-[13px]">
                Full access to the core platform
              </p>

              <div className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
                {basicFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/85 sm:text-[13px]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/signup"
                className="mt-6 flex h-11 items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[13px] font-black text-[#072116] transition hover:bg-[#c9a04f] sm:mt-8 sm:h-12 sm:text-[14px]"
              >
                Get started — it&apos;s free
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[#faf6f0]/10 bg-[#061b12] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:p-6">
            <div className="absolute right-4 top-4 rounded-full border border-[#ddb159]/30 bg-[#072116] px-3 py-1 text-[9px] font-bold text-[#ddb159] sm:text-[10px]">
              Coming soon
            </div>

            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#faf6f0]/40 sm:text-[11px]">
              Pro
            </p>

            <h2 className="mt-1 text-[32px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]/30 sm:text-[36px]">
              TBD
            </h2>

            <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/30 sm:text-[13px]">
              For serious investors and analysts
            </p>

            <div className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
              {proFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <LockIcon />
                  <span className="text-[12px] font-semibold leading-snug text-[#faf6f0]/35 sm:text-[13px]">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled
              className="mt-6 flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full border border-[#faf6f0]/15 text-[13px] font-black text-[#faf6f0]/30 sm:mt-8 sm:h-12 sm:text-[14px]"
            >
              Join waitlist
            </button>
          </div>
        </div>

        <p className="mt-6 pb-2 text-center text-[11px] font-medium leading-relaxed text-[#faf6f0]/35 sm:mt-8 sm:text-[12px] lg:mt-10">
          StockGPT provides AI-generated rankings for informational purposes only.
          This is not financial advice.
        </p>
      </main>
    </div>
  );
}
