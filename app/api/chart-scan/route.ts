import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict = "bullish" | "bearish" | "inconclusive";

type RawScanResult = {
  verdict?: unknown;
  label?: unknown;
  pattern?: unknown;
  confidence?: unknown;
  ticker?: unknown;
  timeframe?: unknown;
  summary?: unknown;
  confirmation?: unknown;
  invalidation?: unknown;
  watch_for?: unknown;
  observations?: unknown;
  current_price?: unknown;
  retake_required?: unknown;
  retake_reason?: unknown;
  needs_more_info?: unknown;
  more_info_prompt?: unknown;
  price_series_type?: unknown;
  chart_coverage?: unknown;
  signals?: unknown;
  trade_plan?: {
    entry?: unknown;
    stop_loss?: unknown;
    take_profit?: unknown;
    risk_reward?: unknown;
    projected_horizon?: unknown;
    projected_bars?: unknown;
    plan?: unknown;
    rationale?: unknown;
  };
  levels?: {
    support?: unknown;
    resistance?: unknown;
    breakout?: unknown;
    invalidation?: unknown;
  };
  overlay?: {
    resistance_y_pct?: unknown;
    support_y_pct?: unknown;
    price_plot_box?: {
      x_pct?: unknown;
      y_pct?: unknown;
      width_pct?: unknown;
      height_pct?: unknown;
    } | null;
    pattern_box?: {
      x_pct?: unknown;
      y_pct?: unknown;
      width_pct?: unknown;
      height_pct?: unknown;
    } | null;
  };
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const MAX_IMAGE_BYTES = 3_200_000;
const MAX_IMAGE_COUNT = 2;
const MAX_TOTAL_IMAGE_BYTES = 3_600_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PRIMARY_VISION_MODEL = "google/gemini-2.5-flash";
const SECOND_OPINION_MODEL = "anthropic/claude-sonnet-4.5";

const SYSTEM_PROMPT = [
  "You are StockGPT Chart Scanner V1, a decisive visual technical-analysis assistant inside an investing app.",
  "Analyse only what is visible in the supplied chart image(s). This version is NOT connected to live market data.",
  "The FIRST image is always the primary chart. Any later image is supplementary context.",
  "Never invent prices, indicators, chart geometry or certainty.",
  "",
  "Your priority order is:",
  "1. Read the actual candlestick or plotted price-line structure.",
  "2. Identify the strongest directional pattern and supporting signals.",
  "3. Choose the most likely technical bias: bullish or bearish.",
  "4. Build a practical visual trade plan when price levels are readable.",
  "5. Separately provide conservative overlay coordinates for UI drawing.",
  "",
  "IMPORTANT VERDICT BEHAVIOUR:",
  "- Do NOT default to inconclusive just because the setup is imperfect.",
  "- Technical analysis is probabilistic. A chart can be bullish or bearish without being textbook-perfect.",
  "- If the visible evidence has a meaningful directional lean, choose bullish or bearish and explain the invalidation.",
  "- Use inconclusive only when the image is unusable, the signals are genuinely balanced/conflicting, or there is no meaningful directional structure.",
  "- A single support/resistance line is not enough analysis. Inspect trend, swing structure, compression/expansion, breakouts, retests, failed moves, candle behaviour and any visible indicators.",
  "- On a readable chart, confidence should reflect pattern clarity. Values below 25 should be rare and reserved for genuinely poor/conflicting reads. Typical usable directional setups will often land around 45-85. Do not inflate confidence merely to sound certain.",
  "",
  "PRICE PLOT / OVERLAY SAFETY:",
  "- Identify the actual PRICE PLOT AREA in the first image containing candlesticks/wicks or a continuous plotted price line.",
  "- Exclude TradingView/app headers, ticker/title text, toolbars, watchlist rows, legends, watermarks, status bars, price-scale labels themselves, indicator titles and empty margins.",
  "- Do not treat horizontal UI separators, title underlines, toolbar edges or text baselines as support/resistance.",
  "- All overlay coordinates refer to the FIRST image only.",
  "- Overlay strictness must NOT make you ignore valid chart patterns. If you can recognise a pattern but cannot safely localise an overlay, report the pattern and use null overlay geometry.",
  "",
  "PATTERN / SIGNAL CATALOGUE — actively check all relevant families:",
  "- market structure: uptrend/downtrend, higher highs/lows, lower highs/lows, trend changes, swing failure, break of structure, change of character",
  "- levels: support/resistance, flips, ranges, breakout/breakdown, retest, false breakout, liquidity sweep, rejection",
  "- continuation: bull/bear flags, pennants, ascending/descending/symmetrical triangles, rectangles, channels, wedges, compression, stair-step trends",
  "- reversals: double/triple top or bottom, head-and-shoulders, inverse H&S, rounding top/bottom, V reversal, failed breakdown/breakout, base and reclaim",
  "- larger formations: cup-and-handle, inverse cup-and-handle, measured moves, expanding formations when genuinely visible",
  "- candles: engulfing, pin bar/hammer, shooting star, doji clusters, morning/evening star, strong rejection or momentum candles when detail is readable",
  "- gaps: breakaway, continuation, exhaustion and gap fill when genuinely visible",
  "- indicators ONLY if visible: moving averages, RSI, MACD, Bollinger Bands, volume, divergence/convergence and momentum confirmation",
  "- confluence: reward multiple independent clues pointing the same way; do not count the same structure twice under different names",
  "",
  "TIMEFRAME-AWARE TRADE PLAN:",
  "- Read the chart timeframe if visible. Use that timeframe to estimate how many candles/bars the setup may need to reach the target.",
  "- projected_bars is an approximate range such as '6-12 bars'.",
  "- projected_horizon converts those bars into a plain-language duration using the visible timeframe, e.g. a 15m chart might imply '1.5-3 hours', a 4h chart '1-3 days', a daily chart '1-3 weeks'.",
  "- Use recent visible swing cadence and the distance to the technical target when estimating the bar range. This is a scenario estimate, never a promise.",
  "- If timeframe is unreadable, projected_bars/projected_horizon may be null. Do not ask for another photo solely to obtain timeframe.",
  "",
  "Return one JSON object and nothing else with exactly these fields:",
  '{ "verdict": "bullish|bearish|inconclusive", "label": "short setup label", "pattern": "primary pattern or structure name", "confidence": 0, "ticker": "ticker or null", "timeframe": "timeframe or null", "current_price": "visible current/latest price or null", "price_series_type": "candles|price_line|unsupported|unknown", "chart_coverage": "full|partial|unclear", "retake_required": false, "retake_reason": "short reason or null", "needs_more_info": false, "more_info_prompt": "specific extra photo request or null", "summary": "1-2 concise sentences", "confirmation": "what would confirm the setup", "invalidation": "what would invalidate it", "watch_for": "one concise next event", "observations": ["max 4 concise observations"], "signals": [{ "name": "signal name", "bias": "bullish|bearish|neutral", "confidence": 0, "evidence": "specific visible evidence", "box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 } }], "trade_plan": { "entry": "price only or null", "stop_loss": "price only or null", "take_profit": "price only or null", "risk_reward": "e.g. 2.1:1 or null", "projected_bars": "e.g. 6-12 bars or null", "projected_horizon": "e.g. 1-3 days or null", "plan": "concise execution plan tied to timeframe/confirmation/invalidation", "rationale": "short structure-based rationale or null" }, "levels": { "support": "price only or null", "resistance": "price only or null", "breakout": "price only or null", "invalidation": "price only or null" }, "overlay": { "resistance_y_pct": 0, "support_y_pct": 0, "price_plot_box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 }, "pattern_box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 } } }',
  "",
  "Additional rules:",
  "- Find up to 6 genuinely useful signals. Aim for 2-5 on a normal readable chart when evidence supports them; do not pad.",
  "- price_series_type MUST be candles or price_line for a usable primary chart. If neither is visible, require a retake.",
  "- price_plot_box should cover the real plot area, but if uncertain about coordinates use null geometry rather than downgrading the entire analysis.",
  "- Every signal box that you provide must sit on actual candle/wick/price-line evidence. Never place boxes over titles/toolbars/text.",
  "- Support/resistance overlay lines are allowed only when actual price visibly reacts there.",
  "- Only identify ticker/timeframe/current_price when readable.",
  "- chart_coverage=full means the visible chart history/latest candles/relevant scale are substantially present.",
  "- Be conservative about needs_more_info. Never ask for another photo merely to improve confidence or to force a stop/target.",
  "- If chart_coverage is full and current_price is readable, needs_more_info should normally be false.",
  "- Never request a wider chart when chart_coverage is full.",
  "- Never request optional indicators that are not already visible.",
  "- If a stop/target cannot be justified, leave it null and still provide the directional analysis.",
  "- Stop-loss must sit beyond visible invalidation structure. Take-profit must reference visible support/resistance, measured move or clear target structure.",
  "- entry, stop_loss, take_profit and level fields should contain concise price strings only.",
  "- Never say guaranteed, easy money, sure thing, BUY NOW, or SELL NOW.",
  "- Keep the answer punchy and useful.",
].join("\n");

function isNativeApp(req: NextRequest) {
  return /StockGPTApp/i.test(req.headers.get("user-agent") ?? "");
}

function text(value: unknown, max = 220) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || /^(null|unknown|n\/a|none)$/i.test(cleaned)) return null;
  return cleaned.slice(0, max);
}

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Number(n.toFixed(1))));
}

