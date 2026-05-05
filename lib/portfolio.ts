import { createClient } from "@/utils/supabase/server";

export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type TimeHorizon = "short" | "medium" | "long";

export type Holding = {
  ticker: string;
  company: string;
  sector: string;
  rank: number;
  score: number;
  price: number;
  allocationPct: number;
  allocationDollars: number;
  shares: number;
  reasoning: string;
};

export type Portfolio = {
  holdings: Holding[];
  sectorBreakdown: { sector: string; pct: number }[];
  avgScore: number;
  totalInvested: number;
  riskTolerance: RiskTolerance;
  timeHorizon: TimeHorizon;
};

// ── Sector weight templates per risk profile ─────────────────
const SECTOR_WEIGHTS: Record<RiskTolerance, Record<string, number>> = {
  conservative: {
    "Consumer Staples": 0.18,
    "Health Care": 0.18,
    Healthcare: 0.18,
    Utilities: 0.15,
    Financials: 0.15,
    Industrials: 0.10,
    "Information Technology": 0.10,
    Technology: 0.10,
    "Communication Services": 0.07,
    "Real Estate": 0.07,
    "Consumer Discretionary": 0.05,
    Energy: 0.03,
    Materials: 0.02,
  },
  moderate: {
    "Information Technology": 0.22,
    Technology: 0.22,
    "Health Care": 0.15,
    Healthcare: 0.15,
    Financials: 0.13,
    "Consumer Discretionary": 0.12,
    "Communication Services": 0.10,
    Industrials: 0.10,
    "Consumer Staples": 0.08,
    Energy: 0.04,
    "Real Estate": 0.03,
    Utilities: 0.02,
    Materials: 0.01,
  },
  aggressive: {
    "Information Technology": 0.35,
    Technology: 0.35,
    "Consumer Discretionary": 0.20,
    "Communication Services": 0.15,
    "Health Care": 0.10,
    Healthcare: 0.10,
    Financials: 0.08,
    Industrials: 0.05,
    Energy: 0.04,
    Materials: 0.02,
    "Consumer Staples": 0.01,
  },
};

// Time horizon adjusts the count of holdings (longer = more diversified)
const HOLDING_COUNT: Record<TimeHorizon, number> = {
  short: 5,
  medium: 7,
  long: 8,
};

function buildReasoning(
  stock: { rank: number; score: number; sector: string },
  risk: RiskTolerance
): string {
  const reasons: string[] = [];

  if (stock.rank <= 10) {
    reasons.push(`Top-10 ranked stock (Rank #${stock.rank})`);
  } else if (stock.rank <= 50) {
    reasons.push(`Top-50 ranked (Rank #${stock.rank})`);
  } else if (stock.rank <= 100) {
    reasons.push(`Top-quartile rank (#${stock.rank})`);
  }

  if (stock.score >= 9000) {
    reasons.push("exceptionally strong AI signal");
  } else if (stock.score >= 7500) {
    reasons.push("strong AI signal");
  } else if (stock.score >= 5000) {
    reasons.push("solid AI signal");
  }

  if (risk === "conservative") {
    reasons.push(`stable ${stock.sector} exposure`);
  } else if (risk === "aggressive") {
    reasons.push(`growth-oriented ${stock.sector} pick`);
  } else {
    reasons.push(`balanced ${stock.sector} exposure`);
  }

  return reasons.join(" · ");
}

