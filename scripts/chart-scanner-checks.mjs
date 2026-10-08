import assert from "node:assert/strict";
import test from "node:test";
import {
  normaliseScanBox, normaliseChartLayout, normaliseChartScan, parseScanJson,
  priceNumber, runGroundedChartScan,
  isChartAnalysis,
} from "../lib/chart-scanner.ts";

const plot = { x_pct: 5, y_pct: 18, width_pct: 85, height_pct: 42 };
const candleBox = { x_pct: 61, y_pct: 28, width_pct: 8, height_pct: 16 };
const rsiPanel = { x_pct: 5, y_pct: 65, width_pct: 85, height_pct: 14 };
const axis = { scale: "linear", ticks: [{ price: 110, y_pct: 25 }, { price: 100, y_pct: 43 }, { price: 95, y_pct: 52 }] };
const rawLayout = {
  price_axis: axis,
  price_series_type: "candles", price_plot_box: plot,
  indicators: [{ name: "RSI", placement: "panel", source_image: 0, readable: true, box: rsiPanel }],
  exclusions: [{ x_pct: 5, y_pct: 18, width_pct: 18, height_pct: 3 }],
};
const layout = normaliseChartLayout(rawLayout, 1);
const priceSignal = {
  name: "Bullish engulfing at swing support", kind: "candle", bias: "bullish", confidence: 72,
  evidence: "The latest green body engulfs the preceding red body near the recent swing low.",
  region_id: "price", source_image: 0, supported: true,
  localisation_confirmed: true, localisation_confidence: 92, box: candleBox,
};
const indicatorSignal = {
  name: "RSI recovers above 50", kind: "indicator", bias: "bullish", confidence: 70,
  evidence: "The labelled RSI line crosses its midline in the lower panel.",
  region_id: "indicator-1", source_image: 0, supported: true,
  localisation_confirmed: true, localisation_confidence: 91,
  box: { x_pct: 65, y_pct: 67, width_pct: 15, height_pct: 8 },
};
const scan = {
  verdict: "bullish", confidence: 65, label: "Support reclaim", pattern: "Base and reclaim",
  summary: "Price holds the swing low and RSI recovers.",
  price_series_type: "candles", chart_coverage: "full", current_price: "$100", timeframe: "1h",
  signals: [priceSignal, indicatorSignal],
  indicator_checks: [{ id: "indicator-1", name: "RSI", status: "readable", finding: "RSI rises through 50." }],
  overlay: { price_axis_confirmed: true, price_axis: axis, price_plot_confirmed: true, price_plot_box: plot, levels_confirmed: true, support_y_pct: 52, resistance_y_pct: 25 },
  levels: { support: "95", resistance: "110" },
  trade_plan: { price_scale_readable: true, entry: "100", stop_loss: "95", take_profit: "110", projected_bars: "6–12 bars", projected_horizon: "6–12 hours" },
};
const read = (changes = {}, mapped = layout, reviewed = true, candidate = scan) => normaliseChartScan({ ...scan, ...changes }, mapped, reviewed, null, undefined, candidate);

test("null, strings, booleans, NaN and off-image coordinates never become rectangles", () => {
  for (const value of [null, undefined, "8", false, NaN, -1, 101]) {
    assert.equal(normaliseScanBox({ ...candleBox, x_pct: value }), null);
  }
  assert.equal(normaliseScanBox({ x_pct: 99, y_pct: 99, width_pct: 6, height_pct: 6 }), null);
  assert.equal(normaliseScanBox({ ...candleBox, height_pct: 0 }), null);
});

test("valid fractional coordinates retain precision", () => {
  const box = { x_pct: 61.33, y_pct: 28.7, width_pct: 0.8, height_pct: 4.5 };
  assert.deepEqual(normaliseScanBox(box), box);
});

test("a verified candle and separate RSI panel both get correct highlights", () => {
  const result = read();
  assert.equal(result.signals.length, 2);
  assert.deepEqual(result.signals[0].box, candleBox);
  assert.deepEqual(result.signals[1].box, indicatorSignal.box);
  assert.equal(result.indicator_checks[0].status, "readable");
});

