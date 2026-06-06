import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Portfolio Analysis Tool | StockGPT",
  description:
    "StockGPT portfolio analysis tools help investors review holdings, watchlists, alerts, risk context and AI-ranked S&P 500 opportunities.",
};

export default function PortfolioAnalysisToolPage() {
  return (
    <main className="min-h-dvh bg-[#072116] px-4 py-10 text-[#faf6f0] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Portfolio analysis tool</p>
        <h1 className="mt-3 max-w-3xl text-[42px] font-black leading-none tracking-[-0.055em] sm:text-[62px]">
          Analyse your holdings with AI-ranked market context.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-[#faf6f0]/62">
          StockGPT combines portfolio tracking, watchlist alerts, stock rankings and news impact summaries so you can review positions more clearly.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Portfolio context", "Review saved holdings against current ranks, scores and market news."],
            ["Watchlist alerts", "Track relevant stocks and keep an eye on ranking or news changes."],
            ["Research workflow", "Move from portfolio view to stock pages, comparisons and Ask StockGPT."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl border border-[#ddb159]/20 bg-[#04180f]/72 p-5 shadow-[0_16px_38px_rgba(0,0,0,0.2)]">
              <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#faf6f0]">{title}</h2>
              <p className="mt-3 text-[13px] font-semibold leading-6 text-[#faf6f0]/56">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ddb159] px-6 text-[12px] font-black uppercase tracking-[0.14em] text-[#072116]">View Core</Link>
          <Link href="/" className="inline-flex h-12 items-center justify-center rounded-full border border-[#ddb159]/35 px-6 text-[12px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Back to home</Link>
        </div>
      </section>
    </main>
  );
}
