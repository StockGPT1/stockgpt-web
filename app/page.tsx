import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PaywallCard } from "@/components/PaywallCard";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let hasAccess = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).single();
    hasAccess = profile?.subscription_status === "basic";
  }
  const { data: rankings } = await supabase.from("stock_rankings").select("id,rank,ticker,company,sector,score,price,updated_at").order("rank", { ascending: true }).limit(10);
  const { data: news } = await supabase.from("news_articles").select("id,title").order("published_at", { ascending: false }).limit(3);
  const top = rankings?.[0];


  return (
    <AppShell activePath="/">
      <main className="grid gap-5 xl:grid-cols-[minmax(0,1160px)_544px]">
        <section className="space-y-5">
          <div className="relative h-[245px] rounded-2xl border border-[#d4af37]/25 bg-gradient-to-r from-[#062117] via-[#073723] to-[#0d3f28] p-6">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 60% 20%, rgba(212,175,55,.35), transparent 42%), repeating-linear-gradient(90deg, transparent 0 22px, rgba(120,242,166,.12) 22px 23px), radial-gradient(circle at 70% 45%, rgba(255,255,255,.09), transparent 25%)" }} />
            <p className="relative text-[28px] text-[#d4af37]">Welcome back,</p>
            <h1 className="relative mt-1 max-w-[560px] text-[58px] leading-[1.03]">Make smarter investment decisions.</h1>
            <p className="relative mt-3 max-w-[620px] text-[30px] text-[#d8d2bf]">AI-powered rankings and real-time insights to help you stay ahead of the market.</p>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{[["TOTAL STOCKS", rankings?.length ?? 0, "Ranked by AI Score"], ["TOP RANKED", top?.ticker ?? "—", top?.company ?? "—"], ["HIGHEST SCORE", rankings?.[0]?.score ?? "—", top?.company ?? "—"], ["LAST UPDATED", top?.updated_at ? new Date(top.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—", top?.updated_at ? new Date(top.updated_at).toLocaleDateString() : "—"]].map(([k,v,s]) => <div key={String(k)} className="rounded-xl bg-[#f8f4e8] p-4 text-[#052416]"><p className="text-[20px] tracking-wide text-slate-600">{k}</p><p className="mt-1 text-[48px] leading-none font-semibold">{v}</p><p className="mt-1 text-[22px] text-slate-600">{s}</p></div>)}</div>

          <div className="rounded-xl bg-[#f8f4e8] p-4 text-[#052416]">
            {!hasAccess ? <PaywallCard /> : <>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-[46px] font-semibold">Rankings Overview</h2><div className="flex gap-2"><button className="rounded-lg border px-4 py-2 text-[22px]">All Sectors</button><Link href="/rankings" className="rounded-lg bg-[#062018] px-4 py-2 text-[22px] text-[#d4af37]">Export</Link></div></div>
              <div className="overflow-x-auto"><table className="w-full text-[22px]"><thead><tr className="bg-[#062018] text-[#f8f3e7]"><th className="p-2 text-left">Rank</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>AI Score</th></tr></thead><tbody>{rankings?.map((r) => <tr key={r.id} className="border-b border-slate-200"><td className="p-2">{r.rank}</td><td>{r.ticker}</td><td>{r.company}</td><td>{r.sector}</td><td>${Number(r.price ?? 0).toFixed(2)}</td><td><span className="rounded-full bg-[#d4af37] px-3 py-1">{r.score}</span></td></tr>)}</tbody></table></div>
            </>}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-xl border border-[#d4af37]/25 bg-[#062018] p-4"><div className="flex items-center justify-between"><h3 className="text-[42px]">Market Overview</h3><div className="flex gap-3 text-[24px]"><span className="text-[#d4af37]">1D</span><span>1W</span><span>1M</span><span>1Y</span></div></div><p className="mt-3 text-[28px] text-[#d8d2bf]">S&P 500</p><p className="text-[64px] leading-none">5,321.41</p><p className="text-[32px] text-[#78f2a6]">+42.61 (0.81%) ▲</p><div className="mt-4 grid grid-cols-3 gap-2 text-[22px]"><div className="rounded-lg border border-[#d4af37]/20 bg-[#08251a] p-2"><p>DOW JONES</p><p className="font-semibold">39,872.99</p></div><div className="rounded-lg border border-[#d4af37]/20 bg-[#08251a] p-2"><p>NASDAQ</p><p className="font-semibold">16,832.62</p></div><div className="rounded-lg border border-[#d4af37]/20 bg-[#08251a] p-2"><p>VIX</p><p className="font-semibold text-red-400">12.45</p></div></div></div>
          <div className="rounded-xl border border-[#d4af37]/25 bg-[#062018] p-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-[42px]">Top Gainers</h3><span className="rounded-lg border px-3 py-1 text-[20px]">Today</span></div><ul className="space-y-2 text-[23px]">{(rankings ?? []).slice(0,5).map((r) => <li key={r.id} className="flex items-center justify-between rounded-lg bg-[#08251a] px-3 py-2"><span>{r.ticker}</span><span>${Number(r.price ?? 0).toFixed(2)}</span><span className="rounded-full bg-emerald-600/25 px-2 text-[#78f2a6]">+2.3%</span></li>)}</ul></div>
          <div className="rounded-xl border border-[#d4af37]/25 bg-[#062018] p-4"><h3 className="text-[42px] text-[#d4af37]">AI Insight</h3><p className="mt-2 text-[24px] text-[#d8d2bf]">{news?.[0]?.title ?? "Technology sector shows strong momentum with top-ranked stocks outperforming this week."}</p><Link href="/world-news" className="mt-4 inline-block rounded-lg border border-[#d4af37] px-4 py-2 text-[24px] text-[#d4af37]">View Full Insight</Link></div>
        </aside>
      </main>

      <section className="mt-5 grid gap-3 rounded-xl border border-[#d4af37]/20 bg-[#031a12] p-4 md:grid-cols-2 xl:grid-cols-4">{[["AI-Powered Analysis", "Proprietary AI evaluates 50+ factors to rank stocks"], ["Real-Time Data", "Live market data and updates throughout the day"], ["Secure & Private", "Your data is encrypted and always protected"], ["Premium Insights", "Institutional-grade insights for retail investors"]].map(([title,text]) => <div key={title} className="border-r border-[#d4af37]/20 pr-3 last:border-r-0"><p className="text-[28px] text-[#d4af37]">✧ {title}</p><p className="text-[20px] text-[#d8d2bf]">{text}</p></div>)}</section>
    </AppShell>
  );

  return <AppShell activePath="/"><main className="grid h-full min-h-0 gap-4 lg:grid-cols-[1.8fr_0.75fr] lg:overflow-hidden">
    <section className="flex min-h-0 flex-col gap-3 lg:overflow-hidden">
      <div className="relative rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-r from-[#062117] to-[#0c3323] p-6">
        <div className="pointer-events-none absolute inset-0 opacity-35" style={{backgroundImage:"radial-gradient(circle at 30% 20%, rgba(212,175,55,.2), transparent 40%), linear-gradient(120deg,transparent 50%, rgba(212,175,55,.15) 52%, transparent 54%), repeating-linear-gradient(90deg, transparent 0 26px, rgba(212,175,55,.08) 27px 28px)"}} />
        <p className="relative text-4xl text-[#D4AF37]">Welcome back,</p><h1 className="relative mt-1 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">Make smarter investment decisions.</h1><p className="relative mt-3 max-w-2xl text-lg text-[#F8F3E7]/85 md:text-2xl">AI-powered rankings and real-time insights to help you stay ahead of the market.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[["TOTAL STOCKS", rankings?.length ?? 0],["TOP RANKED", top?.ticker ?? "—"],["HIGHEST SCORE", rankings?.[0]?.score ?? "—"],["LAST UPDATED", top?.updated_at ? new Date(top.updated_at).toLocaleTimeString() : "—"]].map(([k,v])=><div key={String(k)} className="rounded-2xl border border-[#0d3d2b] bg-[#FFFDF5] p-4 text-[#0F2A1F]"><p className="text-xs tracking-widest text-slate-500">{k}</p><p className="mt-2 text-3xl font-semibold md:text-4xl">{v}</p></div>)}</div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-[#D4AF37]/25 bg-[#FFFDF5] p-3 text-[#0F2A1F]">{!hasAccess ? <PaywallCard /> : <><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-semibold md:text-3xl">Rankings Overview</h2><div className="flex gap-2"><button className="rounded-lg border px-3 py-1">All Sectors</button><Link href="/rankings" className="rounded-lg bg-[#0F2A1F] px-3 py-1 text-[#D4AF37]">Export</Link></div></div><table className="w-full text-sm md:text-base"><thead><tr className="bg-[#0F2A1F] text-[#F8F3E7]"><th className="p-2 text-left">Rank</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>AI Score</th></tr></thead><tbody>{rankings?.map((r)=><tr key={r.id} className="border-b"><td className="p-2">{r.rank}</td><td className="font-semibold">{r.ticker}</td><td>{r.company}</td><td>{r.sector}</td><td>${Number(r.price ?? 0).toFixed(2)}</td><td><span className="rounded-full bg-[#D4AF37] px-3 py-1 font-semibold">{r.score}</span></td></tr>)}</tbody></table></>}</div>
    </section>
    <aside className="flex min-h-0 flex-col gap-3 lg:overflow-hidden"><div className="rounded-3xl border border-[#D4AF37]/25 bg-[#051b13] p-4"><h3 className="text-2xl font-semibold md:text-3xl">Market Overview</h3><p className="mt-3 text-5xl font-semibold">${top?.price ? Number(top.price).toFixed(2) : "—"}</p><p className="text-3xl text-emerald-300">Top ranked: {top?.ticker ?? "N/A"}</p></div><div className="rounded-3xl border border-[#D4AF37]/25 bg-[#051b13] p-4"><h3 className="text-2xl font-semibold md:text-3xl">Top Gainers</h3><ul className="mt-2 space-y-2">{rankings?.slice(0,5).map((r)=><li key={r.id} className="flex justify-between rounded-lg border border-[#104531] bg-[#082419] px-3 py-2 text-2xl"><span>{r.ticker}</span><span className="text-emerald-300">#{r.rank}</span></li>)}</ul></div><div className="rounded-3xl border border-[#D4AF37]/25 bg-[#051b13] p-4"><h3 className="text-3xl font-semibold text-[#D4AF37]">AI Insight</h3><p className="mt-2 text-xl text-[#F8F3E7]/85">{news?.[0]?.title ?? "Technology sector momentum remains strong this week."}</p><Link href="/world-news" className="mt-3 inline-block rounded-lg border border-[#D4AF37] px-4 py-2">View Full Insight</Link></div></aside>
  </main></AppShell>;
}