test("a candle box on the chart legend is withheld while its text read survives", () => {
  const result = read({ signals: [{ ...priceSignal, box: { x_pct: 7, y_pct: 18, width_pct: 10, height_pct: 2 } }] });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].box, null);
});

test("a toolbar or title outside the price pane is never highlighted as candles", () => {
  assert.equal(read({ signals: [{ ...priceSignal, box: { x_pct: 5, y_pct: 4, width_pct: 25, height_pct: 8 } }] }).signals[0].box, null);
});

test("volume and indicator panes cannot receive price/candle highlights", () => {
  assert.equal(read({ signals: [{ ...priceSignal, box: indicatorSignal.box }] }).signals[0].box, null);
  assert.equal(read({ signals: [{ ...indicatorSignal, box: candleBox }] }).signals[0].box, null);
});

test("candlestick claims are dropped on a price-line chart", () => {
  const mapped = { ...layout, price_series_type: "price_line" };
  const result = read({ price_series_type: "price_line" }, mapped);
  assert.equal(result.signals.some(signal => signal.kind === "candle"), false);
  assert.equal(result.signals.some(signal => signal.kind === "indicator"), true);
});

test("a useful signal can have no geometry without losing the analysis", () => {
  const result = read({ signals: [{ ...priceSignal, box: null }] });
  assert.equal(result.signals.length, 1);
  assert.equal(result.verdict, "bullish");
  assert.equal(result.signals[0].box, null);
});

test("signal confidence alone cannot authorize a highlight", () => {
  assert.equal(read({ signals: [{ ...priceSignal, confidence: 99, localisation_confidence: 70 }] }).signals[0].box, null);
  assert.equal(read({ signals: [{ ...priceSignal, localisation_confirmed: false }] }).signals[0].box, null);
});

test("price bounds need independent agreement, not just containment", () => {
  const result = read({ overlay: { ...scan.overlay, price_plot_box: { x_pct: 0, y_pct: 0, width_pct: 100, height_pct: 100 } } });
  assert.equal(result.overlay.price_plot_box, null);
  assert.equal(result.signals[0].box, null);
});

test("overlapping independently mapped plots use their shared bounds", () => {
  const checked = { x_pct: 6, y_pct: 19, width_pct: 83, height_pct: 40 };
  assert.deepEqual(read({ overlay: { ...scan.overlay, price_plot_box: checked } }).overlay.price_plot_box, checked);
});

test("indicator text cannot claim a nonexistent region or an unreadable indicator", () => {
  assert.equal(read({ signals: [{ ...indicatorSignal, region_id: "made-up" }] }).signals.length, 0);
  const result = read({ indicator_checks: [{ id: "indicator-1", status: "unreadable" }] });
  assert.equal(result.signals.some(signal => signal.kind === "indicator"), false);
  assert.equal(result.indicator_checks[0].finding, null);
});

