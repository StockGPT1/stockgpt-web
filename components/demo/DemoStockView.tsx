import type { RefObject } from "react";
import type { DemoScrollTarget } from "@/lib/demo/demoSteps";
import { demoNews } from "@/lib/demo/demoData";
import { DemoMiniChart } from "./DemoMiniChart";

export type DemoStockSectionRefs = Record<
  DemoScrollTarget,
  RefObject<HTMLElement | null>
>;

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[#072116]/8 bg-white p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/42">{label}</p>
      <p className="mt-1 text-xl font-black tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-[#072116]/48">{note}</p>
    </div>
  );
}

export function DemoStockView({ sectionRefs }: { sectionRefs: DemoStockSectionRefs }) {
  return (
    <div className="grid min-w-0 gap-3">
      <section
        ref={sectionRefs["stock-overview"]}
        className="scroll-mt-4 rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420)] p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black text-[#ddb159]/70">Rankings · #1 · Technology</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-[#faf6f0] text-sm font-black text-[#072116]">N</div>
              <div>
                <h1 className="text-4xl font-black tracking-[-0.05em]">NVDA</h1>
                <p className="font-bold text-[#faf6f0]/64">NVIDIA Corporation</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-black">$173.42</span>
              <span className="rounded-full bg-[#ddb159] px-3 py-1 text-[10px] font-black uppercase text-[#072116]">AI score · 8,742</span>
              <span className="rounded-full border border-[#ddb159]/30 px-3 py-1 text-[10px] font-black uppercase text-[#ddb159]">Research priority · High</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-64">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[9px] font-black uppercase text-white/38">1D move</p>
              <p className="mt-1 text-lg font-black text-emerald-300">+1.81%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[9px] font-black uppercase text-white/38">Model view</p>
              <p className="mt-1 text-lg font-black text-[#ddb159]">Watch</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#ddb159]/20 bg-white/[0.03] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Price chart · demo data</p>
        <div className="mt-3 overflow-hidden rounded-xl bg-[#072116]/45">
          <DemoMiniChart height={260} />
        </div>
      </section>

      <section className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Research summary</p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">Pressure-test the story</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MetricCard label="Growth context" value="Strong" note="Demand remains high, with execution risk." />
          <MetricCard label="Valuation context" value="Elevated" note="Expectations leave less room for error." />
          <MetricCard label="Risk context" value="Medium" note="Volatility can rise around results and guidance." />
        </div>
      </section>

      <section
        ref={sectionRefs["stock-news"]}
        className="scroll-mt-4 rounded-2xl border border-[#ddb159]/20 bg-white/[0.03] p-4"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">World events & company activity</p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">Relevant news affecting NVDA</h2>
        <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-white/55">
          Headlines are connected to the company so you can check material impact before reacting.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {demoNews.map((article) => (
            <article key={article.title} className="rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d] p-4">
              <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase text-[#ddb159]">
                <span>{article.source}</span>
                <span className="rounded-full bg-[#ddb159]/12 px-2 py-0.5">{article.relevance}</span>
              </div>
              <h3 className="mt-2 text-sm font-black leading-5">{article.title}</h3>
              <p className="mt-2 text-[11px] font-semibold leading-5 text-white/48">{article.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        ref={sectionRefs["stock-trade-plan"]}
        className="scroll-mt-4 rounded-2xl bg-[#faf6f0] p-5 text-[#072116]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Trade-plan analysis</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">Possible levels and scenarios</h2>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-800">Research watch</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Entry area" value="$168–$174" note="Planning reference, not an instruction." />
          <MetricCard label="Downside review" value="$154" note="Reassess if the thesis weakens." />
          <MetricCard label="Upside scenario" value="$196" note="A scenario, not a promised target." />
        </div>
        <div className="mt-3 rounded-2xl bg-[#072116] p-4 text-[#faf6f0]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">If this, then that</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-white/60">
            If guidance weakens or margins compress, review the thesis. If demand and free cash flow support expectations, continue monitoring valuation and concentration risk.
          </p>
        </div>
        <p className="mt-3 text-[10px] font-semibold text-[#072116]/50">Educational research only. Not financial advice.</p>
      </section>

      <section
        ref={sectionRefs["stock-numbers"]}
        className="scroll-mt-4 rounded-2xl bg-[#faf6f0] p-5 text-[#072116]"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Fundamentals · demo values</p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">The numbers behind the narrative</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard label="Revenue growth" value="31%" note="Illustrative annual growth" />
          <MetricCard label="Gross margin" value="72%" note="Illustrative profitability" />
          <MetricCard label="Forward P/E" value="34×" note="Valuation needs context" />
          <MetricCard label="Free cash flow" value="$42bn" note="Illustrative cash generation" />
        </div>
        <div className="h-24" aria-hidden="true" />
      </section>
    </div>
  );
}
