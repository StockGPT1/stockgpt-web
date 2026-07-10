import assert from "node:assert/strict";

const minRealPoints = {
  "1D": 6,
  "1M": 4,
  "6M": 8,
  "1Y": 8,
  MAX: 4,
};

function realPoints(points = []) {
  return points.filter((point) => !point.synthetic);
}

function filterDisplayable(chartData) {
  return Object.fromEntries(
    Object.entries(chartData)
      .map(([range, points]) => [range, realPoints(points)])
      .filter(([range, points]) => points.length >= (minRealPoints[range] ?? 4)),
  );
}

function weightedAverage({ existingShares, existingPrice, incomingShares, incomingPrice, incomingCost }) {
  const shares = Math.round((existingShares + incomingShares) * 1_000_000) / 1_000_000;
  const cost = existingShares * existingPrice + (incomingCost ?? incomingShares * incomingPrice);
  return {
    shares,
    entryPrice: Math.round((cost / shares) * 10_000) / 10_000,
  };
}

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveTradeCalculator(valueInput, priceInput, sharesInput) {
  const value = positive(valueInput);
  const price = positive(priceInput);
  const shares = positive(sharesInput);
  const entered = [value, price, shares].filter((item) => item !== null).length;
  if (entered < 2) return { error: "Enter any two", value, price, shares };
  if (value !== null && price !== null && shares !== null) {
    const tolerance = Math.max(0.02, Math.abs(value) * 0.01);
    return Math.abs(value - price * shares) > tolerance
      ? { error: "Mismatch", value, price, shares }
      : { error: null, value, price, shares };
  }
  if (value !== null && price !== null) return { error: null, value, price, shares: value / price };
  if (value !== null && shares !== null) return { error: null, value, price: value / shares, shares };
  if (price !== null && shares !== null) return { error: null, value: price * shares, price, shares };
  return { error: "Invalid", value, price, shares };
}

const now = Date.now();
const realSix = Array.from({ length: 6 }, (_, index) => ({
  date: new Date(now - (5 - index) * 60_000).toISOString(),
  close: 100 + index,
}));

assert.deepEqual(filterDisplayable({ "1D": [{ ...realSix[0], synthetic: true }, realSix.at(-1)] }), {});
assert.equal(filterDisplayable({ "1D": realSix })["1D"].length, 6);
assert.deepEqual(filterDisplayable({ "1M": realSix.slice(0, 3) }), {});
assert.equal(filterDisplayable({ "1M": realSix.slice(0, 4) })["1M"].length, 4);

assert.deepEqual(
  weightedAverage({
    existingShares: 10,
    existingPrice: 100,
    incomingShares: 5,
    incomingPrice: 130,
  }),
  { shares: 15, entryPrice: 110 },
);

assert.deepEqual(
  weightedAverage({
    existingShares: 1.25,
    existingPrice: 88,
    incomingShares: 0.75,
    incomingPrice: 120,
    incomingCost: 90,
  }),
  { shares: 2, entryPrice: 100 },
);

assert.deepEqual(resolveTradeCalculator("900", "90", ""), {
  error: null,
  value: 900,
  price: 90,
  shares: 10,
});
assert.deepEqual(resolveTradeCalculator("", "45", "4"), {
  error: null,
  value: 180,
  price: 45,
  shares: 4,
});
assert.equal(resolveTradeCalculator("100", "45", "4").error, "Mismatch");

const executableTrimLabel = "Trim holding: 15%";
const executableTrimButton = "Trim to cash";
assert.match(executableTrimLabel, /^Trim holding:/);
assert.equal(executableTrimButton, "Trim to cash");

console.log("portfolio reliability checks passed");