type PctBox = {
  x_pct: number;
  y_pct: number;
  width_pct: number;
  height_pct: number;
};

function normaliseBox(value: unknown): PctBox | null {
  if (!value || typeof value !== "object") return null;
  const box = value as {
    x_pct?: unknown;
    y_pct?: unknown;
    width_pct?: unknown;
    height_pct?: unknown;
  };
  const x = pct(box.x_pct);
  const y = pct(box.y_pct);
  const width = pct(box.width_pct);
  const height = pct(box.height_pct);
  if (x === null || y === null || width === null || height === null) return null;
  if (width < 2 || height < 2) return null;
  return {
    x_pct: x,
    y_pct: y,
    width_pct: Math.min(width, 100 - x),
    height_pct: Math.min(height, 100 - y),
  };
}

function normalisePricePlotBox(value: unknown) {
  const box = normaliseBox(value);
  if (!box) return null;
  if (box.width_pct < 35 || box.height_pct < 20) return null;
  return box;
}

function boxInside(inner: PctBox | null, outer: PctBox | null) {
  if (!inner || !outer) return false;
  return (
    inner.x_pct >= outer.x_pct &&
    inner.y_pct >= outer.y_pct &&
    inner.x_pct + inner.width_pct <= outer.x_pct + outer.width_pct &&
    inner.y_pct + inner.height_pct <= outer.y_pct + outer.height_pct
  );
}

