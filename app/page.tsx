import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // 1. Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Check subscription
  let hasAccess = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    hasAccess = profile?.subscription_status === "basic";
  }

  // 3. Fetch rankings (unchanged)
  const { data: rankings, error } = await supabase
    .from("stock_rankings")
    .select("*")
    .order("rank", { ascending: true })
    .limit(500);

  if (error) {
    return <main className="p-8">Error loading rankings.</main>;
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">StockGPT Rankings</h1>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr>
              <th className="border p-2">Rank</th>
              <th className="border p-2">Ticker</th>
              <th className="border p-2">Company</th>
              <th className="border p-2">Sector</th>
              <th className="border p-2">Price</th>
              <th className="border p-2">Score</th>
            </tr>
          </thead>

          <tbody>
  {hasAccess ? (
    rankings?.map((s) => (
      <tr key={s.id}>
        <td className="border p-2">{s.rank}</td>
        <td className="border p-2 font-bold">{s.ticker}</td>
        <td className="border p-2">{s.company}</td>
        <td className="border p-2">{s.sector}</td>
        <td className="border p-2">${Number(s.price).toFixed(2)}</td>
        <td className="border p-2">{s.score}</td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan={6} className="p-8 text-center">
        <div className="rounded-2xl bg-white p-8 text-[#0F2A1F]">
          <h2 className="text-2xl font-bold">Unlock StockGPT</h2>
          <p className="mt-2 text-slate-600">
            Subscribe to access full rankings and insights.
          </p>

          <a
            href="/pricing"
            className="mt-4 inline-block rounded-xl bg-[#D4AF37] px-6 py-3 font-bold"
          >
            Subscribe now
          </a>
        </div>
      </td>
    </tr>
  )}
</tbody>
        </table>
      </div>
    </main>
  );
}