import { roundTradeShares, type TradeOrderInput } from "@/lib/trade-calculator";

// Select only execution facts or an available market quote; acquisition cost is
// deliberately absent from this interface. SQL remains accounting authority.
export function portfolioSaleOrderInput(
  input: TradeOrderInput & { percentage?: number | null },
  currentShares: number,
  currentMarketPrice: unknown,
): TradeOrderInput {
  const price = Number(currentMarketPrice);
  const quote = Number.isFinite(price) && price > 0 ? price : null;
  if (input.value != null || input.price != null || input.shares != null) {
    return {
      value: input.value, shares: input.shares,
      price: input.price ?? (input.value != null && input.shares != null ? null : quote),
    };
  }
  const percentage = Number(input.percentage);
  return Number.isFinite(percentage) && percentage > 0 && percentage <= 100
    ? { price: quote, shares: percentage === 100 ? currentShares : roundTradeShares(currentShares * percentage / 100) }
    : {};
}
