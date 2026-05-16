import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

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
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(
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
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(
    (data ?? []).map((r) => ({
      ticker: r.ticker,
      company: r.company,
      sector: r.sector,
      rank: r.rank,
      score: r.score,
    })),
  );
}