test("missing indicator reviews are exposed rather than silently confirmed", () => {
  assert.equal(read({ indicator_checks: [] }).indicator_checks[0].status, "not_confirmed");
  assert.equal(read({ indicator_checks: [] }).signals.length, 1);
});
test("a final readable indicator cannot bypass a missing or unreadable independent check", () => {
  for (const indicator_checks of [[], [{ id: "indicator-1", status: "unreadable" }], [{ id: "indicator-1", status: "readable", finding: "" }]]) {
    const result = read({}, layout, true, { ...scan, indicator_checks });
    assert.equal(result.indicator_checks[0].status, "not_confirmed");
    assert.equal(result.indicator_checks[0].finding, "RSI rises through 50.");
    assert.equal(result.signals.some(signal => signal.kind === "indicator"), false);
  }
  const withoutFirstRead = normaliseChartScan(scan, layout, true);
  assert.equal(withoutFirstRead.indicator_checks[0].status, "not_confirmed");
  assert.equal(withoutFirstRead.signals.some(signal => signal.kind === "indicator"), false);
});
test("indicator aliases confirm identity while findings may use different wording", () => {
  const result = read({ indicator_checks: [{ id: "indicator-1", name: "Relative Strength Index (14)", status: "readable", finding: "The oscillator has risen above its midpoint." }] }, layout, true,
    { ...scan, indicator_checks: [{ id: "indicator-1", name: "RSI_14", status: "readable", finding: "RSI is recovering through 50." }] });
  assert.equal(result.indicator_checks[0].status, "readable");
  assert.equal(result.indicator_checks[0].finding, "The oscillator has risen above its midpoint.");
  assert.equal(result.signals.some(signal => signal.kind === "indicator"), true);
});
test("neither reader can confirm an indicator without explicitly reading its label", () => {
  for (const name of [undefined, null, ""]) {
    const unnamed = { id: "indicator-1", status: "readable", finding: "The oscillator rises through its midpoint.", ...(name === undefined ? {} : { name }) };
    for (const [finalChecks, firstChecks] of [[scan.indicator_checks, [unnamed]], [[unnamed], scan.indicator_checks], [[unnamed], [unnamed]]]) {
      const result = read({ indicator_checks: finalChecks }, layout, true, { ...scan, indicator_checks: firstChecks });
      assert.equal(result.indicator_checks[0].status, "not_confirmed");
      assert.equal(result.signals.some(signal => signal.kind === "indicator"), false);
    }
  }
});
test("ambiguous shared abbreviations cannot become a named indicator through two matching guesses", () => {
  for (const label of ["RVI", "RVI(14)", "TSI", "SMI", "MA20"]) {
    const mapped = normaliseChartLayout({ ...rawLayout, indicators: [{ ...rawLayout.indicators[0], name: label }] }, 1);
    const check = { id: "indicator-1", name: label, status: "readable", finding: "Its visible line rises." };
    const result = read({ indicator_checks: [check] }, mapped, true, { ...scan, indicator_checks: [check] });
    assert.equal(result.indicator_checks[0].status, "not_confirmed");
    assert.equal(result.signals.some(signal => signal.kind === "indicator"), false);
  }
});
test("a reported wrong indicator identity or source cannot confirm an inventory region", () => {
  for (const changes of [{ name: "MACD" }, { name: "Stochastic RSI" }, { name: null }, { name: "" }, { source_image: 1 }]) {
    const wrong = { ...scan.indicator_checks[0], ...changes };
    for (const [finalChecks, firstChecks] of [[scan.indicator_checks, [wrong]], [[wrong], scan.indicator_checks]]) {
      const result = read({ indicator_checks: finalChecks }, layout, true, { ...scan, indicator_checks: firstChecks });
      assert.equal(result.indicator_checks[0].status, "not_confirmed");
      assert.equal(result.signals.some(signal => signal.kind === "indicator"), false);
    }
  }
});
test("unknown labelled tools retain an agreed literal identity without guessed catalog recognition", () => {
  const mapped = normaliseChartLayout({ ...rawLayout, indicators: [{ ...rawLayout.indicators[0], name: "Custom Flow Ribbon" }] }, 1);
  const result = read({ indicator_checks: [{ id: "indicator-1", name: "Custom Flow Ribbon", status: "readable", finding: "The labelled ribbon turns upward." }] }, mapped, true,
    { ...scan, indicator_checks: [{ id: "indicator-1", name: "custom flow ribbon", status: "readable", finding: "Its visible line is rising." }] });
  assert.equal(result.indicator_checks[0].status, "readable");
  assert.equal(result.indicator_checks[0].name, "Custom Flow Ribbon");
  const unidentified = { ...mapped, indicators: [{ ...mapped.indicators[0], name: "Unidentified indicator" }] };
  assert.equal(read({}, unidentified, true, { ...scan, indicator_checks: [{ id: "indicator-1", status: "readable", finding: "The visible line rises." }] }).indicator_checks[0].status, "not_confirmed");
});

test("a supporting photo's indicator can be discussed but never drawn over the primary", () => {
  const mapped = normaliseChartLayout({ ...rawLayout, indicators: [{ ...rawLayout.indicators[0], source_image: 1 }] }, 2);
  const result = read({ signals: [{ ...indicatorSignal, source_image: 1 }] }, mapped);
  assert.equal(result.signals[0].source_image, 1);
  assert.equal(result.signals[0].box, null);
});

test("invalid source indices and placements are removed from inventory", () => {
  for (const source_image of [-1, 0.5, null, "0", 2]) {
    assert.equal(normaliseChartLayout({ ...rawLayout, indicators: [{ ...rawLayout.indicators[0], source_image }] }, 2).indicators.length, 0);
  }
  assert.equal(normaliseChartLayout({ ...rawLayout, indicators: [{ ...rawLayout.indicators[0], placement: "toolbar" }] }, 1).indicators.length, 0);
});

