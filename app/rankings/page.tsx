import { AppShell } from "@/components/AppShell";
import { PaywallCard } from "@/components/PaywallCard";
import { createClient } from "@/utils/supabase/server";

export default async function RankingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let hasAccess = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).single();
    hasAccess = profile?.subscription_status === "basic";
  }
  const { data: rankings } = await supabase.from("stock_rankings").select("id,rank,ticker,company,sector,score,price").order("rank", { ascending: true }).limit(500);

  return <AppShell activePath="/rankings"><main>{!hasAccess ? <PaywallCard /> : <section className="rounded-3xl border border-[#D4AF37]/25 bg-[#FFFDF5] p-5 text-[#0F2A1F]"><div className="mb-4 flex items-center justify-between"><h2 className="text-3xl font-semibold">Rankings Terminal</h2><div className="rounded-xl bg-[#0F2A1F] px-3 py-2 text-sm text-[#D4AF37]">All sectors</div></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-[#0F2A1F] text-left text-[#F8F3E7]"><th className="p-3">Rank</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>AI Score</th></tr></thead><tbody>{rankings?.map((r)=><tr key={r.id} className="border-b border-slate-200 text-sm"><td className="p-3">{r.rank}</td><td className="font-semibold">{r.ticker}</td><td>{r.company}</td><td>{r.sector}</td><td>${Number(r.price ?? 0).toFixed(2)}</td><td><span className="rounded-full bg-[#D4AF37] px-3 py-1 font-semibold">{r.score}</span></td></tr>)}</tbody></table></div></section>}</main></AppShell>;
}