function yInsideBox(y: number | null, box: PctBox | null) {
  if (y === null || !box) return false;
  const edgeMargin = Math.min(3, Math.max(1.25, box.height_pct * 0.06));
  return (
    y >= box.y_pct + edgeMargin &&
    y <= box.y_pct + box.height_pct - edgeMargin
  );
}

function confidence(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function bool(value: unknown) {
  return value === true || String(value ?? "").toLowerCase() === "true";
}

function signalBias(value: unknown) {
  const cleaned = String(value ?? "").toLowerCase();
  if (cleaned === "bullish" || cleaned === "bearish") return cleaned;
  return "neutral";
}

function verdict(value: unknown): Verdict {
  const cleaned = String(value ?? "").toLowerCase();
  if (cleaned === "bullish" || cleaned === "bearish") return cleaned;
  return "inconclusive";
}

function parseJsonObject(content: string): RawScanResult | null {
  const stripped = content
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(stripped.slice(start, end + 1)) as RawScanResult;
  } catch {
    return null;
  }
}

function normaliseResult(raw: RawScanResult) {
  const rawObservations = Array.isArray(raw.observations) ? raw.observations : [];
  const rawSignals = Array.isArray(raw.signals) ? raw.signals : [];
  const currentPrice = text(raw.current_price, 50);
  const seriesTypeRaw = String(raw.price_series_type ?? "").toLowerCase();
  const priceSeriesType =
    seriesTypeRaw === "candles" || seriesTypeRaw === "price_line"
      ? seriesTypeRaw
      : seriesTypeRaw === "unsupported"
        ? "unsupported"
        : "unknown";
  const pricePlotBox = normalisePricePlotBox(raw.overlay?.price_plot_box);
  const mustRetake =
    bool(raw.retake_required) ||
    priceSeriesType === "unsupported";
  const rawEntry = text(raw.trade_plan?.entry, 40);
  const rawStopLoss = text(raw.trade_plan?.stop_loss, 40);
  const rawTakeProfit = text(raw.trade_plan?.take_profit, 40);
  const coverageRaw = String(raw.chart_coverage ?? "").toLowerCase();
  const chartCoverage =
    coverageRaw === "full" || coverageRaw === "partial"
      ? coverageRaw
      : "unclear";
  const modelRequestsMoreInfo = bool(raw.needs_more_info);
  const needsMoreInfo =
    !mustRetake &&
    (!currentPrice || (modelRequestsMoreInfo && chartCoverage === "partial"));

  const signals = rawSignals
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const signal = item as {
        name?: unknown;
        bias?: unknown;
        confidence?: unknown;
        evidence?: unknown;
        box?: unknown;
      };
      const name = text(signal.name, 80);
      if (!name) return null;
      const signalBox = normaliseBox(signal.box);
      const safeSignalBox = boxInside(signalBox, pricePlotBox) ? signalBox : null;

      return {
        name,
        bias: signalBias(signal.bias),
        confidence: confidence(signal.confidence),
        evidence: text(signal.evidence, 180) ?? "Visible chart structure supports this signal.",
        box: safeSignalBox,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);

  const resistanceY = pct(raw.overlay?.resistance_y_pct);
  const supportY = pct(raw.overlay?.support_y_pct);
  const patternBox = normaliseBox(raw.overlay?.pattern_box);
  const withholdTradePlan = mustRetake || needsMoreInfo;

  const rawVerdict = verdict(raw.verdict);
  const rawConfidence = confidence(raw.confidence);
  const bullishSignals = signals.filter((signal) => signal.bias === "bullish");
  const bearishSignals = signals.filter((signal) => signal.bias === "bearish");
  const bullishWeight = bullishSignals.reduce((sum, signal) => sum + signal.confidence, 0);
  const bearishWeight = bearishSignals.reduce((sum, signal) => sum + signal.confidence, 0);

  let resolvedVerdict: Verdict = rawVerdict;
  if (!mustRetake && rawVerdict === "inconclusive") {
    const enoughDirectionalEvidence = bullishSignals.length + bearishSignals.length >= 2;
    if (
      enoughDirectionalEvidence &&
      bullishSignals.length >= 2 &&
      bullishWeight >= bearishWeight * 1.45 + 20
    ) {
      resolvedVerdict = "bullish";
    } else if (
      enoughDirectionalEvidence &&
      bearishSignals.length >= 2 &&
      bearishWeight >= bullishWeight * 1.45 + 20
    ) {
      resolvedVerdict = "bearish";
    }
  }

  const matchingSignals =
    resolvedVerdict === "bullish"
      ? bullishSignals
      : resolvedVerdict === "bearish"
        ? bearishSignals
        : [];
  const matchingAverage =
    matchingSignals.length > 0
      ? matchingSignals.reduce((sum, signal) => sum + signal.confidence, 0) / matchingSignals.length
      : 0;
  const calibratedConfidence =
    resolvedVerdict !== "inconclusive" && matchingSignals.length >= 2 && rawConfidence < 30
      ? Math.max(rawConfidence, Math.min(82, Math.round(matchingAverage * 0.72)))
      : rawConfidence;

  return {
    verdict: mustRetake ? "inconclusive" as const : resolvedVerdict,
    label: text(raw.label, 70) ?? "Inconclusive setup",
    pattern: text(raw.pattern, 90) ?? "No clear pattern",
    confidence: calibratedConfidence,
    ticker: text(raw.ticker, 14)?.toUpperCase() ?? null,
    timeframe: text(raw.timeframe, 24) ?? null,
    current_price: currentPrice,
    price_series_type: priceSeriesType,
    chart_coverage: chartCoverage,
    retake_required: mustRetake,
    retake_reason:
      text(raw.retake_reason, 220) ??
      (mustRetake
        ? "Retake the full chart so StockGPT can clearly see the candlesticks or plotted price line."
        : null),
    needs_more_info: needsMoreInfo,
    more_info_prompt:
      text(raw.more_info_prompt, 220) ??
      (needsMoreInfo
        ? !currentPrice
          ? "Add one close-up showing the latest candles and the current price / right-side price scale clearly."
          : "The primary chart is materially cropped. Add one wider view that includes the missing price history and the current price scale."
        : null),
    summary: text(raw.summary, 420) ?? "The chart image does not show enough reliable structure for a strong read.",
    confirmation: text(raw.confirmation, 260) ?? "Wait for clearer price confirmation before treating the setup as valid.",
    invalidation: text(raw.invalidation, 260) ?? "A clean break against the visible structure would invalidate the setup.",
    watch_for: text(raw.watch_for, 220) ?? "Watch whether price confirms or rejects the visible structure.",
    observations: rawObservations
      .map((item) => text(item, 180))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4),
    signals,
    trade_plan: {
      entry: withholdTradePlan ? null : rawEntry,
      stop_loss: withholdTradePlan ? null : rawStopLoss,
      take_profit: withholdTradePlan ? null : rawTakeProfit,
      risk_reward: withholdTradePlan ? null : text(raw.trade_plan?.risk_reward, 24),
      projected_bars: withholdTradePlan ? null : text(raw.trade_plan?.projected_bars, 60),
      projected_horizon: withholdTradePlan ? null : text(raw.trade_plan?.projected_horizon, 80),
      plan: text(raw.trade_plan?.plan, 320),
      rationale: withholdTradePlan ? null : text(raw.trade_plan?.rationale, 220),
    },
    levels: {
      support: text(raw.levels?.support, 40),
      resistance: text(raw.levels?.resistance, 40),
      breakout: text(raw.levels?.breakout, 40),
      invalidation: text(raw.levels?.invalidation, 40),
    },
    overlay: {
      price_plot_box: pricePlotBox,
      resistance_y_pct: yInsideBox(resistanceY, pricePlotBox) ? resistanceY : null,
      support_y_pct: yInsideBox(supportY, pricePlotBox) ? supportY : null,
      pattern_box: boxInside(patternBox, pricePlotBox) ? patternBox : null,
    },
  };
}

