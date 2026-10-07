import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { portfolioConstructionPolicy } from "@/lib/portfolio-construction-policy";

export type OverviewAllocation = {
  key: string;
  label: string;
  kind: "holding" | "cash" | "other";
  value: number;
  percentage: number;
  displayPercentage: number;
  holding: ExtendedHolding | null;
};

export type OverviewReview = {
  key: string;
  holding: ExtendedHolding;
  title: string;
  detail: string;
  priority: number;
};

function hasPrice(holding: ExtendedHolding) {
  return Number.isFinite(holding.currentPrice) && holding.currentPrice > 0;
}

function positiveValue(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

// Rounded labels add to 100.0%; bar widths retain their actual proportions.
function roundAllocationLabels(rows: OverviewAllocation[]) {
  const units = rows.map((row) => Math.floor(row.percentage * 10));
  const remainder = 1000 - units.reduce((sum, value) => sum + value, 0);
  const order = rows.map((row, index) => ({ index, fraction: row.percentage * 10 - units[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index++) units[order[index % order.length].index] += 1;
  return rows.map((row, index) => ({ ...row, displayPercentage: units[index] / 10 }));
}

export function buildPortfolioOverviewSnapshot({
  holdings,
  cashBalance,
  riskTolerance,
}: {
  holdings: ExtendedHolding[];
  cashBalance: number;
  riskTolerance: string | null;
}) {
  const policy = portfolioConstructionPolicy(riskTolerance);
  const active = holdings.filter((holding) => Number.isFinite(holding.shares) && holding.shares > 0);
  const missingPriceCount = active.filter((holding) => !hasPrice(holding)).length;
  const missingValueCount = active.filter((holding) => !Number.isFinite(holding.currentValue) || holding.currentValue < 0).length;
  const cashValid = Number.isFinite(cashBalance) && cashBalance >= 0;
  const valuesValid = missingValueCount === 0 && cashValid;
  const priced = active.filter((holding) => hasPrice(holding) && Number.isFinite(holding.currentValue) && holding.currentValue >= 0);
  const holdingsValue = priced.reduce((sum, holding) => sum + holding.currentValue, 0);
  const cashValue = positiveValue(cashBalance);
  const totalValue = holdingsValue + cashValue;
  const allocationAvailable = valuesValid && Number.isFinite(totalValue) && totalValue > 0;
  const percentage = (value: number) => Number.isFinite(totalValue) && totalValue > 0 ? value / totalValue * 100 : 0;
  const sorted = priced.slice().sort((a, b) => b.currentValue - a.currentValue);
  const sectors = new Map<string, { value: number; holdings: ExtendedHolding[] }>();
  for (const holding of sorted) {
    const sector = holding.sector?.trim() || "Unknown";
    const entry = sectors.get(sector) ?? { value: 0, holdings: [] };
    entry.value += positiveValue(holding.currentValue);
    entry.holdings.push(holding);
    sectors.set(sector, entry);
  }

  let allocations: OverviewAllocation[] = [];
  if (allocationAvailable) {
    const top = sorted.filter((holding) => positiveValue(holding.currentValue) > 0).slice(0, 4);
    allocations = top.map((holding) => ({
      key: `holding-${holding.ticker}`, label: holding.ticker, kind: "holding", holding,
      value: holding.currentValue, percentage: percentage(holding.currentValue), displayPercentage: 0,
    }));
    const otherValue = Math.max(0, holdingsValue - top.reduce((sum, holding) => sum + holding.currentValue, 0));
    if (otherValue > 0) allocations.push({
      key: "other", label: "Other holdings", kind: "other", holding: null,
      value: otherValue, percentage: percentage(otherValue), displayPercentage: 0,
    });
    allocations.push({ key: "cash", label: "Cash", kind: "cash", holding: null,
      value: cashValue, percentage: percentage(cashValue), displayPercentage: 0 });
    allocations = roundAllocationLabels(allocations);
  }

  const contributors = priced.filter((holding) => Number.isFinite(holding.totalPnLDollars));
  const gainContributor = contributors.filter((holding) => holding.totalPnLDollars > 0)
    .sort((a, b) => b.totalPnLDollars - a.totalPnLDollars)[0] ?? null;
  const lossContributor = contributors.filter((holding) => holding.totalPnLDollars < 0)
    .sort((a, b) => a.totalPnLDollars - b.totalPnLDollars)[0] ?? null;

  const reviews: OverviewReview[] = [];
  for (const holding of active) {
    const reasons: Omit<OverviewReview, "key" | "holding">[] = [];
    const share = hasPrice(holding) ? percentage(positiveValue(holding.currentValue)) : 0;
    if (!hasPrice(holding)) reasons.push({ title: "Price unavailable", detail: "Current value and unrealised return cannot be confirmed.", priority: 100 });
    if (!Number.isFinite(holding.currentValue) || holding.currentValue < 0) reasons.push({ title: "Valuation unavailable", detail: "This holding has no usable current valuation.", priority: 100 });
    const action = holding.actionAlerts.slice().sort((a, b) => b.priority - a.priority)[0];
    if (action) reasons.push({ title: "Model review alert", detail: action.title, priority: 90 });
    if (allocationAvailable && holding.targetAllocationPct != null && holding.targetAllocationPct > 0 && share - holding.targetAllocationPct > 3) {
      reasons.push({ title: "Above your target", detail: `${share.toFixed(1)}% allocation versus your ${holding.targetAllocationPct.toFixed(1)}% target.`, priority: 80 });
    }
    if (allocationAvailable && share > policy.concentrationReviewPct) reasons.push({
      title: "Position concentration", detail: `${share.toFixed(1)}% of ${missingPriceCount ? "available valuation" : "portfolio value"}; ${policy.concentrationReviewPct}% is the ${policy.riskProfile} profile review threshold.`, priority: 75,
    });
    const sectorName = holding.sector?.trim() || "Unknown";
    const sector = sectors.get(sectorName);
    if (allocationAvailable && sectorName !== "Unknown" && sector?.holdings[0] === holding && percentage(sector.value) > policy.sectorCapPct) reasons.push({
      title: "Sector concentration", detail: `${sectorName} represents ${percentage(sector.value).toFixed(1)}% of ${missingPriceCount ? "available valuation" : "portfolio value"}; the profile review threshold is ${policy.sectorCapPct}%.`, priority: 70,
    });
    const event = holding.eventAlerts.slice().sort((a, b) => b.priority - a.priority)[0];
    if (event) reasons.push({ title: "Event to review", detail: event.title, priority: 60 });
    if (Number.isFinite(holding.daysSinceReview) && holding.daysSinceReview > 30) reasons.push({ title: "Review overdue", detail: `${Math.floor(holding.daysSinceReview)} days since this holding was reviewed.`, priority: 50 });
    if (sectorName === "Unknown") reasons.push({ title: "Sector unclassified", detail: "Sector exposure cannot be fully classified for this position.", priority: 30 });
    const reason = reasons.sort((a, b) => b.priority - a.priority)[0];
    if (reason) reviews.push({ key: holding.ticker, holding, ...reason });
  }
  reviews.sort((a, b) => b.priority - a.priority || positiveValue(b.holding.currentValue) - positiveValue(a.holding.currentValue) || a.key.localeCompare(b.key));

  return {
    holdingsValue, cashValue, totalValue, cashPercentage: percentage(cashValue),
    allocationAvailable, valuationComplete: valuesValid && missingPriceCount === 0 && Number.isFinite(totalValue), cashValid,
    missingPriceCount, missingValueCount, holdingsCount: active.length, pricedHoldingsCount: priced.length, sectorCount: sectors.size,
    unknownSectorCount: sectors.get("Unknown")?.holdings.length ?? 0,
    allocations, gainContributor, lossContributor, reviews,
  };
}
