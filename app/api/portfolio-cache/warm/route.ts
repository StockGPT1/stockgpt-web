import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedPortfolioNews,
  getCachedPortfolioStockUniverse,
} from "@/lib/portfolio-speed-cache";
import { redisCommand } from "@/lib/redis";
import { getTickerTape } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redisPing = await redisCommand<string>(["PING"]);

  const results = await Promise.allSettled([
    getCachedPortfolioStockUniverse(),
    getCachedPortfolioNews(),
    getTickerTape(),
  ]);

  return NextResponse.json({
    ok: true,
    mode: "shared-cache-only",
    redis: redisPing === "PONG" ? "ok" : "miss",
    warmed: {
      stockUniverse: results[0].status === "fulfilled",
      news: results[1].status === "fulfilled",
      tickerTape: results[2].status === "fulfilled",
    },
  });
}
