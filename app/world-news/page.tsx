import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

function impactColour(impact: string | null) {
  if (impact === "positive") return "text-green-600 bg-green-100";
  if (impact === "negative") return "text-red-600 bg-red-100";
  return "text-yellow-700 bg-yellow-100";
}

export default async function WorldNewsPage() {
  const supabase = await createClient();
  const { data: articles, error } = await supabase.from("news_articles").select("*").order("published_at", { ascending: false }).limit(30);
  return <AppShell activePath="/world-news"><main>{error ? <p>Error loading news.</p> : <div className="grid gap-6">{articles?.map((article) => <article key={article.id} className="rounded-2xl border border-[#D4AF37]/25 bg-white p-6 text-[#0F2A1F]"><div className="mb-3 flex flex-wrap gap-3"><span className="rounded-full bg-[#0F2A1F] px-3 py-1 text-xs font-semibold text-[#D4AF37]">{article.source || "Unknown Source"}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${impactColour(article.impact)}`}>{article.impact || "neutral"}</span></div><h2 className="text-2xl font-bold">{article.title}</h2><p className="mt-3 text-sm text-slate-700">{article.summary}</p><p className="mt-2 text-xs text-slate-500">{article.published_at ? new Date(article.published_at).toLocaleString() : ""}</p><a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold">Read more</a></article>)}</div>}</main></AppShell>;
}