test("unreviewed reads expose status, withhold geometry and reduce estimated plan confidence", () => {
  const result = read({}, layout, false);
  assert.equal(result.verification_status, "unavailable");
  assert.ok(result.signals.every(signal => signal.box === null));
  assert.equal(result.overlay.price_plot_box, null);
  assert.equal(result.trade_plan.take_profit, "110.00");
  assert.equal(result.trade_plan.status, "estimated");
  assert.ok(result.stockgpt_score.value <= 40);
  assert.equal(result.indicator_checks[0].status, "not_reviewed");
});

test("unsupported signals are removed, never chosen for their confidence", () => {
  const result = read({ signals: [{ ...priceSignal, supported: false, confidence: 99 }] });
  assert.equal(result.signals.length, 0);
  assert.equal(result.verdict, "inconclusive");
  assert.equal(result.confidence, 0);
  assert.equal(result.trade_plan.levels_basis, "illustrative");
  assert.equal(result.trade_plan.status, "unavailable");
  assert.equal(result.trade_plan.entry, null);
  assert.equal(result.trade_plan.stop_loss, null);
  assert.equal(result.trade_plan.take_profit, null);
  assert.equal(result.stockgpt_score.value, 0);
  assert.equal(result.stockgpt_score.label, "No clear setup");
  assert.deepEqual(result.overlay.trade_lines, []);
});

test("generic candlesticks/indicator labels and duplicate signals are not findings", () => {
  assert.equal(read({ signals: [{ ...priceSignal, name: "Candlesticks" }] }).signals.length, 0);
  assert.equal(read({ signals: [priceSignal, priceSignal] }).signals.length, 1);
});
test("a model's illustrative fallback cannot retain a directional trade verdict", () => {
  const result = read({ trade_plan: { ...scan.trade_plan, levels_basis: "illustrative" } });
  assert.ok(result.signals.length > 0);
  assert.equal(result.verdict, "inconclusive");
  assert.equal(result.confidence, 0);
  assert.equal(result.trade_plan.status, "unavailable");
  assert.equal(result.trade_plan.entry, null);
  assert.equal(result.stockgpt_score.label, "No clear setup");
  assert.deepEqual(result.overlay.trade_lines, []);
});

test("inconclusive and low confidence reads are never promoted", () => {
  const result = read({ verdict: "inconclusive", confidence: 15 });
  assert.equal(result.verdict, "inconclusive");
  assert.equal(result.confidence, 15);
  assert.equal(result.trade_plan.status, "conditional");
  assert.ok(result.trade_plan.stop_loss && result.trade_plan.take_profit);
  assert.ok(result.stockgpt_score.value < 50);
});

test("unknown or unsupported charts require retake and no technical highlights", () => {
  for (const price_series_type of ["unknown", "unsupported"]) {
    const result = read({ price_series_type });
    assert.equal(result.retake_required, true);
    assert.equal(result.signals.length, 0);
    assert.equal(result.overlay.price_plot_box, null);
    assert.equal(result.confidence, 0);
  }
});

test("unreadable prices do not force an unnecessary supporting photo", () => {
  const result = read({ current_price: null });
  assert.equal(result.needs_more_info, false);
  assert.equal(result.verdict, "bullish");
  assert.equal(result.trade_plan.entry_value, 100);
});

test("a full chart cannot trigger a wider-photo request", () => {
  assert.equal(read({ needs_more_info: true, more_info_prompt: "Wider chart please" }).needs_more_info, false);
  assert.equal(read({ needs_more_info: true, chart_coverage: "partial" }).needs_more_info, true);
});

test("invalid risk ordering is repaired with explicitly estimated valid levels", () => {
  for (const result of [read({ trade_plan: { ...scan.trade_plan, stop_loss: "105" } }), read({ verdict: "bearish" })]) {
    const p = result.trade_plan, d = p.side === "long" ? 1 : -1;
    assert.ok((p.entry_value - p.stop_value) * d > 0);
    assert.ok((p.target_value - p.entry_value) * d > 0);
    assert.equal(p.status, "estimated");
    assert.ok(p.assumptions);
  }
});