export async function generatePortfolio({
  riskTolerance,
  timeHorizon,
  investmentAmount,
}: {
  riskTolerance: RiskTolerance;
  timeHorizon: TimeHorizon;
  investmentAmount: number;
}): Promise<Portfolio | null> {
  if (!investmentAmount || investmentAmount <= 0) return null;

  const supabase = await createClient();

  // Pull a deep slice of top-ranked stocks (we'll filter by sector preference)
  const { data: stocksData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score, price")
    .order("rank", { ascending: true })
    .limit(150);

  if (!stocksData || stocksData.length === 0) return null;

  const targetCount = HOLDING_COUNT[timeHorizon];
  const sectorWeights = SECTOR_WEIGHTS[riskTolerance];

  // For each preferred sector (highest weight first), pick the best stock
  const sortedSectors = Object.entries(sectorWeights).sort(
    (a, b) => b[1] - a[1]
  );

  const picked: Map<
    string,
    {
      ticker: string;
      company: string;
      sector: string;
      rank: number;
      score: number;
      price: number;
      sectorWeight: number;
    }
  > = new Map();
  const seenSectors = new Set<string>();

  for (const [sectorName, weight] of sortedSectors) {
    if (picked.size >= targetCount) break;
    if (seenSectors.has(sectorName)) continue;

    // Find top unpicked stock in this sector
    const candidate = stocksData.find(
      (s) =>
        s.sector === sectorName &&
        s.ticker &&
        !picked.has(s.ticker) &&
        Number.isFinite(Number(s.price)) &&
        Number(s.price) > 0
    );

    if (candidate) {
      picked.set(candidate.ticker as string, {
        ticker: candidate.ticker as string,
        company: (candidate.company as string) ?? candidate.ticker,
        sector: candidate.sector as string,
        rank: Number(candidate.rank) || 999,
        score: Number(candidate.score) || 0,
        price: Number(candidate.price),
        sectorWeight: weight,
      });
      seenSectors.add(sectorName);
    }
  }

  // If we didn't fill enough, pad with top-ranked unused stocks
  if (picked.size < targetCount) {
    for (const s of stocksData) {
      if (picked.size >= targetCount) break;
      if (
        s.ticker &&
        !picked.has(s.ticker) &&
        Number.isFinite(Number(s.price)) &&
        Number(s.price) > 0
      ) {
        picked.set(s.ticker as string, {
          ticker: s.ticker as string,
          company: (s.company as string) ?? s.ticker,
          sector: (s.sector as string) ?? "—",
          rank: Number(s.rank) || 999,
          score: Number(s.score) || 0,
          price: Number(s.price),
          sectorWeight: 0.05,
        });
      }
    }
  }

  const candidates = Array.from(picked.values());

  // Allocate weights — sectorWeight × scoreFactor, then normalise to 100%
  const rawWeights = candidates.map((c) => {
    const scoreFactor = 0.5 + (c.score / 10000) * 0.5; // 0.5 to 1.0
    return c.sectorWeight * scoreFactor;
  });
  const totalRaw = rawWeights.reduce((sum, w) => sum + w, 0);

  const holdings: Holding[] = candidates.map((c, i) => {
    const allocationPct = (rawWeights[i] / totalRaw) * 100;
    const allocationDollars = (allocationPct / 100) * investmentAmount;
    const shares = allocationDollars / c.price;

    return {
      ticker: c.ticker,
      company: c.company,
      sector: c.sector,
      rank: c.rank,
      score: c.score,
      price: c.price,
      allocationPct: Math.round(allocationPct * 10) / 10,
      allocationDollars: Math.round(allocationDollars),
      shares: Math.round(shares * 100) / 100,
      reasoning: buildReasoning(c, riskTolerance),
    };
  });

  // Sort by allocation (largest first)
  holdings.sort((a, b) => b.allocationPct - a.allocationPct);

  // Sector breakdown
  const sectorMap: Record<string, number> = {};
  holdings.forEach((h) => {
    sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.allocationPct;
  });
  const sectorBreakdown = Object.entries(sectorMap)
    .map(([sector, pct]) => ({ sector, pct: Math.round(pct * 10) / 10 }))
    .sort((a, b) => b.pct - a.pct);

  const avgScore = Math.round(
    holdings.reduce((sum, h) => sum + h.score, 0) / holdings.length
  );

  return {
    holdings,
    sectorBreakdown,
    avgScore,
    totalInvested: investmentAmount,
    riskTolerance,
    timeHorizon,
  };
}
