import { supabase } from "@/lib/supabaseClient";

function impactColour(impact: string | null) {
  if (impact === "positive") return "text-green-600 bg-green-100";
  if (impact === "negative") return "text-red-600 bg-red-100";
  return "text-yellow-700 bg-yellow-100";
}

export default async function WorldNewsPage() {
  const { data: articles, error } = await supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(30);

  if (error) {
    return <main className="p-8">Error loading news.</main>;
  }

  return (
    <main className="min-h-screen bg-[#0F2A1F] p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[#D4AF37]">
            Market Intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">World News</h1>
          <p className="mt-3 max-w-2xl text-white/70">
            Curated business headlines with likely stock and sector impact.
          </p>
        </div>

        <div className="grid gap-6">
          {articles?.map((article) => (
            <article
              key={article.id}
              className="rounded-2xl border border-[#D4AF37]/25 bg-white p-6 text-[#0F2A1F] shadow-xl"
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#0F2A1F] px-3 py-1 text-xs font-semibold text-[#D4AF37]">
                  {article.source || "Unknown Source"}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${impactColour(
                    article.impact
                  )}`}
                >
                  {article.impact || "neutral"}
                </span>
              </div>

              <h2 className="text-2xl font-bold">{article.title}</h2>

              <p className="mt-3 text-sm leading-6 text-slate-700">
                {article.summary}
              </p>

              <div className="mt-5 rounded-xl bg-[#0F2A1F]/5 p-4">
                <p className="text-sm font-bold text-[#0F2A1F]">
                  Stocks most likely affected
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {article.affected_tickers?.length ? (
                    article.affected_tickers.map((ticker: string) => (
                      <span
                        key={ticker}
                        className="rounded-full border border-[#D4AF37]/40 px-3 py-1 text-xs font-semibold"
                      >
                        {ticker}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">
                      No direct ticker match detected
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  {article.impact_reason}
                </p>
              </div>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold text-[#0F2A1F]"
              >
                Read more
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}