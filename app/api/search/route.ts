import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  checkRateLimit,
  getClientIp,
  rateKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";

const SEARCH_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

type PublicTickerResult = {
  type: "ticker";
  ticker: string;
  company: string;
  sector?: string;
};

type SubscriberTickerResult = PublicTickerResult & {
  rank: number | null;
  score: number | string | null;
};

function cleanSearchQuery(value: string) {
  return value.replace(/[^a-zA-Z0-9.'& -]/g, "").trim().slice(0, 60);
}

function json(data: unknown) {
  return NextResponse.json(data, { headers: SEARCH_HEADERS });
}

export async function GET(req: NextRequest) {
  const limit = await checkRateLimit({
    action: "api_search",
    key: rateKey(["api-search", getClientIp(req)]),
    limit: 60,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfterSeconds);
  }

  const q = cleanSearchQuery(req.nextUrl.searchParams.get("q") ?? "");
  if (!q) return json([]);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasAccess = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();
    hasAccess = hasActiveSubscription(profile?.subscription_status);
  }

  const result = hasAccess
    ? await supabase
        .from("stock_rankings")
        .select("ticker, company, sector, rank, score")
        .or(`ticker.ilike.${q}%,company.ilike.%${q}%`)
        .order("ticker", { ascending: true, nullsFirst: false })
        .limit(8)
    : await createAdminClient()
        .from("stock_rankings")
        .select("ticker, company, sector")
        .or(`ticker.ilike.${q}%,company.ilike.%${q}%`)
        .order("ticker", { ascending: true, nullsFirst: false })
        .limit(8);
  const { data, error } = result;

  if (error) {
    console.error("[/api/search]", error);
    return NextResponse.json(
      { error: "Search is temporarily unavailable." },
      { status: 503, headers: SEARCH_HEADERS },
    );
  }

  const rows = (data ?? []) as Array<{
    ticker: string | null;
    company: string | null;
    sector: string | null;
    rank?: number | null;
    score?: number | string | null;
  }>;
  const tickers: Array<PublicTickerResult | SubscriberTickerResult> = rows
    .filter((row) => typeof row.ticker === "string" && row.ticker.length > 0)
    .map((row) => ({
      type: "ticker" as const,
      ticker: String(row.ticker),
      company: String(row.company ?? row.ticker),
      ...(row.sector ? { sector: String(row.sector) } : {}),
      ...(hasAccess
        ? {
            rank: typeof row.rank === "number" ? row.rank : null,
            score:
              typeof row.score === "number" || typeof row.score === "string"
                ? row.score
                : null,
          }
        : {}),
    }));

  return json(tickers);
}
