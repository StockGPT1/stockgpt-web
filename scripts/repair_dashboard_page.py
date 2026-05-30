from pathlib import Path

p = Path('app/dashboard/page.tsx')
s = p.read_text()

start = s.find('import type { Metadata } from "next";')
end = s.find('type Ranking = {')
if start == -1 or end == -1:
    raise SystemExit('Could not find dashboard header markers')

header = '''import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { StockChart } from "@/components/StockChart";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { getOneDayMoveMap, getSP500Chart, getTopMovers } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
} from "@/lib/rank-history";

export const metadata: Metadata = {
  title: "Dashboard | StockGPT Portfolio Intelligence",
  description:
    "Private StockGPT dashboard for AI stock rankings, market movers, portfolio alerts and S&P 500 insights.",
  robots: { index: false, follow: false },
};

'''

s = header + s[end:]

old = '''  const [sp500Data, topGainerMovers, topLoserMovers, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(topGainerTickerList, 8),
    getTopMovers(loserTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
  ]);
'''
new = '''  const [sp500Data, topGainerMovers, topLoserMovers, snapshotMap, dailyMoveMap] =
    hasSubscription
      ? await Promise.all([
          getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
          getTopMovers(topGainerTickerList, 8),
          getTopMovers(loserTickerList, 8),
          getRankSnapshotMapAround24hAgo(supabase),
          getOneDayMoveMap(dashboardTickerList),
        ])
      : [
          {},
          { gainers: [], losers: [] },
          { gainers: [], losers: [] },
          new Map(),
          new Map(),
        ];
'''
if old in s:
    s = s.replace(old, new)
else:
    print('Market data block not found; header still repaired')

p.write_text(s)
print('Dashboard repaired')
