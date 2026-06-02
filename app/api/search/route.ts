import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const SEARCH_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

function cleanSearchQuery(value: string) {
  return value.replace(/[%,()]/g, "").trim().slice(0, 60);
}

function json(data: unknown) {
  return NextResponse.json(data, { headers: SEARCH_HEADERS });
}

export async function GET(req: NextRequest) {
  const q = cleanSearchQuery(req.nextUrl.searchParams.get("q") ?? "");
  if (!q) return json([]);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    const { data, error } = await supabase
      .from("stock_rankings")
      .select("ticker, company, sector")
      .or(`ticker.ilike.${q}%,company.ilike.%${q}%`)
      .order("ticker", { ascending: true, nullsFirst: false })
      .limit(8);

    if (error) {
      console.error("[/api/search]", error);
      return json([]);
    }

    return json(
      (data ?? []).map((r) => ({
        ticker: r.ticker,
        company: r.company,
        sector: r.sector,
      })),
    );
  }

  const { data, error } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score")
    .or(`ticker.ilike.${q}%,company.ilike.%${q}%`)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(8);

  if (error) {
    console.error("[/api/search]", error);
    return json([]);
  }

  return json(
    (data ?? []).map((r) => ({
      ticker: r.ticker,
      company: r.company,
      sector: r.sector,
      rank: r.rank,
      score: r.score,
    })),
  );
}
