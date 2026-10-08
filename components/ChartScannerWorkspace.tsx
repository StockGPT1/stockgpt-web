"use client";

/* eslint-disable @next/next/no-img-element -- Local blob screenshots preserve their natural aspect ratio for price-coordinate overlays. */

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { positivePrice } from "@/lib/chart-scan-scenario";
import { StockIcon } from "@/components/StockIcon";
import { ChartScanAnalysis } from "@/components/ChartScanAnalysis";
import type { ChartScanResult as ScanResult } from "@/lib/chart-scanner";
import { scannerHaptic } from "@/lib/chart-scan-haptics";
import { SCANNER_CAPABILITY_STATS } from "@/lib/chart-scan-candles";
import { ChartScanCapabilities } from "@/components/ChartScanCapabilities";
import styles from "./ChartScanAnalysis.module.css";
import { buildAskHref } from "@/lib/ask-context";
import { trackClientEvent } from "@/lib/analytics/client-events";

type ScanResponse = {
  result?: ScanResult;
  error?: string;
  analysis_passes?: number;
};

const analysisSteps = [
  "50+ named candle patterns and price structure",
  "Every visible, readable indicator panel",
  "Two independent reads of your chart",
  "Entry, exits and an estimated timeline",
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
  if (file.type !== "image/jpeg" && file.size <= targetBytes && Math.max(image.naturalWidth, image.naturalHeight) <= 2000 &&
    ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  const attempts = [
    { maxDimension: 2000, quality: 0.92 },
    { maxDimension: 1800, quality: 0.86 },
    { maxDimension: 1600, quality: 0.8 },
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

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
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

const primaryButton = `${styles.primary} ${styles.tap} w-full`;
const secondaryButton = `${styles.secondary} ${styles.tap}`;
const panelClass = `${styles.panel} p-5 sm:p-6`;

function CandleArt({ scanning = false }: { scanning?: boolean }) {
  return <svg viewBox="0 0 360 96" aria-hidden="true" className={styles.candleArt}>
    <path d="M0 24h360M0 48h360M0 72h360" stroke="#8affc6" strokeOpacity=".12" />
    <path className={styles.candleTrail} d="M0 78C32 76 50 83 80 79S123 61 150 59S190 58 220 42S265 48 290 31S326 30 360 13" fill="none" stroke="#ffd361" strokeOpacity=".28" strokeWidth="1.5" />
    <g className={styles.candleFloat}>
      {[{ x: 20, y: 42, h: 26 }, { x: 50, y: 52, h: 16 }, { x: 80, y: 58, h: 15 }, { x: 110, y: 45, h: 24 }, { x: 140, y: 34, h: 25 }, { x: 170, y: 37, h: 14 }, { x: 200, y: 29, h: 22 }, { x: 230, y: 18, h: 23 }, { x: 260, y: 22, h: 12 }, { x: 290, y: 12, h: 22 }, { x: 320, y: 7, h: 14 }].map((bar, index) => <g key={bar.x} className={styles.candleBar} style={{ animationDelay: `${index * 45}ms` }} stroke={index < 3 || index === 5 || index === 8 ? "#ffd361" : "#40ae7a"} fill={index < 3 || index === 5 || index === 8 ? "#ffd361" : "#40ae7a"}><line x1={bar.x} x2={bar.x} y1={bar.y - 9} y2={bar.y + bar.h + 9} strokeWidth="1.5" /><rect x={bar.x - 6} y={bar.y} width="12" height={bar.h} rx="2" /></g>)}
      <rect className={styles.candleFocus} x="62" y="43" width="64" height="43" fill="#087747" fillOpacity=".18" stroke="#38b87b" rx="5" />
    </g>
    {scanning && <line className={styles.scanSweep} x1="180" x2="180" y1="0" y2="96" stroke="#fff4c2" strokeWidth="2" />}
  </svg>;
}

export function ChartScannerWorkspace() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const supportingRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const preparationRef = useRef(0);
  const scanStartedRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [supporting, setSupporting] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [referencePrice, setReferencePrice] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "ready" | "analyzing" | "result" | "error">("idle");
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showReference, setShowReference] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { if (supportUrl) URL.revokeObjectURL(supportUrl); }, [supportUrl]);
  useEffect(() => () => { requestRef.current?.abort(); preparationRef.current += 1; }, []);
  useEffect(() => {
    if (status !== "analyzing") return;
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - scanStartedRef.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);
  useEffect(() => {
    const reset = () => window.setTimeout(resetIOSViewportAfterPicker, 40);
    const visible = () => { if (document.visibilityState === "visible") reset(); };
    window.addEventListener("orientationchange", reset);
    window.addEventListener("pageshow", reset);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("orientationchange", reset); window.removeEventListener("pageshow", reset); document.removeEventListener("visibilitychange", visible); };
  }, []);

  const askHref = useMemo(() => result ? buildAskHref({
    contextType: "stock", ...(result.ticker ? { ticker: result.ticker } : {}),
    activeFilters: {
      chartScan: result.label, chartPattern: result.pattern, chartConfidence: result.stockgpt_score.value,
      chartScoreMeaning: "Heuristic setup confidence, not a win probability", chartSetupStatus: result.trade_plan.status,
      chartDirection: result.trade_plan.side, chartEntry: result.trade_plan.entry,
      chartConfirmation: result.confirmation, chartInvalidation: result.invalidation,
      chartSignals: result.signals.map(signal => signal.name).join(", "),
      chartStopLoss: result.trade_plan.stop_loss, chartTakeProfit: result.trade_plan.take_profit,
      chartTradePlan: result.trade_plan.plan, chartLevelAssumptions: result.trade_plan.assumptions,
      chartEntryWindow: result.timeline.entry, chartTargetWindow: result.timeline.target, chartReassessWindow: result.timeline.reassess,
      chartIndependentReview: result.review.headline, chartCounterargument: result.review.counterargument,
    },
  }) : "/ask-stockgpt", [result]);

  async function handleImage(event: ChangeEvent<HTMLInputElement>, extra = false) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    resetIOSViewportAfterPicker();
    if (!selected) return;
    requestRef.current?.abort();
    const preparation = ++preparationRef.current;
    setStatus("preparing"); setError(""); setResult(null);
    try {
      const prepared = await prepareImage(selected);
      if (preparation !== preparationRef.current) return;
      if (prepared.size > 1_800_000) throw new Error("Use a smaller screenshot so the price labels stay readable.");
      const url = URL.createObjectURL(prepared);
      if (extra) { setSupporting(prepared); setSupportUrl(url); }
      else { setFile(prepared); setPreviewUrl(url); setSupporting(null); setSupportUrl(null); setReferencePrice(""); setShowReference(false); }
      setStatus("ready"); scannerHaptic();
    } catch (cause) {
      if (preparation !== preparationRef.current) return;
      setError(cause instanceof Error ? cause.message : "Could not prepare that image."); setStatus("error"); scannerHaptic("error");
    }
  }

  async function runScan() {
    if (!file) return;
    if (referencePrice.trim() && positivePrice(referencePrice) === null) { setError("Enter a positive reference price, such as 125.50."); scannerHaptic("warning"); return; }
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    scanStartedRef.current = Date.now(); setElapsedSeconds(0);
    const timeout = window.setTimeout(() => controller.abort("timeout"), 185_000);
    setError(""); setResult(null); setStatus("analyzing"); scannerHaptic("scan");
    trackClientEvent("chart_scan_started", { image_count: supporting ? 2 : 1, has_reference_price: Boolean(referencePrice.trim()) });
    const data = new FormData(); data.append("image", file);
    if (supporting) data.append("image", supporting);
    if (referencePrice.trim()) data.append("reference_price", referencePrice.trim());
    try {
      const response = await fetch("/api/chart-scan", { method: "POST", body: data, signal: controller.signal });
      const payload = await response.json().catch(() => null) as ScanResponse | null;
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "StockGPT could not read that chart.");
      if (controller.signal.aborted) return;
      setResult(payload.result); setStatus("result"); scannerHaptic(payload.result.retake_required ? "warning" : "complete");
      trackClientEvent("chart_scan_completed", { duration_ms: Date.now() - scanStartedRef.current, verdict: payload.result.verdict, retake_required: payload.result.retake_required, review_status: payload.result.verification_status, analysis_passes: payload.analysis_passes ?? null });
    } catch (cause) {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setError(controller.signal.reason === "timeout" ? "This scan took too long. Your chart is still here; try again." : cause instanceof Error ? cause.message : "Could not scan that chart."); setStatus("error"); scannerHaptic("error");
      trackClientEvent("chart_scan_failed", { duration_ms: Date.now() - scanStartedRef.current, timed_out: controller.signal.reason === "timeout" });
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }
  function reset() {
    if (status === "analyzing") trackClientEvent("chart_scan_cancelled", { duration_ms: Date.now() - scanStartedRef.current });
    requestRef.current?.abort(); preparationRef.current += 1;
    setFile(null); setSupporting(null); setPreviewUrl(null); setSupportUrl(null); setReferencePrice("");
    setResult(null); setError(""); setStatus("idle"); setShowReference(false); scannerHaptic();
  }
  const busy = status === "preparing" || status === "analyzing";
  return (
    <main data-native-haptics="managed" className={`sg-chart-scanner ${styles.workspace} mx-auto min-h-full w-full max-w-[820px] pb-10 pt-2 text-[#fffaf2]`}>
      <input ref={cameraRef} aria-label="Take a chart photo" type="file" accept="image/*" capture="environment" onChange={event => handleImage(event)} className="sr-only" tabIndex={-1} />
      <input ref={libraryRef} aria-label="Choose a chart screenshot" type="file" accept="image/*" onChange={event => handleImage(event)} className="sr-only" tabIndex={-1} />
      <input ref={supportingRef} aria-label="Choose a supporting chart image" type="file" accept="image/*" onChange={event => handleImage(event, true)} className="sr-only" tabIndex={-1} />
      <header className={`${styles.workspaceHeader} flex items-center justify-between gap-3`}>
        <div className="min-w-0"><p className={styles.kicker}>AI analysis <span className={`${styles.beta} ml-2`}>Beta</span></p><h1 className="mt-2 text-[clamp(21px,5vw,28px)] font-black tracking-tight">Chart Scanner</h1></div>
        <div className="flex shrink-0 flex-col items-end gap-2"><ChartScanCapabilities audit={result?.candle_audit} />{(file || busy) && <button type="button" onClick={reset} className={`${styles.tap} min-h-11 px-3 text-xs font-bold text-[#9fffd0]`}>{busy ? "Cancel scan" : "New scan"}</button>}</div>
      </header>
      {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div>}
      {!file && !busy && <section className={`${styles.landing} ${styles.arrive}`}>
        <div className={styles.landingIntro}>
          <p className={styles.kicker}>From chart to clarity</p>
          <h2 className={styles.landingTitle}>Read the candles.<br /><span>See the trade.</span></h2>
          <p className={styles.landingSubtitle}>Find the setup, key levels and what could change the picture. All on your chart.</p>
        </div>
        <div className={styles.landingActions}>
          <button type="button" aria-label="Take a photo" onClick={() => { scannerHaptic("open"); cameraRef.current?.click(); }} className={`${primaryButton} ${styles.captureAction}`}>
            <span className={styles.captureIcon}><StockIcon name="camera" className="size-5" /></span>
            <span className={styles.captureCopy}><strong>Take a photo</strong><small>A chart on another screen</small></span>
            <span aria-hidden="true" className={styles.captureArrow}>→</span>
          </button>
          <button type="button" aria-label="Scan my screenshot" onClick={() => { scannerHaptic("open"); libraryRef.current?.click(); }} className={`${secondaryButton} ${styles.captureAction}`}>
            <span className={styles.captureIcon}><svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></svg></span>
            <span className={styles.captureCopy}><strong>Scan my screenshot</strong><small>Choose from your photos or files</small></span>
            <span aria-hidden="true" className={styles.captureArrow}>↗</span>
          </button>
          <p className={styles.captureHint}><StockIcon name="check" className="size-3.5 shrink-0" />Keep the latest candles, price scale and timeframe visible.</p>
        </div>
        <div className={styles.landingVisual}>
          <div className={styles.visualCaption}><span>Your chart, with a plan</span><span>Illustration</span></div>
          <div className={styles.visualPlot}>
            <CandleArt />
            <span className={`${styles.exampleLevel} ${styles.exampleTarget}`}>Target</span>
            <span className={`${styles.exampleLevel} ${styles.exampleEntry}`}>Entry</span>
            <span className={`${styles.exampleLevel} ${styles.exampleStop}`}>Stop</span>
          </div>
          <div className={styles.outputStrip}><span>Patterns &amp; signals</span><span>Entry &amp; exits</span><span>Estimated timing</span></div>
        </div>
        <div className={`${styles.statGrid} ${styles.landingStats}`}>{SCANNER_CAPABILITY_STATS.map(stat => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span><small>{stat.detail}</small></div>)}</div>
        <p className={styles.landingNote}>Reads visible chart evidence. Beta scenarios need confirmation.</p>
      </section>}
      {busy && <section aria-live="polite" className={`${panelClass} ${styles.loading} py-10 text-center`}>
        <div className="mx-auto mb-5 max-w-sm"><CandleArt scanning /></div>
        <h2 className="text-3xl font-black tracking-tight">{status === "preparing" ? "Preparing your chart" : "Building your trade plan"}</h2>
        <p className="mt-2 text-sm text-[#c7dece]">{status === "preparing" ? "Keeping the price labels and indicators clear." : "Taking a deeper look, then checking it with a second reader."}</p>
        {status === "analyzing" && <div className="mx-auto mt-6 max-w-sm space-y-3 text-left"><p className="text-sm font-semibold text-[#ffe3a0]">Inside your deep scan</p>{analysisSteps.map(step => <p key={step} className="flex items-center gap-3 text-sm text-[#dcecdf]"><span className="size-2 shrink-0 rounded-full bg-[#79b99a]" />{step}</p>)}</div>}
        {status === "analyzing" && <div className="mx-auto mt-6 max-w-sm"><div className={styles.progressTrack} aria-hidden="true" /><p className="mt-3 text-xs tabular-nums text-[#ffe3a0]" role="timer" aria-live="off">{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")} elapsed</p><p className="mt-2 text-xs leading-5 text-[#bdd3c4]">{elapsedSeconds >= 90 ? "Still working through the chart. You can cancel above." : "Allow up to 3 minutes for the full scan."}</p></div>}
      </section>}
      {file && previewUrl && !busy && !result && <section className={`${panelClass} space-y-5`}>
        <div><h2 className="text-2xl font-black">Let’s read your chart.</h2><p className="mt-1 text-sm text-[#c7dece]">Check that the price scale and latest candles are visible.</p></div>
        <div className="max-h-[360px] overflow-auto rounded-2xl border-2 border-[#6cbd96]/60"><img src={previewUrl} alt="Selected chart screenshot" className="h-auto w-full" /></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { scannerHaptic(); libraryRef.current?.click(); }} className={secondaryButton}>Replace chart</button><button type="button" onClick={() => { scannerHaptic(); supportingRef.current?.click(); }} className={secondaryButton}>{supporting ? "Replace extra image" : "+ Indicator close-up"}</button></div>
        {supportUrl && <div className="flex items-center gap-3 rounded-2xl border border-[#6cbd96]/40 bg-[#032c1c] p-3"><img src={supportUrl} alt="Supporting indicator image" className="size-14 rounded-lg object-cover" /><p className="flex-1 text-xs text-[#dcecdf]">Extra view of the same chart</p><button type="button" onClick={() => { scannerHaptic(); setSupporting(null); setSupportUrl(null); }} className="min-h-11 px-2 text-xs text-white/70">Remove</button></div>}
        <details open={showReference} onToggle={event => setShowReference(event.currentTarget.open)}><summary className="min-h-12 content-center text-sm font-bold text-[#ffe09b]">Price hard to read? Add a reference</summary><div className="pb-3"><label htmlFor="scan-reference-price" className="text-xs font-semibold text-white/70">Reference price <span className="font-normal text-[#bdd3c4]">· optional</span></label><input id="scan-reference-price" inputMode="decimal" autoComplete="off" value={referencePrice} onChange={event => setReferencePrice(event.target.value)} placeholder="e.g. 125.50" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base outline-none focus:border-[#f2c35f]/60" /><p className="mt-2 text-[11px] leading-4 text-[#bdd3c4]">Used only if the image price cannot be read. Choose a fresh screenshot for current prices.</p></div></details>
        <button type="button" onClick={runScan} className={primaryButton}>Run my deep scan →</button>
      </section>}
      {result?.retake_required && <section className={`${panelClass} space-y-4`}><h2 className="text-xl font-bold">Try a clearer chart</h2><p className="text-base leading-7 text-[#dcecdf]">{result.retake_reason}</p><button type="button" onClick={() => { scannerHaptic(); libraryRef.current?.click(); }} className={primaryButton}>Choose another screenshot</button><button type="button" onClick={() => { scannerHaptic(); cameraRef.current?.click(); }} className={`${secondaryButton} w-full`}>Retake photo</button></section>}
      {result && !result.retake_required && previewUrl && <ChartScanAnalysis
        result={result} src={previewUrl} supportingSrc={supportUrl} askHref={askHref}
        onReset={reset} onAddContext={() => supportingRef.current?.click()}
        onReference={() => { setResult(null); setStatus("ready"); setShowReference(true); }}
      />}
    </main>
  );
}
