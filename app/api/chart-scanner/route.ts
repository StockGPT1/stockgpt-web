import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, rateKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScannerVerdict = "bullish" | "bearish" | "inconclusive";
type ScannerLevelKind = "support" | "resistance" | "breakout" | "invalidation";

type ScannerLevel = {
  kind: ScannerLevelKind;
  label: string;
  value: string | null;
  yPct: number | null;
};

type PatternLine = {
  label: string;
  x1Pct: number;
  y1Pct: number;
  x2Pct: number;
  y2Pct: number;
};

type ScannerSignal = {
  label: string;
  sentiment: "positive" | "negative" | "neutral";
};

type ScannerAnalysis = {
  verdict: ScannerVerdict;
  confidence: number;
  pattern: string;
  ticker: string | null;
  timeframe: string | null;
  headline: string;
  summary: string;
  confirmation: string;
  invalidation: string;
  levels: ScannerLevel[];
  patternLines: PatternLine[];
  signals: ScannerSignal[];
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: { message?: string };
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const DEFAULT_VISION_MODELS = [
  "google/gemini-3-flash-preview",
  "openai/gpt-5",
  "anthropic/claude-sonnet-4.5",
];

function visionModels() {
  const configured = [
    process.env.CHART_SCANNER_MODEL,
    ...(process.env.CHART_SCANNER_FALLBACK_MODELS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set([...configured, ...DEFAULT_VISION_MODELS]));
}

function clamp(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function cleanText(value: unknown, max = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanOptionalText(value: unknown, max = 80) {
  const cleaned = cleanText(value, max);
  return cleaned || null;
}

function cleanTicker(value: unknown) {
  const cleaned = cleanText(value, 16)
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
  return cleaned || null;
}

function cleanVerdict(value: unknown): ScannerVerdict {
  const verdict = cleanText(value, 20).toLowerCase();
  if (verdict === "bullish" || verdict === "bearish") return verdict;
  return "inconclusive";
}

function cleanLevelKind(value: unknown): ScannerLevelKind | null {
  const kind = cleanText(value, 30).toLowerCase();
  if (
    kind === "support" ||
    kind === "resistance" ||
    kind === "breakout" ||
    kind === "invalidation"
  ) {
    return kind;
  }
  return null;
}

function extractJson(text: string) {
  const stripped = text
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normaliseAnalysis(raw: Record<string, unknown>): ScannerAnalysis {
  const levels = Array.isArray(raw.levels)
    ? raw.levels
        .slice(0, 6)
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const input = item as Record<string, unknown>;
          const kind = cleanLevelKind(input.kind);
          const label = cleanText(input.label, 48);
          if (!kind || !label) return null;

          return {
            kind,
            label,
            value: cleanOptionalText(input.value, 32),
            yPct: clamp(input.y_pct ?? input.yPct, 2, 98),
          } satisfies ScannerLevel;
        })
        .filter((item): item is ScannerLevel => Boolean(item))
    : [];

  const patternLines = Array.isArray(raw.pattern_lines ?? raw.patternLines)
    ? ((raw.pattern_lines ?? raw.patternLines) as unknown[])
        .slice(0, 4)
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const input = item as Record<string, unknown>;
          const x1Pct = clamp(input.x1_pct ?? input.x1Pct, 0, 100);
          const y1Pct = clamp(input.y1_pct ?? input.y1Pct, 0, 100);
          const x2Pct = clamp(input.x2_pct ?? input.x2Pct, 0, 100);
          const y2Pct = clamp(input.y2_pct ?? input.y2Pct, 0, 100);
          if (
            x1Pct === null ||
            y1Pct === null ||
            x2Pct === null ||
            y2Pct === null
          ) {
            return null;
          }

          return {
            label: cleanText(input.label, 48) || "Pattern line",
            x1Pct,
            y1Pct,
            x2Pct,
            y2Pct,
          } satisfies PatternLine;
        })
        .filter((item): item is PatternLine => Boolean(item))
    : [];

  const signals = Array.isArray(raw.signals)
    ? raw.signals
        .slice(0, 4)
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const input = item as Record<string, unknown>;
          const label = cleanText(input.label, 72);
          if (!label) return null;
          const rawSentiment = cleanText(input.sentiment, 20).toLowerCase();
          const sentiment =
            rawSentiment === "positive" || rawSentiment === "negative"
              ? rawSentiment
              : "neutral";

          return { label, sentiment } satisfies ScannerSignal;
        })
        .filter((item): item is ScannerSignal => Boolean(item))
    : [];

  return {
    verdict: cleanVerdict(raw.verdict),
    confidence: Math.round(clamp(raw.confidence, 0, 100) ?? 0),
    pattern: cleanText(raw.pattern, 80) || "No clear pattern",
    ticker: cleanTicker(raw.ticker),
    timeframe: cleanOptionalText(raw.timeframe, 32),
    headline:
      cleanText(raw.headline, 120) ||
      "The chart needs a cleaner setup before there is a strong technical read.",
    summary:
      cleanText(raw.summary, 620) ||
      "StockGPT could not extract enough reliable structure from this image.",
    confirmation:
      cleanText(raw.confirmation, 280) ||
      "Wait for a clearer price break or rejection before treating the setup as confirmed.",
    invalidation:
      cleanText(raw.invalidation, 280) ||
      "The setup is invalid if price decisively breaks the structure identified in the image.",
    levels,
    patternLines,
    signals,
  };
}

function contentToText(content: OpenRouterResponse["choices"][number]["message"]["content"]) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (part?.type === "text" ? part.text ?? "" : ""))
    .join("\n")
    .trim();
}

