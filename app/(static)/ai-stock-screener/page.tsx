import type { Metadata } from "next";
import Link from "next/link";
import { StockIcon } from "@/components/StockIcon";

export const metadata: Metadata = {
  title: "AI Stock Screener for S&P 500 Research | StockGPT",
  description:
    "Use StockGPT as an AI stock screener for S&P 500 rankings, portfolio analysis, stock comparison and market research workflows.",
};

const features = [
  "AI-ranked S&P 500 research list",
  "Beginner-friendly score explanations",
  "Portfolio analysis and watchlist workflows",
  "Stock comparison, trade-plan context and news impact",
];

export default function AiStockScreenerPage() {
  return (
    <main className="min-h-dvh bg-[#072116] px-4 py-10 text-[#faf6f0] sm:px-6">
      <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">AI stock screener</p>
          <h1 className="mt-3 text-[42px] font-black leading-none tracking-[-0.055em] sm:text-[62px]">
            Screen the S&P 500 with StockGPT research context.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-[#faf6f0]/62">
            StockGPT helps everyday investors research stocks using AI rankings, explainable scores, portfolio tools and market-news context. It is research software, not financial advice.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ddb159] px-6 text-[12px] font-black uppercase tracking-[0.14em] text-[#072116]">View plans</Link>
            <Link href="/" className="inline-flex h-12 items-center justify-center rounded-full border border-[#ddb159]/35 px-6 text-[12px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Back to home</Link>
          </div>
        </div>

        <div className="rounded-[32px] border border-[#ddb159]/24 bg-[#04180f]/72 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.25)]">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">What it includes</p>
          <div className="mt-4 grid gap-3">
            {features.map((feature) => (
              <div key={feature} className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] px-4 py-3 text-[13px] font-bold text-[#faf6f0]/78">
                <StockIcon name="check" className="mr-2 inline size-4 text-[#ddb159]" />{feature}
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] font-medium leading-5 text-[#faf6f0]/38">
            No broker connection required. No guaranteed returns. Use outputs as research inputs and apply your own risk controls.
          </p>
        </div>
      </section>
    </main>
  );
}
