"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  current_price: string | null;
  retake_required: boolean;
  retake_reason: string | null;
  needs_more_info: boolean;
  more_info_prompt: string | null;
  price_series_type: "candles" | "price_line" | "unsupported" | "unknown";
  chart_coverage: "full" | "partial" | "unclear";
  signals: Array<{
    name: string;
    bias: "bullish" | "bearish" | "neutral";
    confidence: number;
    evidence: string;
    box: {
      x_pct: number | null;
      y_pct: number | null;
      width_pct: number | null;
      height_pct: number | null;
    } | null;
  }>;
  trade_plan: {
    entry: string | null;
    stop_loss: string | null;
    take_profit: string | null;
    risk_reward: string | null;
    projected_bars: string | null;
    projected_horizon: string | null;
    plan: string | null;
    rationale: string | null;
  };
  levels: {
    support: string | null;
    resistance: string | null;
    breakout: string | null;
    invalidation: string | null;
  };
  overlay: {
    resistance_y_pct: number | null;
    support_y_pct: number | null;
    price_plot_box: {
      x_pct: number;
      y_pct: number;
      width_pct: number;
      height_pct: number;
    } | null;
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
  "Reading current price",
  "Mapping support and resistance",
  "Scanning chart patterns",
  "Checking visible indicators",
  "Building risk levels",
  "Estimating trade horizon",
  "Cross-checking directional bias",
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
  const targetBytes = 1_650_000;
  const attempts = [
    { maxDimension: 1500, quality: 0.8 },
    { maxDimension: 1320, quality: 0.7 },
    { maxDimension: 1160, quality: 0.62 },
  ];

  let latestBlob: Blob | null = null;

  for (const attempt of attempts) {
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = largestSide > attempt.maxDimension ? attempt.maxDimension / largestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Could not prepare that image.");

    context.drawImage(image, 0, 0, width, height);

    latestBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", attempt.quality);
    });

    if (!latestBlob) throw new Error("Could not prepare that image.");
    if (latestBlob.size <= targetBytes) break;
  }

  if (!latestBlob) throw new Error("Could not prepare that image.");

  return new File([latestBlob], "stockgpt-chart-scan.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function resetIOSViewportAfterPicker() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();

  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) return;

  const normalViewport = "width=device-width, initial-scale=1, viewport-fit=cover";
  const resetViewport =
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

  viewport.setAttribute("content", resetViewport);

  const restore = () => {
    viewport.setAttribute("content", normalViewport);
    document.documentElement.style.setProperty("-webkit-text-size-adjust", "100%");
    window.dispatchEvent(new Event("resize"));
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(restore);
  });
  window.setTimeout(restore, 320);
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

function signalTone(bias: "bullish" | "bearish" | "neutral") {
  if (bias === "bullish") {
    return {
      border: "border-emerald-300/85",
      bg: "bg-emerald-300/10",
      text: "text-emerald-200",
      dot: "bg-emerald-300",
    };
  }
  if (bias === "bearish") {
    return {
      border: "border-rose-300/85",
      bg: "bg-rose-300/10",
      text: "text-rose-200",
      dot: "bg-rose-300",
    };
  }
  return {
    border: "border-[#f2c35f]/75",
    bg: "bg-[#f2c35f]/10",
    text: "text-[#f2d786]",
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
      <p className="mt-1 break-words text-[15px] font-black tracking-[-0.02em] text-[#faf6f0]">{value ?? "Not clear"}</p>
    </div>
  );
}

function TradeLevelCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | null;
  tone: "stop" | "target";
  hint: string;
}) {
  const isStop = tone === "stop";
  return (
    <div
      className={
        "min-w-0 overflow-hidden rounded-[22px] border p-4 " +
        (isStop
          ? "border-rose-300/20 bg-rose-300/[0.075]"
          : "border-emerald-300/20 bg-emerald-300/[0.075]")
      }
    >
      <p className={"text-[10px] font-black uppercase tracking-[0.15em] " + (isStop ? "text-rose-200" : "text-emerald-200")}>
        {label}
      </p>
      <p className={"mt-2 break-words text-[clamp(28px,9vw,40px)] font-black leading-none tracking-[-0.05em] " + (isStop ? "text-rose-300" : "text-emerald-300")}>
        {value ?? "Not clear"}
      </p>
      <p className="mt-2 text-[10.5px] font-semibold leading-4 text-[#fffaf2]/40">{hint}</p>
    </div>
  );
}

