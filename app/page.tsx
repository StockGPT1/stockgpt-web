import { supabase } from "@/lib/supabaseClient";

export default async function Home() {
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
            {rankings?.map((s) => (
              <tr key={s.id}>
                <td className="border p-2">{s.rank}</td>
                <td className="border p-2 font-bold">{s.ticker}</td>
                <td className="border p-2">{s.company}</td>
                <td className="border p-2">{s.sector}</td>
                <td className="border p-2">${Number(s.price).toFixed(2)}</td>
                <td className="border p-2">{s.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}