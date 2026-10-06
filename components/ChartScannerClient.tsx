"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { nativeHaptic } from "@/lib/ios-native";

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

type ScannerResponse = {
  analysis?: ScannerAnalysis;
  analysedAt?: string;
  mode?: "image_only_v1";
  error?: string;
};

const analysisPhases = [
  "Reading price structure",
  "Mapping support & resistance",
  "Testing the pattern",
  "Building the verdict",
];

function verdictLabel(verdict: ScannerVerdict) {
  if (verdict === "bullish") return "Bullish setup";
  if (verdict === "bearish") return "Bearish setup";
  return "Inconclusive";
}

function verdictClasses(verdict: ScannerVerdict) {
  if (verdict === "bullish") {
    return "border-emerald-300/28 bg-emerald-400/12 text-emerald-200";
  }
  if (verdict === "bearish") {
    return "border-rose-300/28 bg-rose-400/12 text-rose-200";
  }
  return "border-[#e8c66f]/30 bg-[#e8c66f]/10 text-[#f0d98f]";
}

function levelClasses(kind: ScannerLevelKind) {
  if (kind === "support") return "text-emerald-300";
  if (kind === "invalidation") return "text-rose-300";
  if (kind === "breakout") return "text-[#f2c35f]";
  return "text-[#fff3c4]";
}

function signalClasses(sentiment: ScannerSignal["sentiment"]) {
  if (sentiment === "positive") {
    return "border-emerald-300/16 bg-emerald-400/[0.08] text-emerald-200/90";
  }
  if (sentiment === "negative") {
    return "border-rose-300/16 bg-rose-400/[0.08] text-rose-200/90";
  }
  return "border-white/[0.08] bg-white/[0.035] text-[#fffaf2]/62";
}

