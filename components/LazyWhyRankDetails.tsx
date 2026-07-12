"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileSheet } from "@/components/MobileSheet";
import { useFocusedFlow } from "@/components/AppChromeProvider";
import { StockLogo } from "@/components/StockLogo";
import { buildAskHref } from "@/lib/ask-context";
import type { StableRankingRow } from "@/lib/stable-rankings";

type DiagnosticsPayload = {
  diagnostics?: {
    diagnosis?: string | null;
    top_positive_factors?: unknown;
    top_negative_factors?: unknown;
    updated_at?: string | null;
  } | null;
  ranking?: { factor_coverage?: number | null; data_confidence?: string | null } | null;
};

function strings(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 3);
  if (value && typeof value === "object") return Object.keys(value as object).slice(0, 3);
  if (typeof value === "string") return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  return [];
}

function WhyContent({ stock, data, loading, error }: { stock: StableRankingRow; data: DiagnosticsPayload | null; loading: boolean; error: string | null }) {
  const drivers = strings(data?.diagnostics?.top_positive_factors);
  const risks = strings(data?.diagnostics?.top_negative_factors);
  return (
    <div className="grid gap-4 text-[#faf6f0]">
      <div className="flex items-center gap-3"><StockLogo ticker={stock.ticker} company={stock.company} size={42} /><div><p className="text-[13px] font-black">{stock.company ?? stock.ticker}</p><p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">AI score {Number(stock.score ?? 0).toLocaleString()} · Rank #{stock.rank ?? "—"}</p></div></div>
      {loading && <div className="grid gap-2"><div className="h-14 animate-pulse rounded-xl bg-[#faf6f0]/8" /><div className="h-14 animate-pulse rounded-xl bg-[#faf6f0]/8" /></div>}
      {error && <p className="rounded-xl border border-[#ddb159]/20 bg-[#ddb159]/8 p-3 text-[12px] font-semibold text-[#e7c56c]">{error}</p>}
      {!loading && !error && <>
        <p className="text-[13px] font-semibold leading-6 text-[#faf6f0]/68">{data?.diagnostics?.diagnosis ?? "The latest factor explanation is not available. The rank remains visible, but StockGPT will not invent drivers."}</p>
        <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Main drivers</p><ul className="mt-2 grid gap-2 text-[12px] font-semibold text-[#faf6f0]/64">{(drivers.length ? drivers : ["Factor detail unavailable"]).map((item) => <li key={item}>— {item}</li>)}</ul></div><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Risks</p><ul className="mt-2 grid gap-2 text-[12px] font-semibold text-[#faf6f0]/64">{(risks.length ? risks : ["Review company and market risk before acting"]).map((item) => <li key={item}>— {item}</li>)}</ul></div></div>
      </>}
      <div className="grid grid-cols-2 gap-2"><Link href={buildAskHref({ contextType: "stock", ticker: stock.ticker ?? "" })} className="grid h-11 place-items-center rounded-xl bg-[#ddb159] px-3 text-center text-[10px] font-black text-[#061b12]">Ask about {stock.ticker}</Link><Link href={`/stock/${stock.ticker}`} className="grid h-11 place-items-center rounded-xl border border-[#ddb159]/24 px-3 text-center text-[10px] font-black text-[#ddb159]">Open stock page</Link></div>
    </div>
  );
}

export function LazyWhyRankDetails({ stock, light = false }: { stock: StableRankingRow; dailyMove: number | null | undefined; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusedFlow(`ranking-why-${stock.ticker}`, open);

  async function openDetails() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rankings/financial-metrics?ticker=${encodeURIComponent(stock.ticker ?? "")}`);
      const payload = await response.json().catch(() => null) as DiagnosticsPayload | null;
      if (!response.ok) throw new Error(response.status === 403 ? "Premium factor detail is locked." : "The latest factor detail is unavailable.");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Factor detail is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  const content = <WhyContent stock={stock} data={data} loading={loading} error={error} />;
  return <>
    <button type="button" onClick={openDetails} className={`inline-flex h-11 items-center justify-center rounded-full border px-3 text-[10px] font-black ${light ? "border-[#072116]/12 text-[#8a641a]" : "border-[#ddb159]/22 text-[#8a641a]"}`}>Why?</button>
    <MobileSheet open={open} onClose={() => setOpen(false)} title={`Why ${stock.ticker} ranks #${stock.rank ?? "—"}`} eyebrow="Ranking intelligence">{content}</MobileSheet>
    {open && <div className="fixed inset-0 z-[2147483000] hidden bg-[#020805]/72 lg:flex lg:justify-end" role="presentation"><button type="button" onClick={() => setOpen(false)} aria-label="Close ranking detail" className="absolute inset-0" /><aside role="dialog" aria-modal="true" aria-label={`Why ${stock.ticker} ranks here`} className="relative z-10 h-[100dvh] w-full max-w-[520px] overflow-y-auto border-l border-[#ddb159]/22 bg-[#061b12] p-6 pt-16"><button type="button" onClick={() => setOpen(false)} className="absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-[#ddb159]/22 text-xl text-[#ddb159]" aria-label="Close">&times;</button><p className="mb-5 text-[10px] font-black uppercase tracking-[0.17em] text-[#ddb159]">Why {stock.ticker} ranks #{stock.rank ?? "—"}</p>{content}</aside></div>}
  </>;
}
