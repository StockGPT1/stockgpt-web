"use client";

/* eslint-disable @next/next/no-img-element -- Local blob screenshots preserve their natural aspect ratio for price-coordinate overlays. */

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { positivePrice } from "@/lib/chart-scan-scenario";
import { StockIcon } from "@/components/StockIcon";
import { ChartScanAnalysis } from "@/components/ChartScanAnalysis";
import type { ChartScanResult as ScanResult } from "@/lib/chart-scanner";
import { nativeHaptic } from "@/lib/ios-native";
import { buildAskHref } from "@/lib/ask-context";

type ScanResponse = {
  result?: ScanResult;
  error?: string;
};

const analysisSteps = [
  "Price structure and every visible indicator",
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

const primaryButton = "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f6c96b] px-5 text-base font-bold text-[#092116] transition active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50";
const secondaryButton = "flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#38654c] bg-[#133b29] px-4 text-sm font-semibold text-[#fffaf2] disabled:opacity-50";
const panelClass = "rounded-3xl border border-[#275540] bg-[#0a251a] p-5";

export function ChartScannerWorkspace() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const supportingRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const preparationRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [supporting, setSupporting] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [referencePrice, setReferencePrice] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "ready" | "analyzing" | "result" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { if (supportUrl) URL.revokeObjectURL(supportUrl); }, [supportUrl]);
  useEffect(() => () => { requestRef.current?.abort(); preparationRef.current += 1; }, []);
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
      else { setFile(prepared); setPreviewUrl(url); setSupporting(null); setSupportUrl(null); setReferencePrice(""); }
      setStatus("ready"); nativeHaptic("light");
    } catch (cause) {
      if (preparation !== preparationRef.current) return;
      setError(cause instanceof Error ? cause.message : "Could not prepare that image."); setStatus("error");
    }
  }

  async function runScan() {
    if (!file) return;
    if (referencePrice.trim() && positivePrice(referencePrice) === null) { setError("Enter a positive reference price, such as 125.50."); return; }
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setError(""); setResult(null); setStatus("analyzing"); nativeHaptic("medium");
    const data = new FormData(); data.append("image", file);
    if (supporting) data.append("image", supporting);
    if (referencePrice.trim()) data.append("reference_price", referencePrice.trim());
    try {
      const response = await fetch("/api/chart-scan", { method: "POST", body: data, signal: controller.signal });
      const payload = await response.json().catch(() => null) as ScanResponse | null;
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "StockGPT could not read that chart.");
      if (controller.signal.aborted) return;
      setResult(payload.result); setStatus("result"); nativeHaptic(payload.result.retake_required ? "warning" : "success");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not scan that chart."); setStatus("error"); nativeHaptic("error");
    }
  }
  function reset() {
    requestRef.current?.abort(); preparationRef.current += 1;
    setFile(null); setSupporting(null); setPreviewUrl(null); setSupportUrl(null); setReferencePrice("");
    setResult(null); setError(""); setStatus("idle"); nativeHaptic("light");
  }
  const busy = status === "preparing" || status === "analyzing";
  return (
    <main className="sg-chart-scanner mx-auto min-h-full w-full max-w-[820px] pb-10 pt-2 text-[#fffaf2]">
      <input ref={cameraRef} aria-label="Take a chart photo" type="file" accept="image/*" capture="environment" onChange={event => handleImage(event)} className="sr-only" tabIndex={-1} />
      <input ref={libraryRef} aria-label="Choose a chart screenshot" type="file" accept="image/*" onChange={event => handleImage(event)} className="sr-only" tabIndex={-1} />
      <input ref={supportingRef} aria-label="Choose a supporting chart image" type="file" accept="image/*" onChange={event => handleImage(event, true)} className="sr-only" tabIndex={-1} />
      <header className="mb-6 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f2c35f]">StockGPT</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Chart Scanner</h1></div>
        {(file || busy) && <button type="button" onClick={reset} className="min-h-11 rounded-full border border-white/15 px-4 text-xs font-semibold">{busy ? "Cancel" : "New scan"}</button>}
      </header>
      {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div>}
      {!file && !busy && <section className={`${panelClass} space-y-6`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#c7dece]"><span className="grid size-6 place-items-center rounded-full bg-[#f2c35f] text-[#092116]">1</span>Upload<span className="h-px flex-1 bg-white/10" /><span>2 Analyse</span><span className="h-px flex-1 bg-white/10" /><span>3 Your plan</span></div>
        <div><h2 className="max-w-lg text-[clamp(29px,7vw,42px)] font-bold leading-[1.1] tracking-tight">One chart.<br />A clear trade plan.</h2><p className="mt-4 max-w-lg text-base leading-7 text-[#dcecdf]">See the strongest long or short scenario, where it activates, where to exit and how confident StockGPT is in the setup.</p></div>
        <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-4 text-center"><div><p className="text-sm font-bold text-[#f2d786]">Entry</p><p className="mt-1 text-[11px] text-[#bdd3c4]">A clear trigger</p></div><div><p className="text-sm font-bold text-rose-200">Stop loss</p><p className="mt-1 text-[11px] text-[#bdd3c4]">Defined risk</p></div><div><p className="text-sm font-bold text-emerald-200">Take profit</p><p className="mt-1 text-[11px] text-[#bdd3c4]">A target to watch</p></div></div>
        <div className="space-y-3"><button type="button" onClick={() => { nativeHaptic("light"); libraryRef.current?.click(); }} className={primaryButton}>Choose screenshot</button><button type="button" onClick={() => { nativeHaptic("light"); cameraRef.current?.click(); }} className={`${secondaryButton} w-full`}><StockIcon name="camera" className="size-5" />Take a photo</button></div>
        <p className="text-xs leading-5 text-[#bdd3c4]">Include the latest candles, price scale and indicator panels. Clear screenshots give a better read.</p>
      </section>}
      {busy && <section aria-live="polite" className={`${panelClass} py-10 text-center`}>
        <div className="mx-auto mb-5 size-14 animate-spin motion-reduce:animate-none rounded-full border-2 border-[#f2c35f]/20 border-t-[#f2c35f]" />
        <h2 className="text-xl font-bold">{status === "preparing" ? "Preparing your chart" : "Building your trade plan"}</h2>
        <p className="mt-2 text-sm text-[#c7dece]">{status === "preparing" ? "Keeping the price labels and indicators clear." : "Taking a deeper look, then checking it with a second reader."}</p>
        {status === "analyzing" && <div className="mx-auto mt-6 max-w-sm space-y-3 text-left"><p className="text-sm font-semibold text-[#ffe3a0]">Every scan checks</p>{analysisSteps.map(step => <p key={step} className="flex items-center gap-3 text-sm text-[#dcecdf]"><span className="size-2 shrink-0 rounded-full bg-[#52e0aa]" />{step}</p>)}</div>}
        <p className="mt-6 text-[11px] text-[#bdd3c4]">A deeper scan can take 1–3 minutes.</p>
      </section>}
      {file && previewUrl && !busy && !result && <section className={`${panelClass} space-y-5`}>
        <div><h2 className="text-xl font-bold">Ready to scan?</h2><p className="mt-1 text-sm text-[#c7dece]">Check that the price scale and latest candles are visible.</p></div>
        <div className="max-h-[360px] overflow-auto rounded-2xl border border-white/10"><img src={previewUrl} alt="Selected chart screenshot" className="h-auto w-full" /></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { nativeHaptic("light"); libraryRef.current?.click(); }} className={secondaryButton}>Replace chart</button><button type="button" onClick={() => { nativeHaptic("light"); supportingRef.current?.click(); }} className={secondaryButton}>{supporting ? "Replace extra image" : "+ Indicator close-up"}</button></div>
        {supportUrl && <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><img src={supportUrl} alt="Supporting indicator image" className="size-14 rounded-lg object-cover" /><p className="flex-1 text-xs text-[#dcecdf]">Extra view of the same chart</p><button type="button" onClick={() => { nativeHaptic("light"); setSupporting(null); setSupportUrl(null); }} className="min-h-11 px-2 text-xs text-white/70">Remove</button></div>}
        <div><label htmlFor="scan-reference-price" className="text-xs font-semibold text-white/70">Reference price <span className="font-normal text-[#bdd3c4]">· optional</span></label><input id="scan-reference-price" inputMode="decimal" autoComplete="off" value={referencePrice} onChange={event => setReferencePrice(event.target.value)} placeholder="e.g. 125.50" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base outline-none focus:border-[#f2c35f]/60" /><p className="mt-2 text-[11px] leading-4 text-[#bdd3c4]">Used only if the image price cannot be read. Choose a fresh screenshot for current prices.</p></div>
        <button type="button" onClick={runScan} className={primaryButton}>Get my trade plan</button>
      </section>}
      {result?.retake_required && <section className={`${panelClass} space-y-4`}><h2 className="text-xl font-bold">Try a clearer chart</h2><p className="text-base leading-7 text-[#dcecdf]">{result.retake_reason}</p><button type="button" onClick={() => { nativeHaptic("light"); libraryRef.current?.click(); }} className={primaryButton}>Choose another screenshot</button><button type="button" onClick={() => { nativeHaptic("light"); cameraRef.current?.click(); }} className={`${secondaryButton} w-full`}>Retake photo</button></section>}
      {result && !result.retake_required && previewUrl && <ChartScanAnalysis
        result={result} src={previewUrl} supportingSrc={supportUrl} askHref={askHref}
        onReset={reset} onAddContext={() => supportingRef.current?.click()}
        onReference={() => { setResult(null); setStatus("ready"); }}
      />}
    </main>
  );
}
