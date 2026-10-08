import assert from "node:assert/strict";
import test from "node:test";
import { calibratePriceAxis, priceToY, normalisePriceAxis, buildTradeScenario } from "../lib/chart-scan-scenario.ts";
const axis = (scale, points) => normalisePriceAxis({ scale, ticks: points.map(([price, y_pct]) => ({ price, y_pct })) });

test("linear and inverted price scales map exact prices to the same tick centres", () => {
  for (const points of [[[80, 70], [100, 50], [120, 30]], [[80, 30], [100, 50], [120, 70]]]) {
    const ticks = axis("linear", points), calibration = calibratePriceAxis(ticks, ticks);
    assert.ok(calibration);
    for (const [price, y] of points) assert.equal(priceToY(price, calibration, 20, 60), y);
    assert.equal(priceToY(1000, calibration, 20, 60), null);
  }
});
test("log scales interpolate multiplicative prices rather than linear price differences", () => {
  const ticks = axis("log", [[10, 80], [100, 50], [1000, 20]]);
  const calibration = calibratePriceAxis(ticks, ticks);
  assert.equal(calibration.scale, "log");
  assert.ok(Math.abs(priceToY(Math.sqrt(100 * 1000), calibration, 0, 100) - 35) < 1e-9);
});
test("exit prices exactly at fractional plot edges survive fitting roundoff", () => {
  const top = 1.1, height = 42.7, bottom = top + height;
  for (const [scale, prices] of [["linear", [110, 100, 90]], ["log", [1000, 100, 10]]]) {
    for (const inverted of [false, true]) {
      const rows = inverted ? [bottom, top + height / 2, top] : [top, top + height / 2, bottom];
      const ticks = axis(scale, prices.map((price, index) => [price, rows[index]]));
      const calibration = calibratePriceAxis(ticks, ticks);
      assert.ok(calibration);
      assert.ok(Math.abs(priceToY(prices[0], calibration, top, height) - rows[0]) < 1e-9);
      assert.ok(Math.abs(priceToY(prices[2], calibration, top, height) - rows[2]) < 1e-9);
      for (const y of [top - 0.000001, bottom + 0.000001]) {
        const value = (y - calibration.intercept) / calibration.slope;
        const offChartPrice = scale === "log" ? Math.exp(value) : value;
        assert.equal(priceToY(offChartPrice, calibration, top, height), null);
      }
    }
  }
});
test("inconsistent labels, unknown geometry and nonlinear linear axes fail calibration", () => {
  const ticks = axis("linear", [[80, 70], [100, 50], [120, 30]]);
  assert.equal(calibratePriceAxis(ticks, axis("log", [[80, 70], [100, 50], [120, 30]])), null);
  assert.equal(calibratePriceAxis(ticks, axis("linear", [[80, 70], [100, 52], [120, 30]])), null);
  assert.equal(calibratePriceAxis(axis("linear", [[80, 70], [100, 55], [120, 30]]), axis("linear", [[80, 70], [100, 55], [120, 30]])), null);
  assert.deepEqual(normalisePriceAxis({ ticks: [{ price: "100–110", y_pct: 50 }, { price: 100, y_pct: "50" }] }).ticks, []);
});
test("tiny prices and tight stops preserve ordering after display rounding", () => {
  for (const entry of [0.00000123, 100.001]) {
    const p = buildTradeScenario({ verdict: "bullish", trade_plan: { price_scale_readable: true, entry, stop_loss: entry * 0.999999, take_profit: entry * 1.000002 } }, { usable: true, reviewed: true, signals: [{ bias: "bullish", confidence: 70 }], patterns: [] });
    assert.ok(p.stop_value < p.entry_value && p.entry_value < p.target_value);
    assert.ok(Number.isFinite(p.stop_pct));
    assert.ok(!p.risk_reward.includes("NaN"));
  }
});
test("short fallbacks preserve ordering and never generate nonpositive prices", () => {
  const p = buildTradeScenario({ verdict: "bearish", current_price: "100" }, { usable: true, reviewed: true, signals: [{ bias: "bearish", confidence: 70 }], patterns: [] });
  assert.equal(p.entry_value, 100); assert.equal(p.stop_value, 102); assert.equal(p.target_value, 96);
  assert.equal(p.risk_reward, "2.0:1"); assert.equal(p.levels_basis, "estimated");
});