type NormalisedScanResult = ReturnType<typeof normaliseResult>;

function resultStrength(result: NormalisedScanResult) {
  if (result.retake_required) return -100;
  const decisiveBonus = result.verdict === "inconclusive" ? -18 : 40;
  const signalBonus = Math.min(24, result.signals.length * 5);
  const patternBonus = /no clear pattern/i.test(result.pattern) ? 0 : 12;
  const planBonus = result.trade_plan.stop_loss && result.trade_plan.take_profit ? 8 : 0;
  return result.confidence + decisiveBonus + signalBonus + patternBonus + planBonus;
}

function needsSecondOpinion(result: NormalisedScanResult) {
  if (result.retake_required || result.needs_more_info) return false;
  return (
    result.verdict === "inconclusive" ||
    result.confidence < 38 ||
    result.signals.length < 2 ||
    /no clear pattern/i.test(result.pattern)
  );
}

async function requestVisionAnalysis(
  apiKey: string,
  model: string,
  dataUrls: string[],
  instruction: string,
) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://stockgpt.pro",
      "X-Title": "StockGPT Chart Scanner",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2600,
      reasoning: { exclude: true },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            ...dataUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;
  const content = payload?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!response.ok || !content) {
    return {
      result: null,
      failure: {
        model,
        status: response.status,
        message: payload?.error?.message ?? "Model did not return chart analysis.",
      },
    };
  }

  const parsed = parseJsonObject(content);
  if (!parsed) {
    return {
      result: null,
      failure: {
        model,
        status: response.status,
        message: "Model did not return valid scanner JSON.",
      },
    };
  }

  return { result: normaliseResult(parsed), failure: null };
}

