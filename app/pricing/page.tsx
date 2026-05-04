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
    <div className="flex min-h-screen flex-col bg-[#072116] text-[#faf6f0]">
      {/* Header */}
      <div className="border-b border-[#ddb159]/15 bg-[#04180f] px-6 py-4">
        <Link href="/" className="text-[20px] font-black text-[#ddb159]">
          ← StockGPT
        </Link>
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <div className="text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
            Pricing
          </p>
          <h1 className="mt-2 text-[40px] font-black leading-[0.95] tracking-[-0.045em]">
            Unlock StockGPT
          </h1>
          <p className="mt-3 text-[16px] font-medium text-[#faf6f0]/55">
            Access the full ranking engine, insights, and market intelligence.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {/* Basic */}
          <div className="relative overflow-hidden rounded-3xl border border-[#ddb159] bg-[linear-gradient(160deg,#0d3420,#082519)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#ddb159]/8 blur-3xl" />

            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Basic
            </p>
            <h2 className="mt-1 text-[36px] font-black leading-none tracking-[-0.04em]">
              Free
            </h2>
            <p className="mt-1 text-[13px] font-medium text-[#faf6f0]/50">
              Full access to the core platform
            </p>

            <div className="mt-6 space-y-3">
              {basicFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <span className="text-[13px] font-semibold text-[#faf6f0]/85">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="mt-8 flex h-12 items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[14px] font-black text-[#072116] transition hover:bg-[#c9a04f]"
            >
              Get started — it&apos;s free
            </Link>
          </div>

          {/* Pro (coming soon) */}
          <div className="relative overflow-hidden rounded-3xl border border-[#faf6f0]/10 bg-[#061b12] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="absolute right-4 top-4 rounded-full border border-[#ddb159]/30 bg-[#072116] px-3 py-1 text-[10px] font-bold text-[#ddb159]">
              Coming soon
            </div>

            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#faf6f0]/40">
              Pro
            </p>
            <h2 className="mt-1 text-[36px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]/30">
              TBD
            </h2>
            <p className="mt-1 text-[13px] font-medium text-[#faf6f0]/30">
              For serious investors and analysts
            </p>

            <div className="mt-6 space-y-3">
              {proFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <LockIcon />
                  <span className="text-[13px] font-semibold text-[#faf6f0]/35">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled
              className="mt-8 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full border border-[#faf6f0]/15 text-[14px] font-black text-[#faf6f0]/30"
            >
              Join waitlist
            </button>
          </div>
        </div>

        {/* Bottom note */}
        <p className="mt-10 text-center text-[12px] font-medium text-[#faf6f0]/35">
          StockGPT provides AI-generated rankings for informational purposes
          only. This is not financial advice.
        </p>
      </main>
    </div>
  );
}
