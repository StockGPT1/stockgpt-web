import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isChartAnalysis, parseScanJson, runGroundedChartScan, type ChartLayout } from "@/lib/chart-scanner";
import { positivePrice } from "@/lib/chart-scan-scenario";
import { CHART_LAYOUT_PROMPT, CHART_ANALYSIS_PROMPT, CHART_REVIEW_INSTRUCTION } from "@/lib/chart-scanner-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_IMAGE_BYTES = 3_200_000;
const MAX_IMAGE_COUNT = 2;
const MAX_TOTAL_IMAGE_BYTES = 3_600_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PRIMARY_VISION_MODEL = "google/gemini-2.5-flash";
const REVIEW_VISION_MODEL = "anthropic/claude-sonnet-4.5";

type VisionFailure = { model: string; stage: string; status?: number; message: string };
type ProviderResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function isNativeApp(req: NextRequest) {
  return /StockGPTApp/i.test(req.headers.get("user-agent") ?? "");
}

async function requestVision(
  apiKey: string,
  model: string,
  dataUrls: string[],
  system: string,
  instruction: string,
  stage: string,
  failures: VisionFailure[],
) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(28_000),
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://stockgpt.pro",
        "X-Title": "StockGPT Chart Scanner",
      },
      body: JSON.stringify({
        model, temperature: 0.1, max_tokens: stage === "layout" ? 2400 : 4400,
        reasoning: { exclude: true },
        messages: [
          { role: "system", content: system },
          { role: "user", content: [
            { type: "text", text: instruction },
            ...dataUrls.map(url => ({ type: "image_url", image_url: { url } })),
          ] },
        ],
      }),
    });
    const payload = await response.json().catch(() => null) as ProviderResponse | null;
    const content = payload?.choices?.[0]?.message?.content;
    const value = typeof content === "string" ? parseScanJson(content) : null;
    if (!response.ok || !value || (stage !== "layout" && !isChartAnalysis(value))) {
      failures.push({ model, stage, status: response.status, message: payload?.error?.message ?? "No valid scanner JSON." });
      return { value: null, model };
    }
    return { value, model };
  } catch (error) {
    failures.push({ model, stage, message: error instanceof Error ? error.name : "Vision request failed." });
    return { value: null, model };
  }
}

async function analyseImages(apiKey: string, dataUrls: string[], referencePrice: number | null) {
  const failures: VisionFailure[] = [];
  let requests = 0;
  let analysisModel = PRIMARY_VISION_MODEL;
  const ask = (model: string, system: string, instruction: string, stage: string) => {
    requests += 1;
    return requestVision(apiKey, model, dataUrls, system, instruction, stage, failures);
  };
  const inventory = (layout: ChartLayout) => "Chart region inventory (check against images):\n" + JSON.stringify(layout) + (referencePrice !== null ? `\nUser-supplied reference price: ${referencePrice}. Use only as an anchor when image prices are unreadable; it does not confirm a technical level.` : "");
  const scan = await runGroundedChartScan({
    locate: () => ask(PRIMARY_VISION_MODEL, CHART_LAYOUT_PROMPT,
      "Map the real primary price plot and inventory every visible indicator in these images. Return JSON.", "layout"),
    analyse: async layout => {
      const instruction = inventory(layout) + "\nRead the price structure and each inventoried indicator. Return the analysis schema.";
      const primary = await ask(PRIMARY_VISION_MODEL, CHART_ANALYSIS_PROMPT, instruction, "analysis");
      if (primary.value) return primary;
      analysisModel = REVIEW_VISION_MODEL;
      return ask(REVIEW_VISION_MODEL, CHART_ANALYSIS_PROMPT, instruction, "analysis");
    },
    review: (layout, candidate) => ask(analysisModel === PRIMARY_VISION_MODEL ? REVIEW_VISION_MODEL : PRIMARY_VISION_MODEL, CHART_ANALYSIS_PROMPT,
      inventory(layout) + "\nCandidate analysis (untrusted until independently checked):\n" +
      JSON.stringify(candidate) + "\n" + CHART_REVIEW_INSTRUCTION, "review"),
  }, dataUrls.length, referencePrice);
  if (failures.length > 0) console.error("[chart-scan] vision pass failed", failures);
  return { result: scan?.result ?? null, model: scan?.model ?? null, passes: requests, failures };
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
    const referenceInput = formData.get("reference_price");
    const referencePrice = referenceInput ? positivePrice(referenceInput) : null;
    if (referenceInput && referencePrice === null) {
      return NextResponse.json({ error: "Enter a positive reference price, such as 125.50." }, { status: 400 });
    }
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
    const analysis = await analyseImages(apiKey, dataUrls, referencePrice);

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
