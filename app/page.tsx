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

  const { data: rankings } = await supabase.from("stock_rankings").select("id,rank,ticker,company,score,price,updated_at").order("rank", { ascending: true }).limit(10);
  const { data: news } = await supabase.from("news_articles").select("id,title,source,published_at").order("published_at", { ascending: false }).limit(3);

  const top = rankings?.[0];
  const highestScore = rankings?.reduce((max, r) => Math.max(max, Number(r.score ?? 0)), 0) ?? 0;

  return <AppShell activePath="/">
    <main className="space-y-6">
      <section className="rounded-3xl border border-[#D4AF37]/25 bg-[#0B241A] p-6">
        <h2 className="text-3xl font-semibold">Private Market Intelligence</h2>
      </section>
      <section className="grid gap-4 md:grid-cols-4">{[
        ["Total stocks", String(rankings?.length ?? 0)],
        ["Top ticker", top?.ticker ?? "—"],
        ["Highest score", String(highestScore || "—")],
        ["Last updated", top?.updated_at ? new Date(top.updated_at).toLocaleString() : "—"],
      ].map(([k,v]) => <div key={k} className="rounded-2xl bg-[#FFFDF5] p-4 text-[#0F2A1F]"><p className="text-sm text-slate-500">{k}</p><p className="mt-2 text-2xl font-semibold">{v}</p></div>)}</section>
      {!hasAccess ? <PaywallCard /> : <div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2 rounded-2xl bg-[#FFFDF5] p-4 text-[#0F2A1F]"><h3 className="mb-3 text-xl font-semibold">Rankings Preview</h3><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Rank</th><th>Ticker</th><th>Company</th><th>Score</th><th>Price</th></tr></thead><tbody>{rankings?.map((r)=><tr key={r.id} className="border-t border-slate-200"><td className="py-2">{r.rank}</td><td>{r.ticker}</td><td>{r.company}</td><td>{r.score}</td><td>${Number(r.price ?? 0).toFixed(2)}</td></tr>)}</tbody></table><Link href="/rankings" className="mt-3 inline-block text-[#0F2A1F] underline">View full rankings</Link></div>
      <aside className="space-y-4"><div className="rounded-2xl bg-[#FFFDF5] p-4 text-[#0F2A1F]"><h4 className="font-semibold">Top Gainers</h4><ul className="mt-2 text-sm">{rankings?.slice(0,5).map((r)=><li key={r.id} className="flex justify-between py-1"><span>{r.ticker}</span><span>#{r.rank}</span></li>)}</ul></div><div className="rounded-2xl bg-[#FFFDF5] p-4 text-[#0F2A1F]"><h4 className="font-semibold">World News</h4><ul className="mt-2 space-y-2 text-sm">{news?.map((n)=><li key={n.id}><p>{n.title}</p><p className="text-xs text-slate-500">{n.source}</p></li>)}</ul><Link href="/world-news" className="mt-2 inline-block underline">Read all</Link></div></aside></div>}
    </main>
  </AppShell>;
}
