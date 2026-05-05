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

export type SectorBreakdown = {
  sector: string;
  pct: number;
  rationale: string;
  role: "Defensive" | "Balanced" | "Growth" | "Income";
};

export type Portfolio = {
  holdings: Holding[];
  sectorBreakdown: SectorBreakdown[];
  avgScore: number;
  totalInvested: number;
  riskTolerance: RiskTolerance;
  timeHorizon: TimeHorizon;
  strategy: string;
  expectedAnnualReturn: number;
  riskAssessment: string;
  diversificationScore: number;
};

const SECTOR_WEIGHTS: Record<RiskTolerance, Record<string, number>> = {
  conservative: {
    "Consumer Staples": 0.18, "Health Care": 0.18, Healthcare: 0.18,
    Utilities: 0.15, Financials: 0.15, Industrials: 0.10,
    "Information Technology": 0.10, Technology: 0.10,
    "Communication Services": 0.07, "Real Estate": 0.07,
    "Consumer Discretionary": 0.05, Energy: 0.03, Materials: 0.02,
  },
  moderate: {
    "Information Technology": 0.22, Technology: 0.22,
    "Health Care": 0.15, Healthcare: 0.15, Financials: 0.13,
    "Consumer Discretionary": 0.12, "Communication Services": 0.10,
    Industrials: 0.10, "Consumer Staples": 0.08, Energy: 0.04,
    "Real Estate": 0.03, Utilities: 0.02, Materials: 0.01,
  },
  aggressive: {
    "Information Technology": 0.35, Technology: 0.35,
    "Consumer Discretionary": 0.20, "Communication Services": 0.15,
    "Health Care": 0.10, Healthcare: 0.10, Financials: 0.08,
    Industrials: 0.05, Energy: 0.04, Materials: 0.02,
    "Consumer Staples": 0.01,
  },
};

const HOLDING_COUNT: Record<TimeHorizon, number> = {
  short: 8,
  medium: 11,
  long: 15,
};

function sectorRole(sector: string): SectorBreakdown["role"] {
  const defensive = ["Consumer Staples", "Utilities", "Health Care", "Healthcare"];
  const income = ["Real Estate", "Utilities", "Financials"];
  const growth = ["Information Technology", "Technology", "Communication Services", "Consumer Discretionary"];
  if (growth.includes(sector)) return "Growth";
  if (defensive.includes(sector)) return "Defensive";
  if (income.includes(sector)) return "Income";
  return "Balanced";
}

function sectorRationale(sector: string, risk: RiskTolerance, pct: number): string {
  const heavy = pct >= 15;
  const meaningful = pct >= 8;
  const rationales: Record<RiskTolerance, Record<string, string>> = {
    conservative: {
      "Consumer Staples": "Defensive backbone — earnings stay stable through recessions. Companies sell what people buy regardless of economic conditions (food, household goods).",
      "Health Care": "Resilient demand — healthcare spending grows regardless of the economic cycle. Aging demographics provide a long-term tailwind.",
      Healthcare: "Resilient demand — healthcare spending grows regardless of the economic cycle. Aging demographics provide a long-term tailwind.",
      Utilities: "Steady dividends and regulated cash flows — among the most predictable earnings in the market.",
      Financials: "Banks and insurers benefit from steady interest income; provides ballast without excessive growth risk.",
      "Information Technology": "Limited tech exposure for a conservative portfolio — measured growth without high volatility.",
      Technology: "Limited tech exposure for a conservative portfolio — measured growth without high volatility.",
    },
    moderate: {
      "Information Technology": "Largest weight — tech drives long-term S&P 500 returns. Balanced exposure to platform giants and software leaders.",
      Technology: "Largest weight — tech drives long-term S&P 500 returns. Balanced exposure to platform giants and software leaders.",
      "Health Care": "Strong secular growth from demographics, plus defensive properties when markets turn.",
      Healthcare: "Strong secular growth from demographics, plus defensive properties when markets turn.",
      Financials: "Cyclical kicker — banks outperform during economic expansions, providing upside without speculation.",
      "Consumer Discretionary": "Captures upside from consumer spending — tilts portfolio toward growth without committing fully.",
      "Communication Services": "Mix of platform monopolies and content giants — secular growth with defensive cash flows.",
    },
    aggressive: {
      "Information Technology": "Highest weight — tech delivers the strongest long-term compound returns. AI, cloud, and platforms remain in early innings.",
      Technology: "Highest weight — tech delivers the strongest long-term compound returns. AI, cloud, and platforms remain in early innings.",
      "Consumer Discretionary": "Maximum exposure to consumer spending growth — captures bull markets and economic expansion most aggressively.",
      "Communication Services": "Platform giants and content leaders capturing digital ad dollars and streaming subscribers.",
      "Health Care": "Even an aggressive portfolio benefits from healthcare's secular tailwinds.",
      Healthcare: "Even an aggressive portfolio benefits from healthcare's secular tailwinds.",
    },
  };
  const specific = rationales[risk][sector];
  if (specific) return specific;
  const role = sectorRole(sector);
  if (role === "Defensive") return heavy ? "Defensive sector — stability and downside protection." : "Small defensive position to balance higher-risk exposures.";
  if (role === "Growth") return heavy ? "Growth-oriented sector — aims for above-market capital appreciation." : meaningful ? "Moderate growth exposure to participate in market upside." : "Limited growth exposure aligned with risk profile.";
  if (role === "Income") return "Provides dividend income and reduces overall portfolio volatility.";
  return "Balanced exposure to broad economic activity.";
}