async function analyseImages(apiKey: string, dataUrls: string[]) {
  const failures: Array<{ model: string; status?: number; message: string }> = [];
  const primaryInstruction =
    dataUrls.length > 1
      ? "Analyse these chart images together. The first is primary. Be decisive about the dominant technical bias, actively search for multiple pattern/structure signals, and build a timeframe-aware trade plan when levels are readable. Keep overlays strictly inside real price action. Return only JSON."
      : "Scan this chart as a technical analyst, not just a line detector. Actively identify the dominant pattern/market structure, multiple supporting or opposing signals, and choose bullish or bearish whenever the evidence meaningfully leans one way. Build a timeframe-aware trade plan when possible. Keep UI overlays strictly inside real price action. Return only JSON.";

  const primary = await requestVisionAnalysis(
    apiKey,
    PRIMARY_VISION_MODEL,
    dataUrls,
    primaryInstruction,
  );

  if (primary.failure) failures.push(primary.failure);

  if (!primary.result) {
    const fallback = await requestVisionAnalysis(
      apiKey,
      SECOND_OPINION_MODEL,
      dataUrls,
      "The primary scanner failed. Perform a fresh, deep technical read. Identify the strongest directional setup and pattern family, avoid defaulting to inconclusive, and return the required JSON.",
    );
    if (fallback.failure) failures.push(fallback.failure);
    return {
      result: fallback.result,
      model: fallback.result ? SECOND_OPINION_MODEL : null,
      passes: fallback.result ? 1 : 0,
      failures,
    };
  }

  if (!needsSecondOpinion(primary.result)) {
    return {
      result: primary.result,
      model: PRIMARY_VISION_MODEL,
      passes: 1,
      failures,
    };
  }

  const second = await requestVisionAnalysis(
    apiKey,
    SECOND_OPINION_MODEL,
    dataUrls,
    "Give this chart an independent second technical read because the first pass was weak or inconclusive. Look beyond support/resistance: inspect swing structure, continuation/reversal patterns, breakout/retest behaviour, candle momentum and visible indicators. Unless the evidence is truly balanced, pick the stronger bullish or bearish thesis and state its invalidation. Estimate the timeframe-aware trade horizon when the chart timeframe is visible. Return only the required JSON.",
  );

  if (second.failure) failures.push(second.failure);

  if (!second.result) {
    return {
      result: primary.result,
      model: PRIMARY_VISION_MODEL,
      passes: 1,
      failures,
    };
  }

  const chosen =
    resultStrength(second.result) > resultStrength(primary.result)
      ? { result: second.result, model: SECOND_OPINION_MODEL }
      : { result: primary.result, model: PRIMARY_VISION_MODEL };

  return {
    ...chosen,
    passes: 2,
    failures,
  };
}

