"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { StockIcon } from "@/components/StockIcon";
import { nativeHaptic } from "@/lib/ios-native";
import { buildAskHref } from "@/lib/ask-context";

type ScanResult = {
  verdict: "bullish" | "bearish" | "inconclusive";
  label: string;
  pattern: string;
  confidence: number;
  ticker: string | null;
  timeframe: string | null;
  summary: string;
  confirmation: string;
  invalidation: string;
  watch_for: string;
  observations: string[];
  levels: {
    support: string | null;
    resistance: string | null;
    breakout: string | null;
    invalidation: string | null;
  };
  overlay: {
    resistance_y_pct: number | null;
    support_y_pct: number | null;
    pattern_box: {
      x_pct: number | null;
      y_pct: number | null;
      width_pct: number | null;
      height_pct: number | null;
    } | null;
  };
};

type ScanResponse = {
  result?: ScanResult;
  error?: string;
};

const analysisSteps = [
  "Finding chart structure",
  "Reading support and resistance",
  "Scoring the setup",
];

async function imageFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";

    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read that image."));
    });

    image.src = objectUrl;
    return await loaded;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a chart image.");
  }

  const image = await imageFromFile(file);
  const maxDimension = 1600;
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not prepare that image.");

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });

  if (!blob) throw new Error("Could not prepare that image.");

  return new File([blob], "stockgpt-chart-scan.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function verdictTone(verdict: ScanResult["verdict"]) {
  if (verdict === "bullish") {
    return {
      badge: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
      glow: "shadow-[0_0_50px_rgba(52,211,153,0.11)]",
      dot: "bg-emerald-300",
    };
  }

  if (verdict === "bearish") {
    return {
      badge: "border-rose-300/25 bg-rose-300/10 text-rose-200",
      glow: "shadow-[0_0_50px_rgba(251,113,133,0.10)]",
      dot: "bg-rose-300",
    };
  }

  return {
    badge: "border-[#f2c35f]/22 bg-[#f2c35f]/8 text-[#f2d786]",
    glow: "shadow-[0_0_50px_rgba(242,195,95,0.08)]",
    dot: "bg-[#f2c35f]",
  };
}

function ScannerTarget() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[430px] overflow-hidden rounded-[30px] border border-[#f2c35f]/16 bg-[radial-gradient(circle_at_50%_34%,rgba(242,195,95,0.12),transparent_30%),linear-gradient(180deg,#0b2c1e,#06160f)] shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-[20px] rounded-[24px] border border-[#f2c35f]/10" />
      <div className="absolute left-[10%] right-[10%] top-1/2 h-px bg-[#f2c35f]/10" />
      <div className="absolute bottom-[14%] left-[12%] right-[12%] h-[54%]">
        <svg viewBox="0 0 320 160" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M5 132 C38 122 48 92 80 102 C110 112 118 69 150 78 C181 87 194 54 225 60 C255 66 267 27 315 20" stroke="rgba(242,195,95,0.74)" strokeWidth="4" strokeLinecap="round" />
          <path d="M5 139 H315" stroke="rgba(255,255,255,0.08)" />
          <path d="M5 94 H315" stroke="rgba(255,255,255,0.06)" />
          <path d="M5 49 H315" stroke="rgba(255,255,255,0.06)" />
        </svg>
      </div>
      <div className="absolute inset-0">
        <span className="absolute left-5 top-5 h-9 w-9 rounded-tl-[14px] border-l-2 border-t-2 border-[#f2c35f]/75" />
        <span className="absolute right-5 top-5 h-9 w-9 rounded-tr-[14px] border-r-2 border-t-2 border-[#f2c35f]/75" />
        <span className="absolute bottom-5 left-5 h-9 w-9 rounded-bl-[14px] border-b-2 border-l-2 border-[#f2c35f]/75" />
        <span className="absolute bottom-5 right-5 h-9 w-9 rounded-br-[14px] border-b-2 border-r-2 border-[#f2c35f]/75" />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid size-[74px] place-items-center rounded-full border border-[#f2c35f]/24 bg-[#04180f]/78 text-[#f2c35f] shadow-[0_12px_40px_rgba(0,0,0,0.36)] backdrop-blur-xl">
          <StockIcon name="camera" className="size-8" />
        </span>
      </div>
    </div>
  );
}

