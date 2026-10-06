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
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VISION_MODELS = [
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4.5",
];

const SYSTEM_PROMPT = [
  "You are StockGPT Chart Scanner V1, a visual technical-analysis assistant inside an investing app.",
  "Analyse only what is visible in the supplied stock chart image. This version is NOT connected to live market data.",
  "Your job is to aggressively look for useful technical signals while never inventing prices, indicators or certainty.",
  "",
  "Signal catalogue to check when visible:",
  "- trend direction, higher highs/lows, lower highs/lows, trendline breaks, channels and channel breaks",
  "- horizontal support/resistance, support-resistance flips, range breaks, failed breaks, retests and rejection",
  "- ascending/descending/symmetrical triangles, wedges, flags, pennants, rectangles and compression",
  "- double/triple tops, double/triple bottoms, head-and-shoulders, inverse head-and-shoulders",
  "- cup-and-handle, inverse cup-and-handle, rounding bottom/top, V reversals and base structures",
  "- gaps, gap fills, breakaway/continuation/exhaustion gaps when clearly visible",
  "- candlestick signals such as engulfing, pin bars/hammers, shooting stars, doji clusters and morning/evening stars when candle detail is actually readable",
  "- moving-average crosses, price vs moving averages, RSI divergence/overbought/oversold, MACD crosses/divergence, Bollinger squeezes/expansions and volume confirmation ONLY when those indicators are visibly present",
  "- momentum continuation, exhaustion, divergence, breakout volume, failed momentum and confluence across visible signals",
  "",
  "Return one JSON object and nothing else with exactly these fields:",
  '{ "verdict": "bullish|bearish|inconclusive", "label": "short setup label", "pattern": "primary pattern name or No clear pattern", "confidence": 0, "ticker": "ticker or null", "timeframe": "timeframe or null", "current_price": "visible current/latest price or null", "retake_required": false, "retake_reason": "short reason or null", "summary": "1-2 short sentences", "confirmation": "what visible price action would confirm the setup", "invalidation": "what visible price action would invalidate it", "watch_for": "one concise thing to watch next", "observations": ["max 4 concise observations"], "signals": [{ "name": "signal name", "bias": "bullish|bearish|neutral", "confidence": 0, "evidence": "why this is visible", "box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 } }], "trade_plan": { "entry": "visible/reference entry or null", "stop_loss": "technical stop level or null", "take_profit": "technical take-profit level or null", "risk_reward": "e.g. 2.1:1 or null", "rationale": "short structure-based rationale or null" }, "levels": { "support": "visible level or null", "resistance": "visible level or null", "breakout": "visible level or null", "invalidation": "visible level or null" }, "overlay": { "resistance_y_pct": 0, "support_y_pct": 0, "pattern_box": { "x_pct": 0, "y_pct": 0, "width_pct": 0, "height_pct": 0 } } }',
  "",
  "Rules:",
  "- Confidence means confidence in the VISUAL PATTERN READ, not probability of profit.",
  "- Find up to 6 genuinely visible signals. Do not pad the list with weak or imaginary signals.",
  "- Verdict should reflect the visible signal confluence. Make Bullish or Bearish clear when evidence supports it; use inconclusive when signals conflict or the chart is unreadable.",
  "- Only identify ticker or timeframe if clearly readable; otherwise use null.",
  "- current_price means the latest/current price printed on the chart or clearly inferable from a labelled latest candle. If it is not clearly readable, use null.",
  "- If current_price is null, set retake_required true and explain that the user should retake with the full chart, right-side price scale/current price and relevant indicators visible.",
  "- Never invent stop-loss or take-profit. Only provide trade_plan entry/stop_loss/take_profit when current_price AND the relevant visible price scale/structure are readable. Otherwise use null for those fields.",
  "- Stop-loss should sit beyond a visible technical invalidation structure, not at an arbitrary percentage. Take-profit should reference the next visible resistance/support, measured move or clear structure target.",
  "- risk_reward may only be supplied when entry, stop and target are all readable enough to compare.",
  "- Only output numeric/price levels if reasonably readable from visible chart labels; otherwise use null.",
  "- Every signal box should tightly surround the visual evidence for that signal using 0-100 image percentages. Use null box fields if positioning is unreliable.",
  "- resistance_y_pct and support_y_pct are approximate vertical positions from the TOP of the image, 0 to 100. Use null if not reliable.",
  "- pattern_box is an approximate 0-100 percentage box around the primary formation. Use null if no coherent formation is visible.",
  "- Prefer Bullish, Bearish, or Inconclusive language. Never say guaranteed, easy money, sure thing, BUY NOW, or SELL NOW.",
  "- If the image is not a financial price chart, return an inconclusive result, require a retake and say no usable chart was detected.",
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
  const box = raw.overlay?.pattern_box;
  const currentPrice = text(raw.current_price, 50);
  const mustRetake = bool(raw.retake_required) || !currentPrice;

  const signals = rawSignals
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const signal = item as {
        name?: unknown;
        bias?: unknown;
        confidence?: unknown;
        evidence?: unknown;
        box?: {
          x_pct?: unknown;
          y_pct?: unknown;
          width_pct?: unknown;
          height_pct?: unknown;
        } | null;
      };
      const name = text(signal.name, 80);
      if (!name) return null;
      const signalBox = signal.box;

      return {
        name,
        bias: signalBias(signal.bias),
        confidence: confidence(signal.confidence),
        evidence: text(signal.evidence, 180) ?? "Visible chart structure supports this signal.",
        box: signalBox
          ? {
              x_pct: pct(signalBox.x_pct),
              y_pct: pct(signalBox.y_pct),
              width_pct: pct(signalBox.width_pct),
              height_pct: pct(signalBox.height_pct),
            }
          : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);

  return {
    verdict: verdict(raw.verdict),
    label: text(raw.label, 70) ?? "Inconclusive setup",
    pattern: text(raw.pattern, 90) ?? "No clear pattern",
    confidence: confidence(raw.confidence),
    ticker: text(raw.ticker, 14)?.toUpperCase() ?? null,
    timeframe: text(raw.timeframe, 24) ?? null,
    current_price: currentPrice,
    retake_required: mustRetake,
    retake_reason:
      text(raw.retake_reason, 220) ??
      (mustRetake
        ? "Retake the photo with the full chart and the current price / right-side price scale clearly visible."
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
      entry: mustRetake ? null : text(raw.trade_plan?.entry, 50),
      stop_loss: mustRetake ? null : text(raw.trade_plan?.stop_loss, 50),
      take_profit: mustRetake ? null : text(raw.trade_plan?.take_profit, 50),
      risk_reward: mustRetake ? null : text(raw.trade_plan?.risk_reward, 30),
      rationale: mustRetake ? null : text(raw.trade_plan?.rationale, 220),
    },
    levels: {
      support: text(raw.levels?.support, 50),
      resistance: text(raw.levels?.resistance, 50),
      breakout: text(raw.levels?.breakout, 50),
      invalidation: text(raw.levels?.invalidation, 50),
    },
    overlay: {
      resistance_y_pct: pct(raw.overlay?.resistance_y_pct),
      support_y_pct: pct(raw.overlay?.support_y_pct),
      pattern_box: box
        ? {
            x_pct: pct(box.x_pct),
            y_pct: pct(box.y_pct),
            width_pct: pct(box.width_pct),
            height_pct: pct(box.height_pct),
          }
        : null,
    },
  };
}

async function analyseImage(apiKey: string, dataUrl: string) {
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
                  text: "Scan this chart deeply. Check the full signal catalogue, identify every genuinely visible bullish/bearish signal, locate each signal on the image, read the visible current price if possible, and only then form the verdict and technical stop/target. Return only the requested JSON.",
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
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
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Choose a chart image first." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json(
        { error: "Use a JPEG, PNG or WebP chart image." },
        { status: 415 },
      );
    }

    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "That image is too large. Retake it or choose a smaller screenshot." },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const dataUrl = "data:" + image.type + ";base64," + bytes.toString("base64");
    const analysis = await analyseImage(apiKey, dataUrl);

    if (!analysis.result) {
      console.error("[chart-scan] all vision models failed", analysis.failures);
      return NextResponse.json(
        { error: "StockGPT could not read that chart clearly. Try a tighter, sharper photo." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result: analysis.result,
      model_used: analysis.model,
      analysis_scope: "image_only",
    });
  } catch (error) {
    console.error("[chart-scan]", error);
    return NextResponse.json(
      { error: "Chart Scanner hit an unexpected error. Try again." },
      { status: 500 },
    );
  }
}
