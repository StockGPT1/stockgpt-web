import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getUsableNewsSummary } from "@/lib/news-summary";
import { fetchPublicNewsPage, fetchPublisherSummary } from "@/lib/news-publisher";
import { resolveNewsSourceUrl } from "@/lib/news-source-url";
import { hasActiveSubscription } from "@/lib/subscription";
import { checkRateLimit, rateKey, tooManyRequests } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const getPublisherSummary = unstable_cache(async (url: string, title: string) => {
  const publisherUrl = await resolveNewsSourceUrl(url, async (target, options) => {
    const page = await fetchPublicNewsPage(target, { ...options, timeoutMs: 4_000 });
    if (!page) throw new Error("News source unavailable");
    return { url: page.url, status: page.status, body: page.html };
  });
  return publisherUrl ? fetchPublisherSummary(publisherUrl, title) : null;
}, ["stockgpt-publisher-summary-v1"], { revalidate: 60 * 60 });

function json(summary: string | null) {
  return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const articleId = request.nextUrl.searchParams.get("id")?.trim();
    if (!articleId || !/^[a-zA-Z0-9-]{1,100}$/.test(articleId)) {
      return NextResponse.json({ error: "Invalid article." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles")
      .select("subscription_status").eq("id", user.id).maybeSingle();
    if (!hasActiveSubscription(profile?.subscription_status)) {
      return NextResponse.json({ error: "An active plan is required." }, { status: 403 });
    }
    // Only stored news IDs are accepted. A caller cannot submit an arbitrary URL.
    const admin = createAdminClient();
    const { data: article, error } = await admin.from("news_articles")
      .select("id,title,summary,source,url").eq("id", articleId).maybeSingle();
    if (error || !article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    const existingSummary = getUsableNewsSummary(article);
    if (existingSummary) return json(existingSummary);
    if (!article.url) return json(null);
    const limit = await checkRateLimit({
      action: "news-summary", key: rateKey([user.id]), limit: 60, windowSeconds: 60 * 60,
    });
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
    const summary = await getPublisherSummary(article.url, article.title ?? "");
    if (summary) {
      const update = admin.from("news_articles").update({ summary }).eq("id", article.id);
      const { error: updateError } = await (article.summary == null
        ? update.is("summary", null) : update.eq("summary", article.summary));
      if (updateError) console.warn("[news-summary] save failed", { code: updateError.code });
    }
    return json(summary);
  } catch {
    return json(null);
  }
}