function buildStrategy(risk: RiskTolerance, horizon: TimeHorizon, holdingCount: number): string {
  const horizonText = horizon === "short" ? "3–5 year" : horizon === "medium" ? "5–10 year" : "10+ year";
  const riskText = risk === "conservative" ? "capital preservation with steady, lower-risk growth"
    : risk === "moderate" ? "balanced growth combining stable earners with growth leaders"
    : "maximum long-term capital appreciation through high-growth sectors";
  return `This ${holdingCount}-stock portfolio is built for ${horizonText} ${riskText}. The AI selected the highest-ranked stock from each priority sector, then weighted holdings by both sector importance and individual AI score — giving stronger conviction picks larger positions. Rebalancing every 6–12 months is recommended to maintain target allocations.`;
}

function expectedReturnEstimate(risk: RiskTolerance, avgScore: number, maxScore: number): number {
  const baseline = risk === "conservative" ? 7 : risk === "moderate" ? 9 : 12;
  // ✦ Use dynamic max instead of hardcoded 10000
  const scoreBoost = (avgScore / Math.max(maxScore, 1)) * 3;
  return Math.round((baseline + scoreBoost) * 10) / 10;
}

function riskNarrative(risk: RiskTolerance, horizon: TimeHorizon): string {
  if (risk === "conservative") return "Lower expected drawdowns (typically −10% to −15% in market corrections). Suitable if you'd lose sleep over a 25%+ paper loss.";
  if (risk === "moderate") return "Moderate drawdowns expected (−15% to −25% in corrections). Balanced for investors comfortable with normal market volatility.";
  return `Significant drawdowns possible (−30%+ in bear markets), but historically the highest long-term returns. Best suited for ${horizon === "long" ? "long-term" : "patient"} investors who won't panic-sell.`;
}

function diversificationScore(sectorBreakdown: SectorBreakdown[], holdings: Holding[]): number {
  const sectorCount = sectorBreakdown.length;
  const topSectorPct = sectorBreakdown[0]?.pct ?? 0;
  const concentrationPenalty = Math.max(0, topSectorPct - 35) * 1.5;
  const sectorScore = Math.min(sectorCount * 8, 50);
  const holdingScore = Math.min(holdings.length * 3, 35);
  return Math.max(0, Math.min(100, Math.round(sectorScore + holdingScore + 15 - concentrationPenalty)));
}

function buildHoldingReasoning(stock: { rank: number; score: number; sector: string; ticker: string }, risk: RiskTolerance): string {
  const parts: string[] = [];
  if (stock.rank <= 5) parts.push(`Top-5 ranked (#${stock.rank})`);
  else if (stock.rank <= 25) parts.push(`Top-25 ranked (#${stock.rank})`);
  else if (stock.rank <= 100) parts.push(`Top-quartile rank (#${stock.rank})`);

  // ✦ Score description without 10k assumption
  if (stock.score >= 9000) parts.push("exceptional AI signal");
  else if (stock.score >= 7500) parts.push("strong AI signal");
  else if (stock.score >= 5500) parts.push("solid AI signal");

  if (risk === "conservative") parts.push(`stable ${stock.sector}`);
  else if (risk === "aggressive") parts.push(`growth-oriented ${stock.sector}`);
  else parts.push(`balanced ${stock.sector} pick`);
  return parts.join(" · ");
}