export function ChartScannerWorkspace() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const contextCameraInputRef = useRef<HTMLInputElement>(null);
  const contextLibraryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [supportingPreviewUrls, setSupportingPreviewUrls] = useState<string[]>([]);
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

  useEffect(() => {
    const resetAfterReturn = () => {
      window.setTimeout(resetIOSViewportAfterPicker, 40);
      window.setTimeout(resetIOSViewportAfterPicker, 360);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") resetAfterReturn();
    };

    window.addEventListener("orientationchange", resetAfterReturn);
    window.addEventListener("pageshow", resetAfterReturn);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("orientationchange", resetAfterReturn);
      window.removeEventListener("pageshow", resetAfterReturn);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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
        chartCurrentPrice: result.current_price,
        chartSignals: result.signals.map((signal) => signal.name).join(", "),
        chartStopLoss: result.trade_plan.stop_loss,
        chartTakeProfit: result.trade_plan.take_profit,
        chartProjectedHorizon: result.trade_plan.projected_horizon,
        chartProjectedBars: result.trade_plan.projected_bars,
      },
    });
  }, [result]);

  async function runScan(files: File[]) {
    if (files.length === 0) return;
    setError("");
    setResult(null);
    setStatus("analyzing");
    nativeHaptic("medium");

    const formData = new FormData();
    files.slice(0, 2).forEach((file) => formData.append("image", file));

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
    resetIOSViewportAfterPicker();
    window.setTimeout(resetIOSViewportAfterPicker, 260);
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
      supportingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setSupportingFiles([]);
      setSupportingPreviewUrls([]);
      setScanFile(prepared);
      await runScan([prepared]);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Could not prepare that chart image.");
      setStatus("error");
      nativeHaptic("error");
    }
  }

  async function handleAdditionalImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    resetIOSViewportAfterPicker();
    window.setTimeout(resetIOSViewportAfterPicker, 260);
    if (!selected || !scanFile) return;

    if (supportingFiles.length >= 1) {
      setError("StockGPT can combine the main chart with one supporting photo.");
      nativeHaptic("warning");
      return;
    }

    setStatus("preparing");
    setError("");

    try {
      const prepared = await prepareImage(selected);
      if (prepared.size > 3_200_000) {
        throw new Error("That image is still too large. Try a tighter screenshot.");
      }

      const nextSupportingFiles = [...supportingFiles, prepared].slice(0, 1);
      const nextPreview = URL.createObjectURL(prepared);
      setSupportingFiles(nextSupportingFiles);
      setSupportingPreviewUrls((current) => [...current, nextPreview].slice(0, 1));
      await runScan([scanFile, ...nextSupportingFiles]);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Could not prepare that extra chart image.");
      setStatus("error");
      nativeHaptic("error");
    }
  }


  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    supportingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrl(null);
    setScanFile(null);
    setSupportingFiles([]);
    setSupportingPreviewUrls([]);
    setResult(null);
    setError("");
    setStatus("idle");
    nativeHaptic("light");
  }

  const tone = result ? verdictTone(result.verdict) : null;
  const box = result?.overlay.pattern_box;
  const pricePlotBox = result?.overlay.price_plot_box;
  const hasBox = box && box.x_pct !== null && box.y_pct !== null && box.width_pct !== null && box.height_pct !== null;
  const verdictWord = result
    ? result.verdict === "bullish"
      ? "BULLISH"
      : result.verdict === "bearish"
        ? "BEARISH"
        : "INCONCLUSIVE"
    : "";
  const verdictTextClass = result?.verdict === "bullish"
    ? "text-emerald-300"
    : result?.verdict === "bearish"
      ? "text-rose-300"
      : "text-[#f2d786]";
  const hasCompleteTradePlan = Boolean(
    result?.trade_plan.stop_loss && result?.trade_plan.take_profit,
  );

  return (
    <main className="sg-chart-scanner mx-auto min-h-full w-full max-w-[760px] overflow-x-hidden pb-8 pt-2">
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
      <input
        ref={contextCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleAdditionalImage}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        ref={contextLibraryInputRef}
        type="file"
        accept="image/*"
        onChange={handleAdditionalImage}
        className="sr-only"
        tabIndex={-1}
      />

      {status === "idle" && (
        <section className="flex min-h-[calc(100dvh-190px)] flex-col justify-center py-5">
          <div className="mb-6 min-w-0 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f2c35f]/72">StockGPT Vision · V1</p>
            <h1 className="mt-2 max-w-[12ch] break-words text-[clamp(34px,10vw,40px)] font-black leading-[0.96] tracking-[-0.055em] text-[#fffaf2]">
              Spot the setup in seconds.
            </h1>
            <p className="mt-3 max-w-[36rem] text-[14px] font-medium leading-6 text-[#fffaf2]/56">
              Point your iPhone at a stock chart or use a screenshot. StockGPT scans the actual candlesticks or price line, then checks the structure, signals and risk levels it can read.
            </p>
          </div>

          <ScannerTarget />

          <div className="mt-5 min-w-0 rounded-[22px] border border-[#f2c35f]/14 bg-[#f2c35f]/[0.055] p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f2c35f]/12 text-[13px] font-black text-[#f2d786]">!</span>
              <p className="text-[11px] font-black uppercase tracking-[0.13em] text-[#f2d786]">Before you take the photo</p>
            </div>
            <p className="mt-2 text-[13px] font-black leading-5 text-[#fffaf2]">
              Get the full chart in — especially the latest candles, current price and right-side price scale.
            </p>
            <div className="mt-3 grid gap-2 text-[11.5px] font-semibold leading-4 text-[#fffaf2]/55">
              <p>• Make the candle/price plot the main thing in the photo.</p>
              <p>• Keep ticker + timeframe visible if possible.</p>
              <p>• Keep RSI, MACD, volume or moving averages visible only if you want those analysed too.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5">
            <button
              type="button"
              data-native-haptic="medium"
              onClick={() => cameraInputRef.current?.click()}
              className="flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-[19px] bg-[linear-gradient(180deg,#f5d982,#d9ae50)] px-5 text-[14px] font-black text-[#092116] shadow-[0_14px_36px_rgba(221,177,89,0.18)] transition active:scale-[0.985]"
            >
              <StockIcon name="camera" className="size-5" />
              Open camera
            </button>

            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="h-12 w-full min-w-0 rounded-[18px] border border-[#fffaf2]/8 bg-[#fffaf2]/[0.045] px-5 text-[13px] font-black text-[#fffaf2]/78 transition active:scale-[0.985]"
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
          <div className="mb-4 min-w-0 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2c35f]/68">
              {supportingFiles.length > 0 ? "Combining chart views" : "Scanning chart"}
            </p>
            <h1 className="mt-1 break-words text-[clamp(26px,8vw,32px)] font-black tracking-[-0.045em] text-[#fffaf2]">
              {status === "preparing" ? "Preparing image…" : analysisSteps[stepIndex]}
            </h1>
            {supportingFiles.length > 0 && (
              <p className="mt-2 text-[11px] font-bold text-[#fffaf2]/38">
                Using {1 + supportingFiles.length} photos together
              </p>
            )}
          </div>

          <div className="relative w-full overflow-hidden rounded-[28px] border border-[#f2c35f]/16 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <img src={previewUrl} alt="Chart being scanned" className="block h-auto w-full max-w-full" />
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
        <section className="flex min-h-[calc(100dvh-190px)] min-w-0 flex-col justify-center py-5">
          {previewUrl && (
            <div className="mb-5 w-full overflow-hidden rounded-[26px] border border-[#fffaf2]/8 bg-black/40">
              <img src={previewUrl} alt="Chart scan" className="block h-auto w-full max-w-full opacity-70" />
            </div>
          )}
          <div className="min-w-0 overflow-hidden rounded-[26px] border border-rose-300/12 bg-rose-300/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-rose-200/65">Scan failed</p>
            <p className="mt-2 break-words text-[19px] font-black tracking-[-0.025em] text-[#fffaf2]">{error}</p>
            <p className="mt-2 text-[12px] leading-5 text-[#fffaf2]/45">
              Keep the actual candles/price line, latest price and price scale visible. StockGPT ignores TradingView headers and toolbar lines.
            </p>
          </div>
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => scanFile && void runScan([scanFile, ...supportingFiles])}
              disabled={!scanFile}
              className="h-12 min-w-0 rounded-[18px] bg-[#f2c35f] px-3 text-[13px] font-black text-[#092116] disabled:opacity-40"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-12 min-w-0 rounded-[18px] border border-[#fffaf2]/9 bg-[#fffaf2]/[0.045] px-3 text-[13px] font-black text-[#fffaf2]/76"
            >
              New chart
            </button>
          </div>
        </section>
      )}

      {status === "result" && result && previewUrl && tone && (
        <section className="min-w-0 overflow-x-hidden pb-4 pt-1">
          <div className="relative w-full overflow-hidden rounded-[28px] border border-[#f2c35f]/14 bg-black">
            <img src={previewUrl} alt="Scanned stock chart" className="block h-auto w-full max-w-full" />

            {pricePlotBox && (
              <span
                className="pointer-events-none absolute rounded-[10px] border border-white/[0.09]"
                style={{
                  left: pricePlotBox.x_pct + "%",
                  top: pricePlotBox.y_pct + "%",
                  width: pricePlotBox.width_pct + "%",
                  height: pricePlotBox.height_pct + "%",
                }}
              />
            )}

            {result.overlay.resistance_y_pct !== null && pricePlotBox && (
              <span
                className="pointer-events-none absolute border-t border-dashed border-rose-300/75"
                style={{
                  top: result.overlay.resistance_y_pct + "%",
                  left: pricePlotBox.x_pct + "%",
                  width: pricePlotBox.width_pct + "%",
                }}
              >
                <span className="absolute right-0 -top-3 grid size-6 place-items-center rounded-full border border-rose-300/25 bg-[#16070a]/90 text-[9px] font-black text-rose-200 backdrop-blur">
                  R
                </span>
              </span>
            )}

            {result.overlay.support_y_pct !== null && pricePlotBox && (
              <span
                className="pointer-events-none absolute border-t border-dashed border-emerald-300/70"
                style={{
                  top: result.overlay.support_y_pct + "%",
                  left: pricePlotBox.x_pct + "%",
                  width: pricePlotBox.width_pct + "%",
                }}
              >
                <span className="absolute left-0 -top-3 grid size-6 place-items-center rounded-full border border-emerald-300/25 bg-[#06150e]/90 text-[9px] font-black text-emerald-200 backdrop-blur">
                  S
                </span>
              </span>
            )}

            {hasBox && box && (
              <span
                className="pointer-events-none absolute rounded-[14px] border border-dashed border-[#f2c35f]/40"
                style={{
                  left: box.x_pct + "%",
                  top: box.y_pct + "%",
                  width: box.width_pct + "%",
                  height: box.height_pct + "%",
                }}
              />
            )}

            {result.signals.map((signal, index) => {
              const signalBox = signal.box;
              if (!signalBox) return null;
              const signalStyle = signalTone(signal.bias);

              return (
                <span
                  key={signal.name + index}
                  className={"pointer-events-none absolute rounded-[10px] border-2 " + signalStyle.border + " " + signalStyle.bg}
                  style={{
                    left: signalBox.x_pct + "%",
                    top: signalBox.y_pct + "%",
                    width: signalBox.width_pct + "%",
                    height: signalBox.height_pct + "%",
                  }}
                >
                  <span
                    className={
                      "absolute -left-2 -top-2 grid size-6 place-items-center rounded-full border border-black/30 bg-[#031009]/95 text-[10px] font-black shadow-[0_3px_12px_rgba(0,0,0,0.45)] " +
                      signalStyle.text
                    }
                  >
                    {index + 1}
                  </span>
                </span>
              );
            })}

            <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] items-center gap-2 rounded-full border border-white/10 bg-[#04180f]/82 px-3 py-1.5 backdrop-blur-xl">
              <span className="size-1.5 shrink-0 rounded-full bg-[#f2c35f]" />
              <span className="truncate text-[9px] font-black uppercase tracking-[0.13em] text-[#fffaf2]/72">
                Candles / price plot only
              </span>
            </div>
          </div>

          <div className={"relative -mt-2 min-w-0 rounded-t-[30px] bg-[#061b12] px-1 pt-5 " + tone.glow}>
            <div className="min-w-0 border-b border-[#fffaf2]/[0.055] pb-5">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#fffaf2]/34">Chart verdict</p>
              <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <h1 className={"min-w-0 break-words text-[clamp(30px,10vw,46px)] font-black leading-none tracking-[-0.065em] " + verdictTextClass}>
                  {verdictWord}
                </h1>
                <div className="shrink-0 pb-1 text-right">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#fffaf2]/34">Confidence</p>
                  <p className="mt-0.5 text-[clamp(23px,7vw,30px)] font-black leading-none tracking-[-0.045em] text-[#f2d786]">{result.confidence}%</p>
                </div>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                <div className={"inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] " + tone.badge}>
                  <span className={"size-1.5 shrink-0 rounded-full " + tone.dot} />
                  <span className="break-words">{result.label}</span>
                </div>
                {result.current_price && (
                  <div className="max-w-full break-words rounded-full border border-[#fffaf2]/8 bg-[#fffaf2]/[0.045] px-3 py-1.5 text-[10px] font-black text-[#fffaf2]/72">
                    Current {result.current_price}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 pt-5">
              <h2 className="break-words text-[clamp(24px,7vw,30px)] font-black leading-[1.02] tracking-[-0.045em] text-[#fffaf2]">{result.pattern}</h2>
              <p className="mt-2 break-words text-[12px] font-bold text-[#fffaf2]/42">
                {[result.ticker, result.timeframe].filter(Boolean).join(" · ") || "Ticker/timeframe not confidently visible"}
              </p>
              <p className="mt-4 max-w-[42rem] break-words text-[14px] font-medium leading-6 text-[#fffaf2]/66">{result.summary}</p>
            </div>

            {result.retake_required && (
              <div className="mt-5 min-w-0 overflow-hidden rounded-[24px] border border-rose-300/20 bg-rose-300/[0.07] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-200">Need a cleaner primary chart</p>
                <p className="mt-2 break-words text-[15px] font-black leading-5 text-[#fffaf2]">
                  {result.retake_reason || "Retake with the full candle/price plot clearly visible."}
                </p>
                <p className="mt-2 text-[11.5px] font-semibold leading-5 text-[#fffaf2]/48">
                  StockGPT rejected this as a reliable price plot rather than using a header, toolbar or text line as technical structure.
                </p>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="mt-4 h-11 w-full min-w-0 rounded-[16px] bg-rose-200 px-4 text-[12px] font-black text-[#2c090e] transition active:scale-[0.985]"
                >
                  Retake primary chart
                </button>
              </div>
            )}

            {!result.retake_required && result.needs_more_info && (
              <div className="mt-5 min-w-0 overflow-hidden rounded-[24px] border border-[#f2c35f]/18 bg-[#f2c35f]/[0.065] p-4">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f2d786]">One more view would help</p>
                  <span className="shrink-0 rounded-full bg-[#f2c35f]/10 px-2.5 py-1 text-[9px] font-black text-[#f2d786]">
                    {1 + supportingFiles.length}/2 photos
                  </span>
                </div>
                <p className="mt-2 break-words text-[15px] font-black leading-5 text-[#fffaf2]">
                  {result.more_info_prompt || "Add one more chart photo with the missing price context."}
                </p>
                <p className="mt-2 text-[11.5px] font-semibold leading-5 text-[#fffaf2]/48">
                  Your first photo stays as the main chart. StockGPT will combine the next picture with it rather than starting over.
                </p>

                {supportingPreviewUrls.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-hidden">
                    {supportingPreviewUrls.map((url, index) => (
                      <div key={url} className="min-w-0 flex-1 overflow-hidden rounded-[12px] border border-[#fffaf2]/8 bg-black">
                        <img src={url} alt={"Supporting chart view " + (index + 1)} className="aspect-[16/10] w-full object-cover opacity-80" />
                      </div>
                    ))}
                  </div>
                )}

                {supportingFiles.length === 0 ? (
                  <div className="mt-4 grid min-w-0 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => contextCameraInputRef.current?.click()}
                      className="h-12 min-w-0 rounded-[17px] bg-[#f2c35f] px-3 text-[12px] font-black text-[#092116] transition active:scale-[0.985]"
                    >
                      Add requested photo
                    </button>
                    <button
                      type="button"
                      onClick={() => contextLibraryInputRef.current?.click()}
                      className="h-12 min-w-0 rounded-[17px] border border-[#fffaf2]/9 bg-[#fffaf2]/[0.045] px-3 text-[12px] font-black text-[#fffaf2]/76 transition active:scale-[0.985]"
                    >
                      Add screenshot
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-4 h-12 w-full min-w-0 rounded-[17px] border border-[#fffaf2]/9 bg-[#fffaf2]/[0.045] px-3 text-[12px] font-black text-[#fffaf2]/76 transition active:scale-[0.985]"
                  >
                    Start over with a clearer chart
                  </button>
                )}
              </div>
            )}

            {!result.retake_required && !result.needs_more_info && hasCompleteTradePlan && (
              <div className="mt-5 min-w-0 overflow-hidden rounded-[24px] border border-[#fffaf2]/7 bg-[#081f16] p-4">
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/70">Technical trade plan</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#fffaf2]/38">
                      Built from the visible {result.timeframe ? result.timeframe + " chart" : "chart timeframe"} · not live-market verified
                    </p>
                  </div>
                  {result.trade_plan.risk_reward && (
                    <div className="shrink-0 rounded-full bg-[#f2c35f]/10 px-3 py-1.5 text-[11px] font-black text-[#f2d786]">
                      R:R {result.trade_plan.risk_reward}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 border-y border-[#fffaf2]/[0.055]">
                  <Level label="Current price" value={result.current_price} />
                  <Level label="Entry / trigger" value={result.trade_plan.entry} />
                </div>

                <div className="mt-4 grid min-w-0 gap-3">
                  <TradeLevelCard
                    label="STOP LOSS"
                    value={result.trade_plan.stop_loss}
                    tone="stop"
                    hint="Technical invalidation level — beyond the structure that makes the setup wrong."
                  />
                  <TradeLevelCard
                    label="TAKE PROFIT"
                    value={result.trade_plan.take_profit}
                    tone="target"
                    hint="Technical target from the visible resistance/support or measured move."
                  />
                </div>

                {(result.trade_plan.projected_horizon || result.trade_plan.projected_bars) && (
                  <div className="mt-4 min-w-0 rounded-[20px] border border-[#f2c35f]/12 bg-[#f2c35f]/[0.045] p-4">
                    <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/68">Projected trade horizon</p>
                    <p className="mt-1.5 break-words text-[22px] font-black tracking-[-0.035em] text-[#fffaf2]">
                      {result.trade_plan.projected_horizon ?? result.trade_plan.projected_bars}
                    </p>
                    {result.trade_plan.projected_bars && result.trade_plan.projected_horizon && (
                      <p className="mt-1 text-[11px] font-bold text-[#fffaf2]/38">
                        Approx. {result.trade_plan.projected_bars} on the visible {result.timeframe ?? "chart"} timeframe
                      </p>
                    )}
                    <p className="mt-2 text-[10.5px] font-semibold leading-4 text-[#fffaf2]/34">
                      Scenario estimate from the visible swing cadence and target distance, not a guaranteed arrival time.
                    </p>
                  </div>
                )}

                {result.trade_plan.plan && (
                  <div className="mt-4 min-w-0 border-t border-[#fffaf2]/[0.055] pt-4">
                    <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/68">Plan</p>
                    <p className="mt-1.5 break-words text-[13px] font-semibold leading-5 text-[#fffaf2]/72">{result.trade_plan.plan}</p>
                  </div>
                )}

                {result.trade_plan.rationale && (
                  <p className="mt-4 break-words text-[11.5px] font-semibold leading-5 text-[#fffaf2]/48">{result.trade_plan.rationale}</p>
                )}
              </div>
            )}

            {!result.retake_required && !result.needs_more_info && !hasCompleteTradePlan && (
              <div className="mt-5 min-w-0 overflow-hidden rounded-[22px] border border-[#fffaf2]/7 bg-[#fffaf2]/[0.035] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#fffaf2]/42">Risk levels</p>
                <p className="mt-2 text-[14px] font-black leading-5 text-[#fffaf2]">
                  No defensible stop/target pair from this chart.
                </p>
                <p className="mt-1.5 text-[11.5px] font-semibold leading-5 text-[#fffaf2]/45">
                  The chart is already usable, so StockGPT is not asking you to take another photo just to force a number.
                </p>
              </div>
            )}

            <div className="mt-5 min-w-0">
              <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#fffaf2]/34">Signals detected</p>
                  <p className="mt-1 text-[13px] font-black text-[#fffaf2]">
                    {result.signals.length > 0 ? result.signals.length + " visible signals" : "No strong secondary signals"}
                  </p>
                </div>
                <p className="text-[9px] font-bold text-[#fffaf2]/28">Numbers match the chart highlights</p>
              </div>

              {result.signals.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {result.signals.map((signal, index) => {
                    const signalStyle = signalTone(signal.bias);
                    return (
                      <div key={signal.name + index} className="min-w-0 overflow-hidden rounded-[18px] border border-[#fffaf2]/7 bg-[#fffaf2]/[0.035] p-3.5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={"grid size-8 shrink-0 place-items-center rounded-full border text-[11px] font-black " + signalStyle.border + " " + signalStyle.bg + " " + signalStyle.text}>
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                              <p className="min-w-0 break-words text-[13px] font-black text-[#fffaf2]">{signal.name}</p>
                              <span className={"shrink-0 text-[9px] font-black uppercase tracking-[0.08em] " + signalStyle.text}>
                                {signal.bias} · {signal.confidence}%
                              </span>
                            </div>
                            <p className="mt-1 break-words text-[11.5px] font-semibold leading-4 text-[#fffaf2]/46">{signal.evidence}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 grid min-w-0 grid-cols-2 gap-x-4 border-y border-[#fffaf2]/[0.055]">
              <Level label="Breakout" value={result.levels.breakout} />
              <Level label="Invalidation" value={result.levels.invalidation} />
              <Level label="Support" value={result.levels.support} />
              <Level label="Resistance" value={result.levels.resistance} />
            </div>

            <div className="mt-5 min-w-0 space-y-5">
              <div className="min-w-0">
                <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/68">Confirmation</p>
                <p className="mt-1.5 break-words text-[13px] font-semibold leading-5 text-[#fffaf2]/72">{result.confirmation}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/68">Invalidation</p>
                <p className="mt-1.5 break-words text-[13px] font-semibold leading-5 text-[#fffaf2]/72">{result.invalidation}</p>
              </div>

              {result.observations.length > 0 && (
                <div className="min-w-0 border-t border-[#fffaf2]/[0.055] pt-5">
                  <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#fffaf2]/34">What StockGPT sees</p>
                  <div className="mt-3 space-y-2.5">
                    {result.observations.map((observation, index) => (
                      <div key={observation + index} className="flex min-w-0 gap-3">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#f2c35f]/70" />
                        <p className="min-w-0 break-words text-[12.5px] font-medium leading-5 text-[#fffaf2]/61">{observation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="min-w-0 overflow-hidden rounded-[22px] bg-[#0a2a1d]/78 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#f2c35f]/60">Watch next</p>
                <p className="mt-1.5 break-words text-[14px] font-black leading-5 tracking-[-0.015em] text-[#fffaf2]">{result.watch_for}</p>
              </div>
            </div>

            <div className="mt-6 grid min-w-0 gap-2.5">
              <Link
                href={askHref}
                prefetch={false}
                data-native-haptic="medium"
                className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-[19px] bg-[linear-gradient(180deg,#f5d982,#d9ae50)] px-4 py-3 text-center text-[13px] font-black text-[#092116] shadow-[0_14px_36px_rgba(221,177,89,0.16)] transition active:scale-[0.985]"
              >
                <StockIcon name="ask" className="size-5 shrink-0" />
                <span className="min-w-0 break-words">Ask StockGPT about this setup</span>
              </Link>

              <button
                type="button"
                onClick={reset}
                className="h-12 min-w-0 rounded-[18px] border border-[#fffaf2]/8 bg-[#fffaf2]/[0.04] px-5 text-[12px] font-black text-[#fffaf2]/65 transition active:scale-[0.985]"
              >
                Scan another chart
              </button>
            </div>

            <p className="mt-4 px-2 text-center text-[10px] leading-4 text-[#fffaf2]/28">
              Stop/target levels are visual technical references from the supplied photos, not live-market verification or guaranteed outcomes.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