async function imageElementForFile(file: File) {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode this image."));
      element.src = url;
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareChartImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a chart image.");
  }

  try {
    const image = await imageElementForFile(file);
    const maxDimension = 2048;
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this image.");

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.91);
    });

    if (!blob) throw new Error("Could not prepare this image.");

    return new File([blob], `stockgpt-chart-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    if (
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      file.size <= 6 * 1024 * 1024
    ) {
      return file;
    }

    throw error instanceof Error
      ? error
      : new Error("Use a JPG, PNG or WebP chart image.");
  }
}

function buildAskHref(analysis: ScannerAnalysis) {
  const visibleIdentity = [analysis.ticker, analysis.timeframe].filter(Boolean).join(" ");
  const question = [
    visibleIdentity ? `I scanned a ${visibleIdentity} chart.` : "I scanned a stock chart.",
    `Chart Scanner called it a ${verdictLabel(analysis.verdict).toLowerCase()} with ${analysis.confidence}% pattern confidence.`,
    `Pattern: ${analysis.pattern}.`,
    `Confirmation: ${analysis.confirmation}`,
    `Invalidation: ${analysis.invalidation}`,
    "Explain what would confirm or fail this setup and what I should watch next. Do not assume the image was verified against live market data.",
  ].join(" ");

  return `/ask-stockgpt?question=${encodeURIComponent(question)}`;
}

function CameraGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function ChartScannerClient() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState<ScannerAnalysis | null>(null);
  const [analysedAt, setAnalysedAt] = useState<string | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");

  const askHref = useMemo(
    () => (analysis ? buildAskHref(analysis) : "/ask-stockgpt"),
    [analysis],
  );

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!analysing) {
      setPhaseIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, analysisPhases.length - 1));
    }, 1050);

    return () => window.clearInterval(timer);
  }, [analysing]);

  async function chooseFile(file: File | null) {
    if (!file) return;

    setError("");
    setAnalysis(null);
    setAnalysedAt(null);
    setPreparing(true);
    void nativeHaptic("light");

    try {
      const prepared = await prepareChartImage(file);
      setImageFile(prepared);
    } catch (selectionError) {
      setImageFile(null);
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "StockGPT could not open that image.",
      );
      void nativeHaptic("error");
    } finally {
      setPreparing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }

  async function analyseChart() {
    if (!imageFile || analysing) return;

    setError("");
    setAnalysing(true);
    setAnalysis(null);
    setAnalysedAt(null);
    void nativeHaptic("medium");

    try {
      const formData = new FormData();
      formData.set("chart", imageFile);

      const response = await fetch("/api/chart-scanner", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as ScannerResponse | null;

      if (!response.ok || !payload?.analysis) {
        throw new Error(
          payload?.error ||
            "StockGPT could not read that chart cleanly. Try a sharper screenshot.",
        );
      }

      setAnalysis(payload.analysis);
      setAnalysedAt(payload.analysedAt ?? new Date().toISOString());
      void nativeHaptic("success");
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Chart Scanner could not analyse this image.",
      );
      void nativeHaptic("error");
    } finally {
      setAnalysing(false);
    }
  }

  function resetScanner() {
    setImageFile(null);
    setAnalysis(null);
    setAnalysedAt(null);
    setError("");
    setPhaseIndex(0);
    void nativeHaptic("light");
  }

  return (
    <main className="sg-chart-scanner mx-auto flex min-h-full w-full max-w-[680px] flex-col pb-5 pt-2">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
      />

      {!imageFile ? (
        <section className="flex min-h-[calc(100dvh-190px)] flex-col justify-between py-4">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e8c66f]/16 bg-[#e8c66f]/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#e8c66f]/88">
              <span className="size-1.5 rounded-full bg-[#e8c66f] shadow-[0_0_14px_rgba(232,198,111,0.85)]" />
              Chart Scanner · V1
            </div>

            <h1 className="max-w-[360px] text-[38px] font-black leading-[0.98] tracking-[-0.055em] text-[#fffaf2]">
              Point. Scan.
              <span className="block text-[#e8c66f]">Read the setup.</span>
            </h1>
            <p className="mt-4 max-w-[410px] text-[14px] font-medium leading-6 text-[#fffaf2]/52">
              Snap a candlestick chart or import a screenshot. StockGPT will map the visible structure, call the setup and show what would confirm or kill it.
            </p>
          </div>

          <button
            type="button"
            data-native-haptic="medium"
            onClick={() => cameraInputRef.current?.click()}
            disabled={preparing}
            className="group relative my-8 flex min-h-[300px] w-full items-center justify-center overflow-hidden rounded-[32px] border border-[#e8c66f]/20 bg-[radial-gradient(circle_at_50%_36%,rgba(232,198,111,0.10),transparent_30%),linear-gradient(180deg,rgba(12,47,32,0.94),rgba(3,18,12,0.98))] shadow-[0_26px_80px_rgba(0,0,0,0.38)] transition active:scale-[0.985] disabled:opacity-60"
          >
            <span className="pointer-events-none absolute inset-5 rounded-[24px] border border-dashed border-[#fffaf2]/10" />
            <span className="pointer-events-none absolute left-5 top-5 h-10 w-10 rounded-tl-[18px] border-l-2 border-t-2 border-[#e8c66f]/72" />
            <span className="pointer-events-none absolute right-5 top-5 h-10 w-10 rounded-tr-[18px] border-r-2 border-t-2 border-[#e8c66f]/72" />
            <span className="pointer-events-none absolute bottom-5 left-5 h-10 w-10 rounded-bl-[18px] border-b-2 border-l-2 border-[#e8c66f]/72" />
            <span className="pointer-events-none absolute bottom-5 right-5 h-10 w-10 rounded-br-[18px] border-b-2 border-r-2 border-[#e8c66f]/72" />

            <span className="relative flex flex-col items-center">
              <span className="grid size-[78px] place-items-center rounded-full border border-[#e8c66f]/26 bg-[#e8c66f]/10 text-[#f4d986] shadow-[0_0_44px_rgba(232,198,111,0.12)] transition group-active:scale-95">
                <CameraGlyph />
              </span>
              <span className="mt-5 text-[20px] font-black tracking-[-0.03em] text-[#fffaf2]">
                {preparing ? "Preparing image…" : "Open camera"}
              </span>
              <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.11em] text-[#fffaf2]/36">
                Get the whole chart in frame
              </span>
            </span>
          </button>

          <div>
            <button
              type="button"
              data-native-haptic="light"
              onClick={() => libraryInputRef.current?.click()}
              disabled={preparing}
              className="flex h-14 w-full items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-[13px] font-black text-[#fffaf2]/82 transition active:scale-[0.985]"
            >
              Use a screenshot instead
            </button>
            <p className="mt-4 px-3 text-center text-[10.5px] font-medium leading-4 text-[#fffaf2]/28">
              Image-only technical analysis. No live-market verification in V1.
            </p>
          </div>
        </section>
      ) : (
        <section className="space-y-5 pb-2">
          <div className="relative -mx-1 overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#020906] shadow-[0_26px_80px_rgba(0,0,0,0.42)]">
            <div className="relative min-h-[330px] w-full bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Chart selected for StockGPT analysis"
                className="block max-h-[62dvh] min-h-[330px] w-full object-contain"
              />

              {analysing && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-[#04180f]/20 backdrop-saturate-125" />
                  <div className="sg-chart-scan-line absolute inset-x-0 h-px bg-[#f2c35f] shadow-[0_0_16px_rgba(242,195,95,0.95),0_0_40px_rgba(242,195,95,0.38)]" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020906] via-[#020906]/72 to-transparent px-5 pb-5 pt-16">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2c35f]">
                      Analysing chart
                    </p>
                    <p className="mt-1 text-[18px] font-black tracking-[-0.025em] text-[#fffaf2]">
                      {analysisPhases[phaseIndex]}…
                    </p>
                  </div>
                </div>
              )}

              {analysis && (
                <div className="pointer-events-none absolute inset-0">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {analysis.patternLines.map((line, index) => (
                      <line
                        key={`${line.label}-${index}`}
                        x1={line.x1Pct}
                        y1={line.y1Pct}
                        x2={line.x2Pct}
                        y2={line.y2Pct}
                        vectorEffect="non-scaling-stroke"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="text-[#f2c35f]"
                        stroke="currentColor"
                        opacity="0.88"
                      />
                    ))}
                  </svg>

                  {analysis.levels.map((level, index) =>
                    level.yPct === null ? null : (
                      <div
                        key={`${level.kind}-${level.label}-${index}`}
                        className={`absolute inset-x-0 ${levelClasses(level.kind)}`}
                        style={{ top: `${level.yPct}%` }}
                      >
                        <span className="absolute inset-x-0 top-0 border-t border-current opacity-65" />
                        <span className="absolute right-2 top-[-11px] rounded-full border border-current/25 bg-[#020906]/88 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] backdrop-blur-md">
                          {level.label}
                          {level.value ? ` · ${level.value}` : ""}
                        </span>
                      </div>
                    ),
                  )}

                  <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.11em] backdrop-blur-xl ${verdictClasses(analysis.verdict)}`}
                    >
                      {verdictLabel(analysis.verdict)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!analysis && !analysing && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4 px-1">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#e8c66f]/72">
                    Image ready
                  </p>
                  <h2 className="mt-1 text-[24px] font-black tracking-[-0.04em] text-[#fffaf2]">
                    Find the setup
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetScanner}
                  className="rounded-full border border-white/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[0.09em] text-[#fffaf2]/48"
                >
                  Retake
                </button>
              </div>

              <button
                type="button"
                data-native-haptic="medium"
                onClick={() => void analyseChart()}
                className="flex h-[58px] w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#f3d77e,#d8ad4f)] text-[14px] font-black text-[#07150e] shadow-[0_14px_42px_rgba(216,173,79,0.18),inset_0_1px_0_rgba(255,255,255,0.48)] transition active:scale-[0.985]"
              >
                Analyse this chart
              </button>
            </div>
          )}

          {analysis && (
            <div className="px-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] ${verdictClasses(analysis.verdict)}`}>
                  {verdictLabel(analysis.verdict)}
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.09em] text-[#fffaf2]/56">
                  {analysis.confidence}% pattern confidence
                </span>
                {(analysis.ticker || analysis.timeframe) && (
                  <span className="rounded-full border border-[#e8c66f]/13 bg-[#e8c66f]/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.09em] text-[#e8c66f]/72">
                    {[analysis.ticker, analysis.timeframe].filter(Boolean).join(" · ")} · from image
                  </span>
                )}
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-[#e8c66f]/64">
                {analysis.pattern}
              </p>
              <h2 className="mt-1 max-w-[560px] text-[30px] font-black leading-[1.03] tracking-[-0.045em] text-[#fffaf2]">
                {analysis.headline}
              </h2>
              <p className="mt-3 max-w-[590px] text-[14px] font-medium leading-6 text-[#fffaf2]/58">
                {analysis.summary}
              </p>

              <div className="mt-6 grid grid-cols-2 border-y border-white/[0.065]">
                <div className="py-5 pr-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300/70">
                    Confirmation
                  </p>
                  <p className="mt-2 text-[12.5px] font-bold leading-5 text-[#fffaf2]/78">
                    {analysis.confirmation}
                  </p>
                </div>
                <div className="border-l border-white/[0.065] py-5 pl-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-300/70">
                    Invalidation
                  </p>
                  <p className="mt-2 text-[12.5px] font-bold leading-5 text-[#fffaf2]/78">
                    {analysis.invalidation}
                  </p>
                </div>
              </div>

              {analysis.signals.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#fffaf2]/32">
                    What it sees
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.signals.map((signal, index) => (
                      <span
                        key={`${signal.label}-${index}`}
                        className={`rounded-full border px-3 py-2 text-[10px] font-extrabold ${signalClasses(signal.sentiment)}`}
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-7 space-y-3">
                <Link
                  href={askHref}
                  prefetch={false}
                  data-native-haptic="light"
                  className="flex h-[58px] w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#f3d77e,#d8ad4f)] px-5 text-center text-[13px] font-black text-[#07150e] shadow-[0_14px_42px_rgba(216,173,79,0.16),inset_0_1px_0_rgba(255,255,255,0.46)] transition active:scale-[0.985]"
                >
                  Ask StockGPT about this setup
                </Link>
                <button
                  type="button"
                  onClick={resetScanner}
                  className="flex h-13 w-full items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-[12px] font-black text-[#fffaf2]/62 transition active:scale-[0.985]"
                >
                  Scan another chart
                </button>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-[18px] bg-white/[0.025] px-3 py-3">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#e8c66f]/60" />
                <p className="text-[10.5px] font-medium leading-4 text-[#fffaf2]/34">
                  V1 reads the image only. Pattern confidence measures how clearly the pixels support the setup — not the chance of making money. Live chart verification comes later.
                  {analysedAt ? ` Analysed ${new Date(analysedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : ""}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[20px] border border-rose-300/12 bg-rose-400/[0.06] px-4 py-3 text-[12px] font-bold leading-5 text-rose-100/82">
              {error}
            </div>
          )}
        </section>
      )}

      {!imageFile && error && (
        <div className="mt-2 rounded-[20px] border border-rose-300/12 bg-rose-400/[0.06] px-4 py-3 text-[12px] font-bold leading-5 text-rose-100/82">
          {error}
        </div>
      )}
    </main>
  );
}
