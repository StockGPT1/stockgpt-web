import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  checkRateLimit,
  getClientIp,
  rateKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";

const SEARCH_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

const FEATURE_RESULTS = [
  {
    type: "feature",
    title: "Dashboard",
    description: "Portfolio snapshot, market overview and StockGPT insights",
    href: "/dashboard",
  },
  {
    type: "feature",
    title: "Rankings",
    description: "AI-ranked S&P 500 table",
    href: "/rankings",
  },
  {
    type: "feature",
    title: "Portfolio",
    description: "Build and track your holdings",
    href: "/portfolio",
  },
  {
    type: "feature",
    title: "Watchlist",
    description: "Track stocks you care about",
    href: "/watchlist",
  },
  {
    type: "feature",
    title: "Alerts",
    description: "Action and event alerts",
    href: "/notifications",
  },
  {
    type: "feature",
    title: "World News",
    description: "Market-moving news and affected tickers",
    href: "/world-news",
  },
  {
    type: "feature",
    title: "Settings",
    description: "Account, subscription and preferences",
    href: "/settings",
  },
];

function cleanSearchQuery(value: string) {
  return value.replace(/[%,()]/g, "").trim().slice(0, 60);
}

function json(data: unknown) {
  return NextResponse.json(data, { headers: SEARCH_HEADERS });
}

function matchingFeatures(q: string) {
  const lower = q.toLowerCase();

  return FEATURE_RESULTS.filter((feature) => {
    return (
      feature.title.toLowerCase().includes(lower) ||
      feature.description.toLowerCase().includes(lower)
    );
  }).slice(0, 6);
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

  const features = matchingFeatures(q);

  if (!user) {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("stock_rankings")
      .select("ticker, company, sector")
      .or(`ticker.ilike.${q}%,company.ilike.%${q}%`)
      .order("ticker", { ascending: true, nullsFirst: false })
      .limit(6);

    if (error) {
      console.error("[/api/search]", error);
      return json(features);
    }

    return json([
      ...features,
      ...(data ?? []).map((r) => ({
        type: "ticker",
        ticker: r.ticker,
        company: r.company,
        sector: r.sector,
      })),
    ]);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const activeStatuses = new Set([
    "basic",
    "core",
    "premium",
    "executive",
    "max",
    "alpha",
    "trialing",
    "active",
  ]);

  const hasAccess = activeStatuses.has(
    String(profile?.subscription_status ?? "").toLowerCase(),
  );

  const client = hasAccess ? supabase : createAdminClient();

  const { data, error } = await client
    .from("stock_rankings")
    .select(hasAccess ? "ticker, company, sector, rank, score" : "ticker, company, sector")
    .or(`ticker.ilike.${q}%,company.ilike.%${q}%`)
    .order(hasAccess ? "rank" : "ticker", { ascending: true, nullsFirst: false })
    .limit(8);

  if (error) {
    console.error("[/api/search]", error);
    return json(features);
  }

  return json([
    ...features,
    ...(data ?? []).map((r) => ({
      type: "ticker",
      ticker: r.ticker,
      company: r.company,
      sector: r.sector,
      rank: hasAccess ? r.rank : undefined,
      score: hasAccess ? r.score : undefined,
    })),
  ]);
}