export async function POST(req: NextRequest) {
  if (!isNativeApp(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chart Scanner is not connected to the AI provider yet." },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const images = formData
      .getAll("image")
      .filter((item): item is File => item instanceof File);

    if (images.length === 0) {
      return NextResponse.json({ error: "Choose a chart image first." }, { status: 400 });
    }

    if (images.length > MAX_IMAGE_COUNT) {
      return NextResponse.json(
        { error: "Use the main chart plus one supporting photo for one scan." },
        { status: 400 },
      );
    }

    let totalBytes = 0;
    for (const image of images) {
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return NextResponse.json(
          { error: "Use JPEG, PNG or WebP chart images." },
          { status: 415 },
        );
      }

      if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "One of those images is too large. Retake it or choose a smaller screenshot." },
          { status: 413 },
        );
      }
      totalBytes += image.size;
    }

    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Those photos are too large together. Use fewer or tighter screenshots." },
        { status: 413 },
      );
    }

    const dataUrls = await Promise.all(
      images.map(async (image) => {
        const bytes = Buffer.from(await image.arrayBuffer());
        return "data:" + image.type + ";base64," + bytes.toString("base64");
      }),
    );
    const analysis = await analyseImages(apiKey, dataUrls);

    if (!analysis.result) {
      console.error("[chart-scan] all vision models failed", analysis.failures);
      return NextResponse.json(
        { error: "StockGPT could not read that chart clearly. Retake it with the full chart, latest candle and current price scale visible." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result: analysis.result,
      model_used: analysis.model,
      analysis_scope: images.length > 1 ? "image_bundle" : "image_only",
      image_count: images.length,
      analysis_passes: analysis.passes,
    });
  } catch (error) {
    console.error("[chart-scan]", error);
    return NextResponse.json(
      { error: "Chart Scanner hit an unexpected error. Try again." },
      { status: 500 },
    );
  }
}