test("risk reward is calculated from valid levels, not copied from a model", () => {
  assert.equal(read({ trade_plan: { ...scan.trade_plan, risk_reward: "99:1" } }).trade_plan.risk_reward, "2.0:1");
  const bearish = read({ verdict: "bearish", trade_plan: { ...scan.trade_plan, stop_loss: "105", take_profit: "90" } });
  assert.equal(bearish.trade_plan.risk_reward, "2.0:1");
});

test("trade horizons are withheld when timeframe is unreadable", () => {
  const result = read({ timeframe: null });
  assert.equal(result.trade_plan.entry_value, 100);
  assert.equal(result.trade_plan.projected_horizon, null);
  assert.equal(result.trade_plan.projected_bars, null);
});

test("prices must be unambiguous numbers, not ranges, shorthand or prose", () => {
  assert.equal(priceNumber("$1,250.50"), 1250.5);
  for (const price of ["100–110", "about 100", "1.2k", "1,25", null, "0", "-1"]) assert.equal(priceNumber(price), null);
});

test("level lines need checked reactions, valid prices, and clean locations", () => {
  assert.equal(read().overlay.support_y_pct, 52);
  assert.equal(read({ overlay: { ...scan.overlay, levels_confirmed: false } }).overlay.support_y_pct, null);
  assert.equal(read({ levels: { support: "near support" } }).overlay.support_y_pct, null);
  assert.equal(read({ overlay: { ...scan.overlay, support_y_pct: 19 } }).overlay.support_y_pct, 52);
  assert.equal(read({ overlay: { ...scan.overlay, price_axis_confirmed: false } }).overlay.support_y_pct, null);
});

test("markdown JSON parses, malformed and nonobject responses fail", () => {
  assert.deepEqual(parseScanJson('```json\n{"verdict":"bullish"}\n```'), { verdict: "bullish" });
  assert.equal(parseScanJson("not JSON"), null);
  assert.equal(parseScanJson("{broken}"), null);
  assert.equal(parseScanJson("[]"), null);
});

test("valid JSON without analysis fields cannot pass as an independent review", () => {
  assert.equal(isChartAnalysis({}), false);
  assert.equal(isChartAnalysis({ error: "provider error" }), false);
  assert.equal(isChartAnalysis(null), false);
  assert.equal(isChartAnalysis(scan), true);
});

test("independent reviewer replaces a confident false candle finding", async () => {
  const calls = [];
  const output = await runGroundedChartScan({
    locate: async () => { calls.push("layout"); return { value: rawLayout, model: "mapper" }; },
    analyse: async () => { calls.push("analysis"); return { value: { ...scan, confidence: 99 }, model: "analyst" }; },
    review: async () => { calls.push("review"); return { value: { ...scan, verdict: "inconclusive", confidence: 30, signals: [indicatorSignal] }, model: "reviewer" }; },
  }, 1);
  assert.deepEqual(calls, ["layout", "analysis", "review"]);
  assert.equal(output.result.verdict, "inconclusive");
  assert.equal(output.result.signals.length, 1);
  assert.equal(output.model, "reviewer");
});

test("failed independent review returns a visibly preliminary read without drawings", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: rawLayout, model: "mapper" }),
    analyse: async () => ({ value: scan, model: "analyst" }),
    review: async () => ({ value: null, model: "reviewer" }),
  }, 1);
  assert.equal(output.result.verification_status, "unavailable");
  assert.ok(output.result.signals.every(signal => signal.box === null));
});

test("an indicator missed by the mapping pass is inventoried before review", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: { ...rawLayout, indicators: [] }, model: "mapper" }),
    analyse: async () => ({ value: { ...scan, additional_indicators: rawLayout.indicators,
      indicator_checks: [{ id: "analysis-indicator-1", name: "RSI", status: "readable", finding: "RSI rises through 50." }],
      signals: [{ ...indicatorSignal, region_id: "analysis-indicator-1" }],
    }, model: "analyst" }),
    review: async enriched => {
      assert.equal(enriched.indicators[0].id, "analysis-indicator-1");
      return { value: { ...scan,
        indicator_checks: [{ id: "analysis-indicator-1", name: "RSI", status: "readable", finding: "RSI is recovering." }],
        signals: [{ ...indicatorSignal, region_id: "analysis-indicator-1" }],
      }, model: "reviewer" };
    },
  }, 1);
  assert.equal(output.result.signals[0].kind, "indicator");
  assert.deepEqual(output.result.signals[0].box, indicatorSignal.box);
});

