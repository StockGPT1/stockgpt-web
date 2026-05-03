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
  const { data: news } = await supabase.from("news_articles").select("id,title,summary").order("published_at", { ascending: false }).limit(3);
  const top = rankings?.[0];
  const topUpdated = top?.updated_at;

  return <AppShell activePath="/"><main className="grid h-full gap-4 xl:grid-cols-[1fr_320px]">
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="h-1/4 rounded-xl border border-[#d4af37]/25 bg-[#062018] p-5">
        <p className="text-sm text-[#d4af37]">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Make Smarter Investment Decisions</h1>
      </div>
      <div className="grid h-1/5 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">{[["Total Stocks", "500", "ranked by ai score", "▮▮▮↗"], ["Top Ranked", top?.ticker ?? "—", top?.company ?? "—", "♕"], ["Top Gainer", "NVDA", "placeholder", "↗"], ["Last Updated", topUpdated ? new Date(topUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—", "", "◷"]].map(([title, main, sub, icon]) => <div key={String(title)} className="rounded-xl bg-[#f8f4e8] p-3 text-[#062018]"><div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#062018] text-[#d4af37]">{icon}</span><div><p className="text-xs uppercase">{title}</p><p className="text-2xl font-semibold leading-none">{main}</p><p className="text-xs text-slate-600">{sub}</p></div></div></div>)}</div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-[#f8f4e8] p-3 text-[#062018]">{!hasAccess ? <PaywallCard /> : <><div className="mb-2 flex items-center justify-between"><h2 className="text-xl font-semibold">Top 10 Rankings</h2><Link href="/rankings" className="rounded-lg bg-[#062018] px-3 py-1 text-sm text-[#d4af37]">View all</Link></div><div className="h-[calc(100%-36px)] overflow-auto"><table className="w-full text-sm"><thead><tr className="bg-[#062018] text-[#f8f3e7]"><th className="p-2 text-left">Rank</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>AI Score</th></tr></thead><tbody>{rankings?.map((r) => <tr key={r.id} className="border-b"><td className="p-2">{r.rank}</td><td>{r.ticker}</td><td>{r.company}</td><td>{r.sector}</td><td>${Number(r.price ?? 0).toFixed(2)}</td><td><span className="rounded-full bg-[#d4af37] px-2 py-0.5">{r.score}</span></td></tr>)}</tbody></table></div></>}</div>
    </section>
    <aside className="flex h-full min-h-0 flex-col gap-3"><div className="rounded-xl border border-[#d4af37]/25 bg-[#062018] p-3"><h3 className="text-lg text-[#d4af37]">Latest World News</h3></div>{(news ?? []).map((n) => <article key={n.id} className="rounded-xl border border-[#d4af37]/25 bg-[#062018] p-3"><p className="text-sm font-semibold">{n.title}</p><p className="mt-1 line-clamp-3 text-xs text-[#d8d2bf]">{n.summary}</p><Link href="/world-news" className="mt-2 inline-block text-xs text-[#d4af37]">Read in World News →</Link></article>)}</aside>
  </main></AppShell>;
}