const SCANNER_PROMPT = `
You are StockGPT Chart Scanner V1. Analyse ONLY the chart image supplied by the user.

Your job is to identify visible technical structure from the pixels: support, resistance, trend structure, common chart patterns, momentum clues that are visible in price action, and any ticker/timeframe text that is clearly readable.

Important product rules:
- This is image-only analysis. You do NOT have live market data and must never imply that you verified the chart against current prices.
- Never invent a ticker, timeframe, price level, indicator reading or pattern.
- If the chart is cropped, blurry, not a price chart, or does not show a clear setup, use "inconclusive".
- Confidence means confidence that the IMAGE supports the pattern classification. It is NOT a probability of profit or future return.
- Do not issue a "BUY", "SELL", "guaranteed", "moon", or certainty-style call.
- Prefer the language "bullish setup", "bearish setup", "inconclusive", "confirmation", "invalidation", and "watch for".
- Keep the explanation punchy and beginner-friendly.

Return JSON only. No Markdown fences, no prose outside JSON.

Schema:
{
  "verdict": "bullish" | "bearish" | "inconclusive",
  "confidence": 0-100,
  "pattern": "short pattern name",
  "ticker": "visible ticker or null",
  "timeframe": "visible timeframe or null",
  "headline": "short, exciting but responsible verdict line",
  "summary": "2-4 concise sentences explaining the visible setup",
  "confirmation": "what price action would confirm this setup; include a visible price level only if genuinely readable",
  "invalidation": "what would invalidate this setup; include a visible price level only if genuinely readable",
  "levels": [
    {
      "kind": "support" | "resistance" | "breakout" | "invalidation",
      "label": "short label",
      "value": "visible price text or null",
      "y_pct": 0-100
    }
  ],
  "pattern_lines": [
    {
      "label": "short label",
      "x1_pct": 0-100,
      "y1_pct": 0-100,
      "x2_pct": 0-100,
      "y2_pct": 0-100
    }
  ],
  "signals": [
    {
      "label": "short visible clue",
      "sentiment": "positive" | "negative" | "neutral"
    }
  ]
}

Coordinate rules:
- Coordinates are percentages of the full supplied image, origin at top-left.
- y_pct should visually align with the level on the screenshot.
- Only return pattern_lines when you can place them with reasonable confidence.
- Return at most 6 levels, 4 pattern lines and 4 signals.
`.trim();

async function analyseWithOpenRouter(apiKey: string, dataUrl: string) {
  const failures: Array<{ model: string; status?: number; message: string }> = [];

  for (const model of visionModels()) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://stockgpt.pro",
          "X-Title": "StockGPT Chart Scanner",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: SCANNER_PROMPT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0.15,
          max_tokens: 1800,
          reasoning: { exclude: true },
        }),
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;
      const text = contentToText(payload?.choices?.[0]?.message?.content);
      const parsed = text ? extractJson(text) : null;

      if (response.ok && parsed) {
        return {
          analysis: normaliseAnalysis(parsed),
          model,
          failures,
        };
      }

      failures.push({
        model,
        status: response.status,
        message:
          payload?.error?.message ||
          (text ? "Vision model returned invalid JSON." : "Vision model returned no analysis."),
      });
    } catch (error) {
      failures.push({
        model,
        message: error instanceof Error ? error.message : "Vision request failed.",
      });
    }
  }

  return { analysis: null, model: null, failures };
}

export async function POST(req: NextRequest) {
  try {
    const userAgent = req.headers.get("user-agent") ?? "";
    if (!userAgent.includes("StockGPTApp")) {
      return NextResponse.json(
        { error: "Chart Scanner is currently available in the StockGPT iOS app only." },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to use Chart Scanner." }, { status: 401 });
    }

    if (process.env.NODE_ENV !== "development") {
      const limit = await checkRateLimit({
        action: "chart_scanner_analysis",
        key: rateKey(["chart-scanner", user.id]),
        limit: 12,
        windowSeconds: 60 * 60,
      });

      if (!limit.allowed) {
        return NextResponse.json(
          {
            error:
              "You have scanned a lot of charts this hour. Give the scanner a short break, then try again.",
          },
          {
            status: 429,
            headers: { "Retry-After": String(limit.retryAfterSeconds) },
          },
        );
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chart Scanner is not connected to the AI service yet." },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const upload = formData.get("chart");

    if (!(upload instanceof File)) {
      return NextResponse.json({ error: "Choose a chart image first." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(upload.type)) {
      return NextResponse.json(
        { error: "Use a JPG, PNG or WebP chart image." },
        { status: 415 },
      );
    }

    if (upload.size <= 0 || upload.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "That image is too large. Use a chart image under 6 MB." },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await upload.arrayBuffer());
    const dataUrl = `data:${upload.type};base64,${bytes.toString("base64")}`;
    const result = await analyseWithOpenRouter(apiKey, dataUrl);

    if (!result.analysis) {
      console.error("[chart-scanner] all vision models failed", result.failures);
      return NextResponse.json(
        {
          error: "StockGPT could not read that chart cleanly. Try a sharper, tighter screenshot.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      analysis: result.analysis,
      analysedAt: new Date().toISOString(),
      mode: "image_only_v1",
      model: result.model,
    });
  } catch (error) {
    console.error("[chart-scanner]", error);
    return NextResponse.json(
      { error: "Chart Scanner hit an unexpected error. Try the image again." },
      { status: 500 },
    );
  }
}