test("mapping failure withholds localisation without discarding a readable structure", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: null, model: "mapper" }),
    analyse: async () => ({ value: scan, model: "analyst" }),
    review: async () => ({ value: { ...scan, signals: [{ ...priceSignal, kind: "structure" }] }, model: "reviewer" }),
  }, 1);
  assert.equal(output.result.verdict, "bullish");
  assert.equal(output.result.signals[0].box, null);
});

test("analysis failure does not call review with invented empty evidence", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: rawLayout, model: "mapper" }),
    analyse: async () => ({ value: null, model: "analyst" }),
    review: async () => { throw new Error("should not run"); },
  }, 1);
  assert.equal(output, null);
});

test("price-linked lines use displayed numbers and ignore freely suggested Y positions", () => {
  const result = read({ overlay: { ...scan.overlay, support_y_pct: 40, resistance_y_pct: 50 } });
  assert.equal(result.overlay.calibration_status, "matched");
  assert.equal(result.overlay.support_y_pct, 52);
  assert.ok(Math.abs(result.overlay.resistance_y_pct - 25) < 1e-8);
  assert.deepEqual(result.overlay.trade_lines.map(line => [line.kind, Math.round(line.y_pct)]), [["entry", 43], ["stop", 52], ["target", 25]]);
  for (const line of result.overlay.trade_lines) assert.equal(priceNumber(line.price), result.trade_plan[line.kind === "entry" ? "entry_value" : line.kind === "stop" ? "stop_value" : "target_value"]);
});

test("disagreeing or sparse axis ticks produce no displaced level lines", () => {
  for (const price_axis of [{ ...axis, ticks: axis.ticks.slice(0, 2) }, { ...axis, ticks: axis.ticks.map(tick => ({ ...tick, y_pct: tick.y_pct + 2 })) }]) {
    const result = read({ overlay: { ...scan.overlay, price_axis } });
    assert.equal(result.overlay.calibration_status, "unavailable");
    assert.deepEqual(result.overlay.trade_lines, []);
    assert.equal(result.overlay.support_y_pct, null);
    assert.ok(result.trade_plan.stop_loss && result.trade_plan.take_profit);
  }
});
test("matching prices cannot draw trade lines when either reader did not confirm the axis", () => {
  for (const flag of [false, undefined]) {
    const unconfirmed = { ...scan, overlay: { ...scan.overlay, price_axis_confirmed: flag } };
    for (const [final, first] of [[unconfirmed, scan], [scan, unconfirmed]]) {
      const result = normaliseChartScan(final, layout, true, null, undefined, first);
      assert.equal(result.overlay.calibration_status, "unavailable");
      assert.deepEqual(result.overlay.trade_lines, []);
      assert.equal(result.overlay.support_y_pct, null);
      assert.equal(result.trade_plan.entry_value, 100);
    }
  }
});
test("the reviewer receives only a chart inventory, never the first thesis", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: rawLayout, model: "mapper" }),
    analyse: async () => ({ value: scan, model: "analyst" }),
    review: async (...args) => {
      assert.equal(args.length, 1);
      assert.equal(args[0].verdict, undefined);
      assert.equal(args[0].trade_plan, undefined);
      assert.equal(args[0].signals, undefined);
      return { value: scan, model: "reviewer" };
    },
  }, 1);
  assert.equal(output.result.verification_status, "reviewed");
});
test("a cancelled scan does not launch a subsequent model stage", async () => {
  for (const cancelAfter of ["before", "layout", "analysis"]) {
    const controller = new AbortController(), calls = [];
    if (cancelAfter === "before") controller.abort();
    const output = await runGroundedChartScan({
      locate: async () => {
        calls.push("layout");
        if (cancelAfter === "layout") controller.abort();
        return { value: rawLayout, model: "mapper" };
      },
      analyse: async () => {
        calls.push("analysis");
        if (cancelAfter === "analysis") controller.abort();
        return { value: scan, model: "analyst" };
      },
      review: async () => { throw new Error("A cancelled scan must not launch the reviewer"); },
    }, 1, null, controller.signal);
    assert.equal(output, null);
    assert.deepEqual(calls, cancelAfter === "before" ? [] : cancelAfter === "layout" ? ["layout"] : ["layout", "analysis"]);
  }
});