function Level({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 py-3">
      <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/38">{label}</p>
      <p className="mt-1 truncate text-[15px] font-black tracking-[-0.02em] text-[#faf6f0]">{value ?? "Not clear"}</p>
    </div>
  );
}

export function ChartScannerWorkspace() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "analyzing" | "result" | "error">("idle");
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (status !== "analyzing") {
      setStepIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % analysisSteps.length);
    }, 900);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const askHref = useMemo(() => {
    if (!result) return "/ask-stockgpt";

    return buildAskHref({
      contextType: "stock",
      ...(result.ticker ? { ticker: result.ticker } : {}),
      activeFilters: {
        chartScan: result.label,
        chartPattern: result.pattern,
        chartConfidence: result.confidence,
        chartConfirmation: result.confirmation,
        chartInvalidation: result.invalidation,
      },
    });
  }, [result]);

  async function runScan(file: File) {
    setError("");
    setResult(null);
    setStatus("analyzing");
    nativeHaptic("medium");

    const formData = new FormData();
    formData.set("image", file);

    try {
      const response = await fetch("/api/chart-scan", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as ScanResponse | null;

      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error || "StockGPT could not read that chart.");
      }

      setResult(payload.result);
      setStatus("result");
      nativeHaptic("success");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "StockGPT could not read that chart.");
      setStatus("error");
      nativeHaptic("error");
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;

    setStatus("preparing");
    setError("");

    try {
      const prepared = await prepareImage(selected);
      if (prepared.size > 3_200_000) {
        throw new Error("That image is still too large. Try a tighter screenshot.");
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const nextPreview = URL.createObjectURL(prepared);
      setPreviewUrl(nextPreview);
      setScanFile(prepared);
      await runScan(prepared);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Could not prepare that chart image.");
      setStatus("error");
      nativeHaptic("error");
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setScanFile(null);
    setResult(null);
    setError("");
    setStatus("idle");
    nativeHaptic("light");
  }

  const tone = result ? verdictTone(result.verdict) : null;
  const box = result?.overlay.pattern_box;
  const hasBox = box && box.x_pct !== null && box.y_pct !== null && box.width_pct !== null && box.height_pct !== null;

  return (
    <main className="sg-chart-scanner mx-auto min-h-full w-full max-w-[760px] pb-8 pt-2">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImage}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        onChange={handleImage}
        className="sr-only"
        tabIndex={-1}
      />

      {status === "idle" && (
        <section className="flex min-h-[calc(100dvh-190px)] flex-col justify-center py-5">
          <div className="mb-6 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f2c35f]/72">StockGPT Vision · V1</p>
            <h1 className="mt-2 max-w-[12ch] text-[38px] font-black leading-[0.96] tracking-[-0.055em] text-[#fffaf2]">
              Spot the setup in seconds.
            </h1>
            <p className="mt-3 max-w-[36rem] text-[14px] font-medium leading-6 text-[#fffaf2]/56">
              Point your iPhone at a stock chart or use a screenshot. StockGPT reads the visible pattern, key levels and what would confirm or kill the setup.
            </p>
          </div>

          <ScannerTarget />

          <div className="mt-6 grid gap-2.5">
            <button
              type="button"
              data-native-haptic="medium"
              onClick={() => cameraInputRef.current?.click()}
              className="flex h-14 items-center justify-center gap-2 rounded-[19px] bg-[linear-gradient(180deg,#f5d982,#d9ae50)] px-5 text-[14px] font-black text-[#092116] shadow-[0_14px_36px_rgba(221,177,89,0.18)] transition active:scale-[0.985]"
            >
              <StockIcon name="camera" className="size-5" />
              Open camera
            </button>

            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="h-12 rounded-[18px] border border-[#fffaf2]/8 bg-[#fffaf2]/[0.045] px-5 text-[13px] font-black text-[#fffaf2]/78 transition active:scale-[0.985]"
            >
              Choose a screenshot
            </button>
          </div>

          <p className="mt-4 px-2 text-center text-[10.5px] leading-4 text-[#fffaf2]/32">
            Image-only analysis for now. V1 does not verify the chart against live market data and is not a trade signal.
          </p>
        </section>
      )}

      {(status === "preparing" || status === "analyzing") && previewUrl && (
        <section className="flex min-h-[calc(100dvh-190px)] flex-col justify-center py-5">
          <div className="mb-4 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2c35f]/68">Scanning chart</p>
            <h1 className="mt-1 text-[31px] font-black tracking-[-0.045em] text-[#fffaf2]">
              {status === "preparing" ? "Preparing image…" : analysisSteps[stepIndex]}
            </h1>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-[#f2c35f]/16 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <img src={previewUrl} alt="Chart being scanned" className="max-h-[58dvh] w-full object-contain" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,24,15,0.06),rgba(4,24,15,0.18))]" />
            <span className="sg-chart-scan-laser absolute inset-x-0 h-px bg-[#f5d982] shadow-[0_0_18px_rgba(245,217,130,0.95)]" />
            <span className="absolute inset-[12px] rounded-[20px] border border-[#f2c35f]/20" />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold text-[#fffaf2]/42">
            <span className="size-1.5 animate-pulse rounded-full bg-[#f2c35f]" />
            Visual pattern analysis · no live-data verification
          </div>
        </section>
      )}

      {status === "error" && (
        <section className="flex min-h-[calc(100dvh-190px)] flex-col justify-center py-5">
          {previewUrl && (
            <div className="mb-5 overflow-hidden rounded-[26px] border border-[#fffaf2]/8 bg-black/40">
              <img src={previewUrl} alt="Chart scan" className="max-h-[48dvh] w-full object-contain opacity-70" />
            </div>
          )}
          <div className="rounded-[26px] border border-rose-300/12 bg-rose-300/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-rose-200/65">Scan failed</p>
            <p className="mt-2 text-[19px] font-black tracking-[-0.025em] text-[#fffaf2]">{error}</p>
            <p className="mt-2 text-[12px] leading-5 text-[#fffaf2]/45">A tighter crop with visible candles and price levels usually works best.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => scanFile && void runScan(scanFile)}
              disabled={!scanFile}
              className="h-12 rounded-[18px] bg-[#f2c35f] px-4 text-[13px] font-black text-[#092116] disabled:opacity-40"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-12 rounded-[18px] border border-[#fffaf2]/9 bg-[#fffaf2]/[0.045] px-4 text-[13px] font-black text-[#fffaf2]/76"
            >
              New chart
            </button>
          </div>
        </section>
      )}

      {status === "result" && result && previewUrl && tone && (
        <section className="pb-4 pt-1">
          <div className="relative overflow-hidden rounded-[28px] border border-[#f2c35f]/14 bg-black">
            <img src={previewUrl} alt="Scanned stock chart" className="max-h-[54dvh] w-full object-contain" />

            {result.overlay.resistance_y_pct !== null && (
              <span
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#f2c35f]/80"
                style={{ top: result.overlay.resistance_y_pct + "%" }}
              >
                <span className="absolute right-2 -top-6 rounded-full bg-[#0a2016]/88 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#f2d786] backdrop-blur">
                  Resistance
                </span>
              </span>
            )}

            {result.overlay.support_y_pct !== null && (
              <span
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-emerald-300/70"
                style={{ top: result.overlay.support_y_pct + "%" }}
              >
                <span className="absolute left-2 -top-6 rounded-full bg-[#0a2016]/88 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-200 backdrop-blur">
                  Support
                </span>
              </span>
            )}

            {hasBox && (
              <span
                className="pointer-events-none absolute rounded-[14px] border border-[#f2c35f]/70 bg-[#f2c35f]/[0.035] shadow-[0_0_30px_rgba(242,195,95,0.10)]"
                style={{
                  left: box.x_pct + "%",
                  top: box.y_pct + "%",
                  width: box.width_pct + "%",
                  height: box.height_pct + "%",
                }}
              />
            )}

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#04180f]/82 px-3 py-1.5 backdrop-blur-xl">
              <span className="size-1.5 rounded-full bg-[#f2c35f]" />
              <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#fffaf2]/72">AI visual read</span>
            </div>
          </div>

          <div className={"relative -mt-2 rounded-t-[30px] bg-[#061b12] px-1 pt-5 " + tone.glow}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className={"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] " + tone.badge}>
                  <span className={"size-1.5 rounded-full " + tone.dot} />
                  {result.label}
                </div>
                <h1 className="mt-3 text-[31px] font-black leading-none tracking-[-0.045em] text-[#fffaf2]">{result.pattern}</h1>
                <p className="mt-2 text-[12px] font-bold text-[#fffaf2]/42">
                  {[result.ticker, result.timeframe].filter(Boolean).join(" · ") || "Ticker/timeframe not confidently visible"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#fffaf2]/34">Pattern confidence</p>
                <p className="mt-1 text-[36px] font-black leading-none tracking-[-0.055em] text-[#f2d786]">{result.confidence}%</p>
              </div>
            </div>

            <p className="mt-5 max-w-[42rem] text-[14px] font-medium leading-6 text-[#fffaf2]/66">{result.summary}</p>

            <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-[#fffaf2]/[0.055] border-y border-[#fffaf2]/[0.055]">
              <div className="pr-4"><Level label="Breakout" value={result.levels.breakout} /></div>
              <div className="pl-4"><Level label="Invalidation" value={result.levels.invalidation} /></div>
              <div className="pr-4"><Level label="Support" value={result.levels.support} /></div>
              <div className="pl-4"><Level label="Resistance" value={result.levels.resistance} /></div>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/68">Confirmation</p>
                <p className="mt-1.5 text-[13px] font-semibold leading-5 text-[#fffaf2]/72">{result.confirmation}</p>
              </div>
              <div>
                <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/68">Invalidation</p>
                <p className="mt-1.5 text-[13px] font-semibold leading-5 text-[#fffaf2]/72">{result.invalidation}</p>
              </div>

              {result.observations.length > 0 && (
                <div className="border-t border-[#fffaf2]/[0.055] pt-5">
                  <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#fffaf2]/34">What StockGPT sees</p>
                  <div className="mt-3 space-y-2.5">
                    {result.observations.map((observation, index) => (
                      <div key={observation + index} className="flex gap-3">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#f2c35f]/70" />
                        <p className="text-[12.5px] font-medium leading-5 text-[#fffaf2]/61">{observation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[22px] bg-[#0a2a1d]/78 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/60">Watch next</p>
                <p className="mt-1.5 text-[14px] font-black leading-5 tracking-[-0.015em] text-[#fffaf2]">{result.watch_for}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-2.5">
              <Link
                href={askHref}
                prefetch={false}
                data-native-haptic="medium"
                className="flex h-14 items-center justify-center gap-2 rounded-[19px] bg-[linear-gradient(180deg,#f5d982,#d9ae50)] px-5 text-[13px] font-black text-[#092116] shadow-[0_14px_36px_rgba(221,177,89,0.16)] transition active:scale-[0.985]"
              >
                <StockIcon name="ask" className="size-5" />
                Ask StockGPT about this setup
              </Link>

              <button
                type="button"
                onClick={reset}
                className="h-12 rounded-[18px] border border-[#fffaf2]/8 bg-[#fffaf2]/[0.04] px-5 text-[12px] font-black text-[#fffaf2]/65 transition active:scale-[0.985]"
              >
                Scan another chart
              </button>
            </div>

            <p className="mt-4 text-center text-[10px] leading-4 text-[#fffaf2]/28">
              Confidence scores the visual pattern read, not the chance of profit. V1 is image-only and can be wrong.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