export async function generatePortfolio({
  riskTolerance, timeHorizon, investmentAmount,
}: {
  riskTolerance: RiskTolerance; timeHorizon: TimeHorizon; investmentAmount: number;
}): Promise<Portfolio | null> {
  if (!investmentAmount || investmentAmount <= 0) return null;
  const supabase = await createClient();

  // ✦ Fetch max score for dynamic normalization
  const { data: maxRow } = await supabase
    .from("stock_rankings")
    .select("score")
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxScore = Math.max(Number(maxRow?.score) || 10000, 1);

  const { data: stocksData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score, price")
    .order("rank", { ascending: true })
    .limit(200);

  if (!stocksData || stocksData.length === 0) return null;

  const targetCount = HOLDING_COUNT[timeHorizon];
  const sectorWeights = SECTOR_WEIGHTS[riskTolerance];
  const sortedSectors = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1]);

  const picked: Map<string, { ticker: string; company: string; sector: string; rank: number; score: number; price: number; sectorWeight: number }> = new Map();
  const seenSectors = new Set<string>();

  for (const [sectorName, weight] of sortedSectors) {
    if (picked.size >= targetCount) break;
    if (seenSectors.has(sectorName)) continue;
    const candidate = stocksData.find((s) => s.sector === sectorName && s.ticker && !picked.has(s.ticker as string) && Number.isFinite(Number(s.price)) && Number(s.price) > 0);
    if (candidate) {
      picked.set(candidate.ticker as string, {
        ticker: candidate.ticker as string, company: (candidate.company as string) ?? candidate.ticker,
        sector: candidate.sector as string, rank: Number(candidate.rank) || 999,
        score: Number(candidate.score) || 0, price: Number(candidate.price), sectorWeight: weight,
      });
      seenSectors.add(sectorName);
    }
  }

  if (picked.size < targetCount) {
    for (const [sectorName, weight] of sortedSectors) {
      if (picked.size >= targetCount) break;
      const sectorPicks = stocksData.filter((s) => s.sector === sectorName && s.ticker && !picked.has(s.ticker as string) && Number.isFinite(Number(s.price)) && Number(s.price) > 0);
      const second = sectorPicks[0];
      if (second) {
        picked.set(second.ticker as string, {
          ticker: second.ticker as string, company: (second.company as string) ?? second.ticker,
          sector: second.sector as string, rank: Number(second.rank) || 999,
          score: Number(second.score) || 0, price: Number(second.price), sectorWeight: weight * 0.6,
        });
      }
    }
  }

  if (picked.size < targetCount) {
    for (const s of stocksData) {
      if (picked.size >= targetCount) break;
      if (s.ticker && !picked.has(s.ticker as string) && Number.isFinite(Number(s.price)) && Number(s.price) > 0) {
        picked.set(s.ticker as string, {
          ticker: s.ticker as string, company: (s.company as string) ?? s.ticker,
          sector: (s.sector as string) ?? "—", rank: Number(s.rank) || 999,
          score: Number(s.score) || 0, price: Number(s.price), sectorWeight: 0.05,
        });
      }
    }
  }

  const candidates = Array.from(picked.values());
  // ✦ Score factor uses dynamic max
  const rawWeights = candidates.map((c) => {
    const scoreFactor = 0.5 + (c.score / maxScore) * 0.5;
    return c.sectorWeight * scoreFactor;
  });
  const totalRaw = rawWeights.reduce((sum, w) => sum + w, 0);

  const holdings: Holding[] = candidates.map((c, i) => {
    const allocationPct = (rawWeights[i] / totalRaw) * 100;
    const allocationDollars = (allocationPct / 100) * investmentAmount;
    const shares = allocationDollars / c.price;
    return {
      ticker: c.ticker, company: c.company, sector: c.sector, rank: c.rank,
      score: c.score, price: c.price,
      allocationPct: Math.round(allocationPct * 10) / 10,
      allocationDollars: Math.round(allocationDollars),
      shares: Math.round(shares * 100) / 100,
      reasoning: buildHoldingReasoning(c, riskTolerance),
    };
  });
  holdings.sort((a, b) => b.allocationPct - a.allocationPct);

  const sectorMap: Record<string, number> = {};
  holdings.forEach((h) => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.allocationPct; });
  const sectorBreakdown: SectorBreakdown[] = Object.entries(sectorMap)
    .map(([sector, pct]) => ({ sector, pct: Math.round(pct * 10) / 10, rationale: sectorRationale(sector, riskTolerance, pct), role: sectorRole(sector) }))
    .sort((a, b) => b.pct - a.pct);

  const avgScore = Math.round(holdings.reduce((sum, h) => sum + h.score, 0) / holdings.length);

  return {
    holdings, sectorBreakdown, avgScore, totalInvested: investmentAmount,
    riskTolerance, timeHorizon,
    strategy: buildStrategy(riskTolerance, timeHorizon, holdings.length),
    expectedAnnualReturn: expectedReturnEstimate(riskTolerance, avgScore, maxScore),
    riskAssessment: riskNarrative(riskTolerance, timeHorizon),
    diversificationScore: diversificationScore(sectorBreakdown, holdings),
  };
}