test("unreadable absolute prices retain both labelled relative risk exits", () => {
  const result = read({ current_price: null, levels: {}, trade_plan: {} });
  assert.equal(result.trade_plan.status, "relative");
  assert.equal(result.trade_plan.entry_value, null);
  assert.match(result.trade_plan.stop_loss, /2%/);
  assert.match(result.trade_plan.take_profit, /4%/);
  assert.match(result.trade_plan.assumptions, /Illustrative/);
  assert.ok(result.stockgpt_score.value <= 20);
  assert.deepEqual(result.overlay.trade_lines, []);
});

test("a user reference converts relative exits into explicitly estimated numeric levels", () => {
  const result = normaliseChartScan({ ...scan, current_price: null, trade_plan: {}, levels: {} }, layout, true, 200);
  assert.equal(result.trade_plan.price_basis, "user");
  assert.equal(result.trade_plan.entry_value, 200);
  assert.equal(result.trade_plan.stop_value, 196);
  assert.equal(result.trade_plan.target_value, 208);
  assert.equal(result.trade_plan.status, "estimated");
  assert.match(result.trade_plan.assumptions, /fixed 2%/);
});

const doubleBottom = { name: "Double bottom", status: "forming", two_swings_visible: true, intervening_swing_visible: true, breakout_confirmed: false, neckline: 100, extreme_1: 95, extreme_2: 95.5, evidence: "Two distinct troughs around 95 are separated by a rally to 100; the second trough has recovered below the neckline." };

test("a forming double bottom yields a neckline-triggered scenario before a breakout", () => {
  const result = read({ current_price: "98", verdict: "inconclusive", trade_plan: {}, levels: {}, pattern_checks: [doubleBottom] });
  assert.equal(result.pattern_checks[0].status, "forming");
  assert.equal(result.trade_plan.side, "long");
  assert.equal(result.trade_plan.entry_value, 100);
  assert.ok(result.trade_plan.stop_value < 95.5);
  assert.equal(result.trade_plan.target_value, 104.5);
  assert.notEqual(result.trade_plan.status, "confirmed");
});

test("double bottom/top needs two actual swings and the intervening swing", () => {
  for (const changes of [{ two_swings_visible: false }, { intervening_swing_visible: false }, { neckline: 90 }]) {
    assert.deepEqual(read({ pattern_checks: [{ ...doubleBottom, ...changes }] }).pattern_checks, []);
  }
  assert.equal(read({ pattern_checks: [{ ...doubleBottom, status: "confirmed" }] }).pattern_checks[0].status, "forming");
  assert.equal(read({ pattern_checks: [{ ...doubleBottom, status: "confirmed", breakout_confirmed: true }] }).pattern_checks[0].status, "confirmed");
});

test("opposing evidence and estimated risk levels reduce the StockGPT Score", () => {
  const confirmed = read({ trade_plan: { ...scan.trade_plan, activation: "confirmed" } });
  const opposed = read({ signals: [priceSignal, { ...indicatorSignal, bias: "bearish" }], trade_plan: { ...scan.trade_plan, activation: "confirmed" } });
  const estimated = read({ trade_plan: { ...scan.trade_plan, levels_basis: "estimated" } });
  assert.ok(confirmed.stockgpt_score.value > opposed.stockgpt_score.value);
  assert.ok(confirmed.stockgpt_score.value > estimated.stockgpt_score.value);
  assert.ok(estimated.stockgpt_score.value <= 60);
});

