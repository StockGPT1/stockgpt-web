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
  const { data: rankings } = await supabase.from("stock_rankings").select("id,rank,ticker,company,sector,score,price,updated_at").order("rank", { ascending: true }).limit(12);
  const { data: news } = await supabase.from("news_articles").select("id,title,source,published_at").order("published_at", { ascending: false }).limit(4);
  const top = rankings?.[0];

  return <AppShell activePath="/"><main className="space-y-4">
    <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]"><div className="rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-r from-[#082117] to-[#0d3123] p-6"><p className="text-[#D4AF37]">Welcome back,</p><h2 className="mt-2 max-w-xl text-5xl font-semibold leading-tight">Make smarter investment decisions.</h2><p className="mt-3 max-w-lg text-[#F8F3E7]/75">AI-powered rankings and market intelligence engineered for disciplined investors.</p></div><aside className="rounded-3xl border border-[#D4AF37]/20 bg-[#051a12]/85 p-5"><h3 className="text-2xl font-semibold">Market Overview</h3><p className="mt-4 text-4xl font-semibold">{top?.price ? `$${Number(top.price).toFixed(2)}` : "—"}</p><p className="mt-2 text-sm text-emerald-300">Top ranked: {top?.ticker ?? "N/A"}</p></aside></section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[["Total Stocks",rankings?.length ?? 0],["Top Ranked",top?.ticker ?? "—"],["Highest Score",rankings?.[0]?.score ?? "—"],["Last Updated",top?.updated_at ? new Date(top.updated_at).toLocaleTimeString() : "—"]].map(([k,v])=><div key={String(k)} className="rounded-2xl border border-[#0f3d2b] bg-[#FFFDF5] p-5 text-[#0F2A1F]"><p className="text-xs uppercase tracking-widest text-slate-500">{k}</p><p className="mt-2 text-4xl font-semibold">{v}</p></div>)}</section>

    {!hasAccess ? <PaywallCard /> : <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]"><div className="rounded-3xl border border-[#D4AF37]/30 bg-[#FFFDF5] p-4 text-[#0F2A1F]"><div className="mb-4 flex items-center justify-between"><h3 className="text-3xl font-semibold">Rankings Overview</h3><Link href="/rankings" className="rounded-lg bg-[#0F2A1F] px-4 py-2 text-sm text-[#D4AF37]">Open Full Table</Link></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-[#0F2A1F] text-[#F8F3E7]"><th className="p-2 text-left">Rank</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>AI Score</th></tr></thead><tbody>{rankings?.map((r)=><tr key={r.id} className="border-b border-slate-200"><td className="p-2">{r.rank}</td><td className="font-semibold">{r.ticker}</td><td>{r.company}</td><td>{r.sector}</td><td>${Number(r.price ?? 0).toFixed(2)}</td><td><span className="rounded-full bg-[#D4AF37]/80 px-3 py-1 font-semibold text-[#0F2A1F]">{r.score}</span></td></tr>)}</tbody></table></div></div>
    <aside className="space-y-4"><div className="rounded-2xl border border-[#D4AF37]/25 bg-[#061c13] p-4"><h4 className="text-2xl font-semibold">Top Gainers</h4><ul className="mt-3 space-y-2">{rankings?.slice(0,5).map((r)=><li key={r.id} className="flex items-center justify-between rounded-lg border border-[#104531] bg-[#082419] px-3 py-2"><span>{r.ticker}</span><span className="text-emerald-300">#{r.rank}</span></li>)}</ul></div><div className="rounded-2xl border border-[#D4AF37]/25 bg-[#061c13] p-4"><h4 className="text-xl font-semibold text-[#D4AF37]">AI Insight</h4><p className="mt-2 text-sm text-[#F8F3E7]/80">{news?.[0]?.title ?? "No news available yet."}</p><Link href="/world-news" className="mt-3 inline-block text-sm underline">View full insight feed</Link></div></aside></section>}
  </main></AppShell>;
}
