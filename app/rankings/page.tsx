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

  return <AppShell activePath="/rankings"><main>{!hasAccess ? <PaywallCard /> : <div className="rounded-2xl bg-[#FFFDF5] p-6 text-[#0F2A1F]"><h2 className="mb-4 text-2xl font-semibold">All Rankings</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Rank</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Score</th><th>Price</th></tr></thead><tbody>{rankings?.map((r)=><tr key={r.id} className="border-t"><td className="py-2">{r.rank}</td><td>{r.ticker}</td><td>{r.company}</td><td>{r.sector}</td><td>{r.score}</td><td>${Number(r.price ?? 0).toFixed(2)}</td></tr>)}</tbody></table></div></div>}</main></AppShell>;
}
