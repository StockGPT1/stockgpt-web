import Link from "next/link";
import type { PortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";
import { CONNECTED_PORTFOLIO_PERFORMANCE_UNAVAILABLE_MESSAGE } from "@/lib/portfolio-performance-availability";
import type { BrokerConnectionPresentation } from "@/lib/brokerage/connection-presentation-state";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";
import type { PortfolioPerformanceResult } from "@/lib/portfolio-history";
import { PortfolioContextDefaultControls } from "@/components/PortfolioContextDefaultControls";
import { positionIdentityLabel, type HoldingIdentityPresentation } from "@/lib/instruments/broker-position-identity";

type Position = HoldingIdentityPresentation & {
  id: string;
  instrumentId: string | null;
  ticker: string | null;
  description: string | null;
  quantity: number | null;
  currentPriceUsd: number | null;
  currentValueUsd: number | null;
  sourceCurrency: string | null;
  asOf: string;
};

function money(value: number | null) {
  return value == null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function ConnectedPortfolioWorkspace({
  portfolio, portfolios, intelligence, positions, cashValueUsd, totalValueUsd, connectionPresentation, history,
}: {
  portfolio: { id: string; name: string };
  portfolios: { id: string; name: string; source: "manual" | "connected" }[];
  intelligence: PortfolioIntelligenceView;
  positions: Position[];
  cashValueUsd: number | null;
  totalValueUsd: number | null;
  connectionPresentation: BrokerConnectionPresentation;
  history: {
    chartData: Partial<Record<TimeRange, ChartPoint[]>>;
    performance: PortfolioPerformanceResult;
    pointCount: number;
  };
}) {
  return <main className="h-full overflow-y-auto px-5 py-8 text-white lg:px-10">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.18em] text-white/45">Connected Portfolio · read only</p><h1 className="mt-2 text-3xl font-semibold">{portfolio.name}</h1><p className="mt-2 text-sm text-white/65">Connection · {connectionPresentation.label}</p><p className="mt-1 text-sm text-white/50">{connectionPresentation.detail}</p></div>
        <div className="flex flex-wrap gap-3"><Link href="/portfolio/connections" className="rounded-full border border-white/15 px-4 py-2 text-sm">Manage connection</Link><Link href="/portfolio/modern?portfolio=all-investments" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60">All Investments</Link>{portfolios.filter((item) => item.id !== portfolio.id).slice(0, 2).map((item) => <Link key={item.id} href={`/portfolio/modern?portfolio=${item.id}`} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60">{item.name}</Link>)}</div>
      </div>
      <div className="mt-3"><PortfolioContextDefaultControls value={portfolio.id} /></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">Status</p><p className="mt-2 text-xl font-semibold">{intelligence.statusLabel}</p><p className="mt-2 text-sm text-white/55">{intelligence.summary}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">Current value</p><p className="mt-2 text-xl font-semibold">{money(totalValueUsd)}</p><p className="mt-2 text-sm text-white/55">Cash {money(cashValueUsd)}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">Performance</p>{history.performance.status === "available" ? <><p className="mt-2 text-xl font-semibold">{history.performance.returnPct?.toFixed(2)}%</p><p className="mt-2 text-sm text-white/55">{history.performance.method === "time_weighted" ? "Time-weighted return" : "Estimated Modified Dietz return"} · {history.performance.quality}</p></> : <><p className="mt-2 text-xl font-semibold">Unavailable</p><p className="mt-2 text-sm text-white/55">{history.pointCount < 2 ? CONNECTED_PORTFOLIO_PERFORMANCE_UNAVAILABLE_MESSAGE : "Historical valuation or external-flow evidence is incomplete."}</p></>}</section>
      </div>
      {Object.values(history.chartData).some((points) => (points?.length ?? 0) > 1) && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">Portfolio value history</h2><p className="mt-1 text-xs text-white/45">Provider account evidence · never reconstructed from current holdings</p><div className="mt-4"><StockChart ticker="Portfolio" data={history.chartData} initialRange="MAX" height={260} /></div></section>}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">Broker positions</h2><div className="mt-4 divide-y divide-white/10">{positions.map((position) => <div key={position.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{position.ticker ?? position.description ?? "Unmapped instrument"}</p><p className="text-xs text-white/45">{positionIdentityLabel(position)} · Quantity {position.quantity ?? "unavailable"}</p></div><div className="text-right"><p>{money(position.currentValueUsd)}</p><p className="text-xs text-white/45">Provider evidence · {position.sourceCurrency ?? "currency unavailable"}</p></div></div>)}</div>{positions.length === 0 && <p className="mt-4 text-sm text-white/50">Positions are pending or this account has no normalized positions.</p>}</section>
    </div>
  </main>;
}
