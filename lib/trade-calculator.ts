export type TradeOrderInput = {
  value?: number | string | null;
  price?: number | string | null;
  shares?: number | string | null;
};

export type ResolvedTradeOrder = {
  value: number | null;
  price: number | null;
  shares: number | null;
  entered: number;
  error: string | null;
};

const MONEY_DECIMALS = 100;
const SHARE_DECIMALS = 1_000_000;

export function roundTradeMoney(value: number) {
  return Math.round(value * MONEY_DECIMALS) / MONEY_DECIMALS;
}

export function roundTradeShares(value: number) {
  return Math.round(value * SHARE_DECIMALS) / SHARE_DECIMALS;
}

function positiveNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveTradeOrder(input: TradeOrderInput): ResolvedTradeOrder {
  const value = positiveNumber(input.value);
  const price = positiveNumber(input.price);
  const shares = positiveNumber(input.shares);
  const entered = [value, price, shares].filter((item) => item !== null).length;

  if (entered < 2) {
    return {
      value,
      price,
      shares,
      entered,
      error: "Enter any two of value, price and shares.",
    };
  }

  if (value !== null && price !== null && shares !== null) {
    const expectedValue = price * shares;
    const tolerance = Math.max(0.02, Math.abs(value) * 0.01);
    if (Math.abs(value - expectedValue) > tolerance) {
      return {
        value,
        price,
        shares,
        entered,
        error: "Value, price and shares do not match.",
      };
    }

    return {
      value: roundTradeMoney(value),
      price,
      shares: roundTradeShares(shares),
      entered,
      error: null,
    };
  }

  if (value !== null && price !== null) {
    return {
      value: roundTradeMoney(value),
      price,
      shares: roundTradeShares(value / price),
      entered,
      error: null,
    };
  }

  if (value !== null && shares !== null) {
    return {
      value: roundTradeMoney(value),
      price: value / shares,
      shares: roundTradeShares(shares),
      entered,
      error: null,
    };
  }

  if (price !== null && shares !== null) {
    return {
      value: roundTradeMoney(price * shares),
      price,
      shares: roundTradeShares(shares),
      entered,
      error: null,
    };
  }

  return {
    value,
    price,
    shares,
    entered,
    error: "Enter valid positive numbers.",
  };
}
