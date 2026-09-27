import Link from "next/link";
import type { PortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";
import { PortfolioContextDefaultControls } from "@/components/PortfolioContextDefaultControls";

function money(value: number | null) {
  return value == null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function AllInvestmentsWorkspace({
  intelligence,
  totalValueUsd,
  cashValueUsd,
  sources,
}: {
  intelligence: PortfolioIntelligenceView;
  totalValueUsd: number | null;
  cashValueUsd: number | null;
  sources: Array<{ id: string; name: string; source: "manual" | "connected"; availability: "ready" | "unavailable"; valueUsd: number | null; holdingCount: number | null }>;
}) {
  return <main className="h-full overflow-y-auto px-5 py-8 text-white lg:px-10"><div className="mx-auto max-w-6xl">
    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Derived context</p><h1 className="mt-2 text-3xl font-semibold">All Investments</h1><p className="mt-2 max-w-2xl text-sm text-white/55">A read-only aggregate of your StockGPT Portfolios. Similar holdings remain separate and are never auto-deduplicated.</p><div className="mt-3"><PortfolioContextDefaultControls value="all-investments" /></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><section className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">Status</p><p className="mt-2 text-xl font-semibold">{intelligence.statusLabel}</p><p className="mt-2 text-sm text-white/55">{intelligence.summary}</p></section><section className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">Current value</p><p className="mt-2 text-xl font-semibold">{money(totalValueUsd)}</p><p className="mt-2 text-sm text-white/55">Cash {money(cashValueUsd)}</p></section><section className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">Aggregate performance</p><p className="mt-2 text-xl font-semibold">Unavailable</p><p className="mt-2 text-sm text-white/55">Source histories are not combined into a synthetic return.</p></section></div>
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">Included Portfolios</h2><div className="mt-4 divide-y divide-white/10">{sources.map((source) => <Link key={source.id} href={`/portfolio/modern?portfolio=${source.id}`} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">{source.name}</p><p className="text-xs text-white/45">{source.source === "connected" ? "Connected · read only" : "Manual"} · {source.holdingCount == null ? "Holdings unavailable" : `${source.holdingCount} holdings`}</p>{source.availability === "unavailable" ? <p className="mt-1 text-xs text-amber-200/70">Current source facts unavailable</p> : null}</div><p>{money(source.valueUsd)}</p></Link>)}</div></section>
  </div></main>;
}
