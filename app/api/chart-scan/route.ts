import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, rateKey } from "@/lib/security/rate-limit";

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
  signals?: unknown;
  trade_plan?: {
    entry?: unknown;
    stop_loss?: unknown;
    take_profit?: unknown;
    risk_reward?: unknown;
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
const MAX_IMAGE_COUNT = 3;
const MAX_TOTAL_IMAGE_BYTES = 8_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VISION_MODELS = [
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4.5",
];

const SYSTEM_PROMPT = [
  "You are StockGPT Chart Scanner V1, a visual technical-analysis assistant inside an investing app.",
  "Analyse only what is visible in the supplied chart image(s). This version is NOT connected to live market data.",
  "The FIRST image is always the primary chart. Any later images are supplementary context that must be pieced together with the first image.",
  "Never invent prices, indicators, chart geometry or certainty.",
  "",
  "FIRST: identify the actual PRICE PLOT AREA in the first image.",
  "- The usable plot area must contain visible candlesticks/wicks or a continuous plotted price line.",
  "- Exclude TradingView/app headers, ticker/title text, toolbars, watchlist rows, legends, watermarks, status bars, price-scale labels themselves, indicator titles and empty margins.",
  "- Do not treat horizontal UI separators, title underlines, toolbar edges or text baselines as support/resistance.",
  "- All overlay coordinates refer to the FIRST image only.",
  "",
  "Signal catalogue to check when genuinely visible:",
  "- trend direction, higher highs/lows, lower highs/lows, trendline breaks, channels and channel breaks",
  "- horizontal support/resistance, support-resistance flips, range breaks, failed breaks, retests and rejection",
  "- ascending/descending/symmetrical triangles, wedges, flags, pennants, rectangles and compression",
  "- double/triple tops, double/triple bottoms, head-and-shoulders, inverse head-and-shoulders",
  "- cup-and-handle, inverse cup-and-handle, rounding bottom/top, V reversals and base structures",
  "- gaps, gap fills, breakaway/continuation/exhaustion gaps when clearly visible",
  "- candlestick signals such as engulfing, pin bars/hammers, shooting stars, doji clusters and morning/evening stars when candle detail is readable",
  "- moving-average crosses, price vs moving averages, RSI divergence/overbought/oversold, MACD crosses/divergence, Bollinger squeezes/expansions and volume confirmation ONLY when those indicators are visibly present",
  "- momentum continuation, exhaustion, divergence, breakout volume, failed momentum and confluence across visible signals",
  "",
  "Return one JSON object and nothing else with exactly these fields:",
  '{ "verdict": "bullish|bearish|inconclusive", "label": "short setup label", "pattern": "primary pattern name or No clear pattern", "confidence": 0, "ticker": "ticker or null", "timeframe": "timeframe or null", "current_price": "visible current/latest price or null", "price_series_type": "candles|price_line|unsupported|unknown", "retake_required": false, "retake_reason": "short reason or null", "needs_more_info": false, "more_info_prompt": "specific extra photo requested or null", "summary": "1-2 short sentences", "confirmation": "what visible price action would confirm the setup", "invalidation": "what visible price action would invalidate it", "watch_for": "one concise thing to watch next", "observations": ["max 4 concise observations"], "signals": [{ "name": "signal name", "bias": "bullish|bearish|neutral", "confidence": 0, "evidence": "why this is visible", "box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 } }], "trade_plan": { "entry": "price only or null", "stop_loss": "price only or null", "take_profit": "price only or null", "risk_reward": "e.g. 2.1:1 or null", "rationale": "short structure-based rationale or null" }, "levels": { "support": "price only or null", "resistance": "price only or null", "breakout": "price only or null", "invalidation": "price only or null" }, "overlay": { "resistance_y_pct": 0, "support_y_pct": 0, "price_plot_box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 }, "pattern_box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 } } }',
  "",
  "Rules:",
  "- Confidence means confidence in the VISUAL PATTERN READ, not probability of profit.",
  "- Find up to 6 genuinely visible signals. Do not pad the list.",
  "- Verdict reflects visible signal confluence. Use inconclusive when evidence conflicts or is weak.",
  "- price_series_type MUST be candles or price_line for a usable primary chart. If neither is visible, set retake_required true, verdict inconclusive and request a new full-chart photo.",
  "- price_plot_box must tightly bound only the primary candlestick/price-line plotting region in the FIRST image.",
  "- Every signal box must sit inside price_plot_box and surround actual candle/wick/price-line evidence. Never put signal boxes over titles, headers, toolbars, legends or text-only regions.",
  "- A support/resistance line is allowed ONLY when actual candles/wicks or the plotted price line visibly react around that price inside price_plot_box. Never infer a level from a header, title, UI line or empty space.",
  "- resistance_y_pct and support_y_pct are full-image Y percentages but MUST fall inside price_plot_box. Use null if that cannot be verified.",
  "- pattern_box must sit inside price_plot_box. Use null if no coherent formation is visible.",
  "- Only identify ticker/timeframe/current_price when clearly readable.",
  "- If the primary chart is usable but current price, price scale, timeframe, indicator panel or another key detail is missing, prefer needs_more_info=true rather than discarding the first image.",
  "- more_info_prompt must ask for ONE specific helpful photo, e.g. a close-up of the latest candles + right-side price scale, or a full view including RSI/MACD. The next image will be analysed together with the first.",
  "- Never invent stop-loss or take-profit. Only provide entry/stop_loss/take_profit after current price and the relevant structure/scale are readable across the supplied images.",
  "- entry, stop_loss, take_profit and level fields should contain concise price strings only; put explanation in rationale/confirmation/invalidation.",
  "- Stop-loss must sit beyond visible technical invalidation. Take-profit must reference visible support/resistance, a measured move or another clear structure target.",
  "- risk_reward may only be supplied when entry, stop and target are all sufficiently readable.",
  "- If supplementary images disagree with the primary chart, say inconclusive rather than forcing a verdict.",
  "- Never say guaranteed, easy money, sure thing, BUY NOW, or SELL NOW.",
  "- Keep the answer punchy and beginner-friendly.",
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

function boxCenterInside(inner: PctBox | null, outer: PctBox | null) {
  if (!inner || !outer) return false;
  const centerX = inner.x_pct + inner.width_pct / 2;
  const centerY = inner.y_pct + inner.height_pct / 2;
  return (
    centerX >= outer.x_pct &&
    centerX <= outer.x_pct + outer.width_pct &&
    centerY >= outer.y_pct &&
    centerY <= outer.y_pct + outer.height_pct
  );
}

function yInsideBox(y: number | null, box: PctBox | null) {
  if (y === null || !box) return false;
  return y >= box.y_pct && y <= box.y_pct + box.height_pct;
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
  const pricePlotBox = normaliseBox(raw.overlay?.price_plot_box);
  const mustRetake =
    bool(raw.retake_required) ||
    priceSeriesType === "unsupported" ||
    !pricePlotBox;
  const needsMoreInfo =
    !mustRetake && (bool(raw.needs_more_info) || !currentPrice);

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
      if (!boxCenterInside(signalBox, pricePlotBox)) return null;

      return {
        name,
        bias: signalBias(signal.bias),
        confidence: confidence(signal.confidence),
        evidence: text(signal.evidence, 180) ?? "Visible chart structure supports this signal.",
        box: signalBox,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);

  const resistanceY = pct(raw.overlay?.resistance_y_pct);
  const supportY = pct(raw.overlay?.support_y_pct);
  const patternBox = normaliseBox(raw.overlay?.pattern_box);
  const withholdTradePlan = mustRetake || needsMoreInfo;

  return {
    verdict: mustRetake ? "inconclusive" as const : verdict(raw.verdict),
    label: text(raw.label, 70) ?? "Inconclusive setup",
    pattern: text(raw.pattern, 90) ?? "No clear pattern",
    confidence: confidence(raw.confidence),
    ticker: text(raw.ticker, 14)?.toUpperCase() ?? null,
    timeframe: text(raw.timeframe, 24) ?? null,
    current_price: currentPrice,
    price_series_type: priceSeriesType,
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
        ? "Add one more photo showing the latest candles and the current price / right-side price scale clearly."
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
      entry: withholdTradePlan ? null : text(raw.trade_plan?.entry, 40),
      stop_loss: withholdTradePlan ? null : text(raw.trade_plan?.stop_loss, 40),
      take_profit: withholdTradePlan ? null : text(raw.trade_plan?.take_profit, 40),
      risk_reward: withholdTradePlan ? null : text(raw.trade_plan?.risk_reward, 24),
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
      pattern_box: boxCenterInside(patternBox, pricePlotBox) ? patternBox : null,
    },
  };
}

async function analyseImages(apiKey: string, dataUrls: string[]) {
  const failures: Array<{ model: string; status?: number; message: string }> = [];

  for (const model of VISION_MODELS) {
    try {
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
          temperature: 0.15,
          max_tokens: 2300,
          reasoning: { exclude: true },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    dataUrls.length > 1
                      ? "Analyse these images together. The first image is the primary chart and all overlay coordinates must refer to it. Later images are supporting views only. First isolate the real candle/price-line plot area, then analyse signals and risk levels. Return only the requested JSON."
                      : "Scan this chart deeply. First isolate the real candlestick/price-line plotting area and ignore all headers/toolbars/text. Then identify genuinely visible signals and risk levels. If one missing detail would materially improve the read, request one additional photo. Return only the requested JSON.",
                },
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

      if (response.ok && content) {
        const parsed = parseJsonObject(content);
        if (parsed) {
          return { result: normaliseResult(parsed), model, failures };
        }
      }

      failures.push({
        model,
        status: response.status,
        message: payload?.error?.message ?? "Model did not return valid scanner JSON.",
      });
    } catch (error) {
      failures.push({
        model,
        message: error instanceof Error ? error.message : "Vision request failed.",
      });
    }
  }

  return { result: null, model: null, failures };
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

    if (process.env.NODE_ENV !== "development") {
      const rateLimit = await checkRateLimit({
        action: "chart_scan",
        key: rateKey(["chart-scan", user.id]),
        limit: 15,
        windowSeconds: 60 * 60,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "You have scanned a lot of charts this hour. Try again shortly." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          },
        );
      }
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
        { error: "Use up to three chart photos for one scan." },
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
    });
  } catch (error) {
    console.error("[chart-scan]", error);
    return NextResponse.json(
      { error: "Chart Scanner hit an unexpected error. Try again." },
      { status: 500 },
    );
  }
}