test("reviewer-only discoveries survive as unconfirmed text rather than independent findings", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: { ...rawLayout, indicators: [] }, model: "mapper" }),
    analyse: async () => ({ value: { ...scan, indicator_checks: [], signals: [priceSignal] }, model: "analyst" }),
    review: async () => ({ value: { ...scan, additional_indicators: rawLayout.indicators,
      indicator_checks: [{ id: "review-indicator-1", name: "RSI", status: "readable", finding: "RSI recovers above 50." }],
      signals: [{ ...indicatorSignal, region_id: "review-indicator-1" }],
    }, model: "reviewer" }),
  }, 1);
  assert.equal(output.result.indicator_checks[0].status, "not_confirmed");
  assert.equal(output.result.indicator_checks[0].finding, "RSI recovers above 50.");
  assert.equal(output.result.signals.some(signal => signal.kind === "indicator"), false);
});
test("additional aliases map to the same checked region in both independent reads", async () => {
  const output = await runGroundedChartScan({
    locate: async () => ({ value: { ...rawLayout, indicators: [] }, model: "mapper" }),
    analyse: async () => ({ value: { ...scan, additional_indicators: rawLayout.indicators,
      indicator_checks: [{ id: "analysis-indicator-1", name: "RSI", status: "readable", finding: "RSI recovers through its midline." }],
      signals: [{ ...indicatorSignal, region_id: "analysis-indicator-1" }],
    }, model: "analyst" }),
    review: async () => ({ value: { ...scan, additional_indicators: [{ ...rawLayout.indicators[0], name: "Relative Strength Index" }],
      indicator_checks: [{ id: "review-indicator-1", name: "Relative Strength Index", status: "readable", finding: "The visible oscillator crosses above 50." }],
      signals: [{ ...indicatorSignal, region_id: "review-indicator-1" }],
    }, model: "reviewer" }),
  }, 1);
  assert.equal(output.result.indicator_checks.length, 1);
  assert.equal(output.result.indicator_checks[0].id, "analysis-indicator-1");
  assert.equal(output.result.indicator_checks[0].status, "readable");
  assert.equal(output.result.signals[0].region_id, "analysis-indicator-1");
});
test("additional regions on a different source or panel do not borrow another indicator's first read", async () => {
  for (const changes of [{ source_image: 1 }, { box: { ...rsiPanel, y_pct: 82 } }]) {
    const output = await runGroundedChartScan({
      locate: async () => ({ value: rawLayout, model: "mapper" }),
      analyse: async () => ({ value: scan, model: "analyst" }),
      review: async () => ({ value: { ...scan, additional_indicators: [{ ...rawLayout.indicators[0], ...changes }],
        indicator_checks: [{ id: "review-indicator-1", name: "RSI", status: "readable", finding: "The second oscillator rises." }],
        signals: [{ ...indicatorSignal, source_image: changes.source_image ?? 0, region_id: "review-indicator-1" }],
      }, model: "reviewer" }),
    }, 2);
    assert.equal(output.result.indicator_checks.length, 2);
    assert.equal(output.result.indicator_checks[1].status, "not_confirmed");
    assert.equal(output.result.signals.some(signal => signal.kind === "indicator"), false);
  }
});

test("a forming pattern cannot be promoted by a model's confirmed trade activation", () => {
  const result = read({ pattern_checks: [doubleBottom], trade_plan: { ...scan.trade_plan, activation: "confirmed" } });
  assert.equal(result.trade_plan.status, "conditional");
  assert.match(result.trade_plan.plan, /close above the 100.00 neckline/);
});

test("numbers proposed without any readable price anchor are never absolute exits", () => {
  const result = read({ current_price: null, levels: {}, trade_plan: { ...scan.trade_plan, price_scale_readable: false } });
  assert.equal(result.trade_plan.status, "relative");
  assert.equal(result.trade_plan.entry_value, null);
  assert.equal(result.trade_plan.stop_value, null);
  assert.equal(result.trade_plan.target_value, null);
  assert.ok(result.trade_plan.stop_loss && result.trade_plan.take_profit);
});

test("a user-derived model plan remains estimated rather than technically confirmed", () => {
  const result = normaliseChartScan({ ...scan, current_price: null, trade_plan: { ...scan.trade_plan, price_basis: "user", activation: "confirmed" } }, layout, true, 100);
  assert.equal(result.trade_plan.price_basis, "user");
  assert.equal(result.trade_plan.status, "estimated");
  assert.ok(result.stockgpt_score.value <= 60);
});
