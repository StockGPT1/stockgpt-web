"use client";

/* eslint-disable @next/next/no-img-element -- Local blob screenshots preserve their natural aspect ratio for price-coordinate overlays. */

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { positivePrice } from "@/lib/chart-scan-scenario";
import { StockIcon } from "@/components/StockIcon";
import { ChartScanPreview } from "@/components/ChartScanPreview";
import type { ChartScanResult as ScanResult } from "@/lib/chart-scanner";
import { nativeHaptic } from "@/lib/ios-native";
import { buildAskHref } from "@/lib/ask-context";

type ScanResponse = {
  result?: ScanResult;
  error?: string;
};

const analysisSteps = [
  "Mapping the chart and indicator panels",
  "Reading price structure and momentum",
  "Checking the setup and risk levels",
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

const primaryButton = "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f2c35f] px-5 text-sm font-bold text-[#092116] transition active:scale-[0.99] disabled:opacity-50";
const secondaryButton = "flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.035] px-4 text-sm font-semibold text-[#fffaf2] disabled:opacity-50";
const panelClass = "rounded-3xl border border-white/10 bg-[#092116]/75 p-5";

function TradeLevel({ label, value, tone, hint }: { label: string; value: string | null; tone: "entry" | "stop" | "target"; hint: string }) {
  const color = tone === "stop" ? "text-rose-200" : tone === "target" ? "text-emerald-200" : "text-[#f2d786]";
  return <div className={`min-w-0 rounded-2xl border border-white/10 bg-black/15 p-3.5 ${tone === "entry" ? "col-span-2 sm:col-span-1" : ""}`}>
    <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${color}`}>{label}</p>
    <p className={`mt-2 break-words text-[clamp(20px,6vw,28px)] font-bold leading-tight tracking-tight tabular-nums ${color}`}>{value}</p>
    <p className="mt-2 text-[11px] leading-4 text-white/45">{hint}</p>
  </div>;
}

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
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (status !== "analyzing") return;
    const timer = window.setInterval(() => setStepIndex(value => Math.min(value + 1, analysisSteps.length - 1)), 10000);
    return () => window.clearInterval(timer);
  }, [status]);
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
    setError(""); setResult(null); setStepIndex(0); setStatus("analyzing"); nativeHaptic("medium");
    const data = new FormData(); data.append("image", file);
    if (supporting) data.append("image", supporting);
    if (referencePrice.trim()) data.append("reference_price", referencePrice.trim());
    try {
      const response = await fetch("/api/chart-scan", { method: "POST", body: data, signal: controller.signal });
      const payload = await response.json().catch(() => null) as ScanResponse | null;
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "StockGPT could not read that chart.");
      if (controller.signal.aborted) return;
      setResult(payload.result); setStatus("result"); nativeHaptic("success");
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
  const plan = result?.trade_plan;
  const score = result?.stockgpt_score;
  const sideColor = plan?.side === "short" ? "text-rose-200" : "text-emerald-200";
  const illustrative = plan?.levels_basis === "illustrative";
  const setupTitle = illustrative ? "Illustrative scenario" : plan?.status === "confirmed" ? "Confirmed setup" : plan?.status === "conditional" ? "Conditional setup" : "Estimated setup";
  const percent = (value: number | null | undefined) => value == null ? "" : `${value.toFixed(1)}% from entry`;
  return (
    <main className="sg-chart-scanner mx-auto min-h-full w-full max-w-[820px] pb-10 pt-2 text-[#fffaf2]">
      <input ref={cameraRef} aria-label="Take a chart photo" type="file" accept="image/*" capture="environment" onChange={event => handleImage(event)} className="sr-only" tabIndex={-1} />
      <input ref={libraryRef} aria-label="Choose a chart screenshot" type="file" accept="image/*" onChange={event => handleImage(event)} className="sr-only" tabIndex={-1} />
      <input ref={supportingRef} aria-label="Choose a supporting chart image" type="file" accept="image/*" onChange={event => handleImage(event, true)} className="sr-only" tabIndex={-1} />
      <header className="mb-6 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f2c35f]">StockGPT</p><h1 className="mt-1 text-xl font-bold tracking-tight">Chart Scanner</h1></div>
        {(file || busy) && <button type="button" onClick={reset} className="min-h-11 rounded-full border border-white/15 px-4 text-xs font-semibold">{busy ? "Cancel" : "New scan"}</button>}
      </header>
      {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div>}
      {!file && !busy && <section className={`${panelClass} space-y-6`}>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-white/50"><span className="grid size-6 place-items-center rounded-full bg-[#f2c35f] text-[#092116]">1</span>Upload<span className="h-px flex-1 bg-white/10" /><span>2 Analyse</span><span className="h-px flex-1 bg-white/10" /><span>3 Your plan</span></div>
        <div><h2 className="max-w-lg text-[clamp(29px,7vw,42px)] font-bold leading-[1.1] tracking-tight">One chart.<br />A clear trade plan.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-white/60">See the strongest long or short scenario, where it activates, where to exit and how confident StockGPT is in the setup.</p></div>
        <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-4 text-center"><div><p className="text-sm font-bold text-[#f2d786]">Entry</p><p className="mt-1 text-[11px] text-white/45">A clear trigger</p></div><div><p className="text-sm font-bold text-rose-200">Stop loss</p><p className="mt-1 text-[11px] text-white/45">Defined risk</p></div><div><p className="text-sm font-bold text-emerald-200">Take profit</p><p className="mt-1 text-[11px] text-white/45">A target to watch</p></div></div>
        <div className="space-y-3"><button type="button" onClick={() => libraryRef.current?.click()} className={primaryButton}>Choose screenshot</button><button type="button" onClick={() => cameraRef.current?.click()} className={`${secondaryButton} w-full`}><StockIcon name="camera" className="size-5" />Take a photo</button></div>
        <p className="text-xs leading-5 text-white/45">Include the latest candles, price scale and indicator panels. Clear screenshots give a better read.</p>
      </section>}
      {busy && <section aria-live="polite" className={`${panelClass} py-10 text-center`}>
        <div className="mx-auto mb-5 size-11 animate-spin rounded-full border-2 border-[#f2c35f]/20 border-t-[#f2c35f]" />
        <h2 className="text-xl font-bold">{status === "preparing" ? "Preparing your chart" : "Building your trade plan"}</h2>
        <p className="mt-2 text-sm text-white/55">{status === "preparing" ? "Keeping the price labels and indicators clear." : analysisSteps[stepIndex]}</p>
        {status === "analyzing" && <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">{analysisSteps.map((step, index) => <p key={step} className={`flex items-center gap-3 text-xs ${index === stepIndex ? "text-[#f2d786]" : "text-white/40"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full border ${index <= stepIndex ? "border-[#f2c35f]/40" : "border-white/10"}`}>{index + 1}</span>{step}</p>)}</div>}
        <p className="mt-6 text-[11px] text-white/40">A full scan can take about a minute.</p>
      </section>}
      {file && previewUrl && !busy && !result && <section className={`${panelClass} space-y-5`}>
        <div><h2 className="text-xl font-bold">Ready to scan?</h2><p className="mt-1 text-sm text-white/55">Check that the price scale and latest candles are visible.</p></div>
        <div className="max-h-[360px] overflow-auto rounded-2xl border border-white/10"><img src={previewUrl} alt="Selected chart screenshot" className="h-auto w-full" /></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => libraryRef.current?.click()} className={secondaryButton}>Replace chart</button><button type="button" onClick={() => supportingRef.current?.click()} className={secondaryButton}>{supporting ? "Replace extra image" : "+ Indicator close-up"}</button></div>
        {supportUrl && <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><img src={supportUrl} alt="Supporting indicator image" className="size-14 rounded-lg object-cover" /><p className="flex-1 text-xs text-white/60">Extra view of the same chart</p><button type="button" onClick={() => { setSupporting(null); setSupportUrl(null); }} className="min-h-11 px-2 text-xs text-white/70">Remove</button></div>}
        <div><label htmlFor="scan-reference-price" className="text-xs font-semibold text-white/70">Reference price <span className="font-normal text-white/40">· optional</span></label><input id="scan-reference-price" inputMode="decimal" autoComplete="off" value={referencePrice} onChange={event => setReferencePrice(event.target.value)} placeholder="e.g. 125.50" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base outline-none focus:border-[#f2c35f]/60" /><p className="mt-2 text-[11px] leading-4 text-white/40">Used only if the image price cannot be read. Choose a fresh screenshot for current prices.</p></div>
        <button type="button" onClick={runScan} className={primaryButton}>Get my trade plan</button>
      </section>}
      {result?.retake_required && <section className={`${panelClass} space-y-4`}><h2 className="text-xl font-bold">Try a clearer chart</h2><p className="text-sm leading-6 text-white/60">{result.retake_reason}</p><button type="button" onClick={() => libraryRef.current?.click()} className={primaryButton}>Choose another screenshot</button><button type="button" onClick={() => cameraRef.current?.click()} className={`${secondaryButton} w-full`}>Retake photo</button></section>}
      {result && !result.retake_required && plan && score && previewUrl && <div className="space-y-5">
        <section className={panelClass}>
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold text-white/45">{[result.ticker, result.timeframe].filter(Boolean).join(" · ") || "Your screenshot"}</p><p className={`mt-3 text-[11px] font-bold uppercase tracking-[0.15em] ${sideColor}`}>{setupTitle}</p><h2 className="mt-1 text-[clamp(26px,7vw,38px)] font-bold leading-tight tracking-tight">{plan.side === "long" ? "Long" : "Short"} scenario</h2><p className="mt-1 text-sm text-white/60">{result.label}</p></div><div className="shrink-0 rounded-2xl border border-[#f2c35f]/20 bg-[#f2c35f]/5 px-3 py-3 text-center"><p className="text-[10px] font-bold text-[#f2d786]">StockGPT Score</p><p className="mt-1 text-3xl font-bold tabular-nums text-[#f2d786]">{score.value}<span className="text-xs text-white/40">/100</span></p><p className="mt-1 text-[10px] text-white/55">{score.label}</p></div></div>
          <p className="mt-4 text-sm leading-6 text-white/70">{result.summary}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"><TradeLevel label="Entry" value={plan.entry} tone="entry" hint={plan.status === "confirmed" ? "Check the trigger below" : "Wait for the trigger"} /><TradeLevel label="Stop loss" value={plan.stop_loss} tone="stop" hint={percent(plan.stop_pct)} /><TradeLevel label="Take profit" value={plan.take_profit} tone="target" hint={percent(plan.target_pct)} /></div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-white/50"><p>Reward / risk <span className="font-bold text-white/80">{plan.risk_reward}</span></p>{plan.projected_horizon && <p>Scenario horizon {plan.projected_horizon}</p>}</div>
          {plan.assumptions && <p className="mt-4 rounded-xl border border-[#f2c35f]/15 bg-[#f2c35f]/5 p-3 text-xs leading-5 text-[#f2d786]/85">{plan.assumptions}</p>}
          <div className="mt-5 space-y-4 border-t border-white/10 pt-4"><div><h3 className="text-xs font-bold text-[#f2d786]">When to enter</h3><p className="mt-1 text-sm leading-5 text-white/75">{plan.plan || result.confirmation}</p></div><div><h3 className="text-xs font-bold text-rose-200">What cancels this setup</h3><p className="mt-1 text-sm leading-5 text-white/65">{result.invalidation}</p></div></div>
          <details className="mt-5 border-t border-white/10 pt-4"><summary className="min-h-8 cursor-pointer text-xs font-semibold text-white/65">Why this score?</summary><p className="mt-2 text-xs leading-5 text-white/50">AI setup confidence based on visible evidence, confirmation and level quality. It is not a win probability or a live-market rating.</p><ul className="mt-2 space-y-1 text-xs text-white/65">{score.reasons.map(reason => <li key={reason}>• {reason}</li>)}</ul></details>
        </section>
        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Estimated timeline</h3><span className="rounded-full bg-[#f2c35f]/10 px-2.5 py-1 text-[10px] font-bold text-[#f2d786]">{result.timeline.quality === "illustrative" ? "Illustrative windows" : "Timing estimate"}</span></div>
          <ol className="mt-4 space-y-4">{[{ name: "Entry window", text: result.timeline.entry }, { name: "Target window", text: result.timeline.target }, { name: "Reassess", text: result.timeline.reassess }].map((step, index) => <li key={step.name} className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#f2c35f]/25 text-xs font-bold text-[#f2d786]">{index + 1}</span><div><p className="text-xs font-bold">{step.name}</p><p className="mt-1 text-sm leading-5 text-white/65">{step.text}</p></div></li>)}</ol>
          <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-white/50">{result.timeline.basis}</p><p className="mt-2 text-[11px] leading-4 text-white/40">Count from the latest candle in this screenshot. Chart time excludes market closures; price confirmation takes priority over the clock.</p>
        </section>
        <section className={panelClass}><ChartScanPreview src={previewUrl} supportingSrc={supportUrl} result={result} /></section>
        {result.pattern_checks.length > 0 && <section className={panelClass}><h3 className="text-sm font-bold">Patterns spotted</h3><div className="mt-3 space-y-4">{result.pattern_checks.map(pattern => <div key={pattern.name}><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{pattern.name}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${pattern.status === "confirmed" ? "bg-emerald-300/10 text-emerald-200" : "bg-[#f2c35f]/10 text-[#f2d786]"}`}>{pattern.status === "confirmed" ? "Confirmed" : "Forming"}</span></div><p className="mt-1 text-xs leading-5 text-white/55">{pattern.evidence}</p>{pattern.status === "forming" && <p className="mt-1 text-[11px] text-[#f2d786]/70">Confirmation still needed{pattern.neckline !== null ? ` at the ${pattern.neckline} neckline` : ""}.</p>}</div>)}</div></section>}
        <section className={panelClass}><h3 className="text-sm font-bold">Why this direction?</h3><div className="mt-3 space-y-4">{result.signals.length ? result.signals.slice(0, 4).map(signal => <div key={`${signal.region_id}:${signal.name}`}><div className="flex items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${signal.bias === "bullish" ? "bg-emerald-300" : signal.bias === "bearish" ? "bg-rose-300" : "bg-[#f2c35f]"}`} /><p className="text-xs font-semibold">{signal.name}</p></div><p className="mt-1 pl-3.5 text-xs leading-5 text-white/55">{signal.evidence}</p></div>) : <p className="text-xs leading-5 text-white/55">No directional finding survived review. The plan above is an illustrative risk scenario.</p>}</div>
          <details className="mt-4 border-t border-white/10 pt-4"><summary className="min-h-8 cursor-pointer text-xs font-semibold text-white/65">Full indicator review · {result.indicator_checks.length} checked</summary><div className="mt-3 space-y-3">{result.indicator_checks.length ? result.indicator_checks.map(check => <div key={check.id}><p className="text-xs font-semibold">{check.name}<span className="ml-2 font-normal text-white/40">{check.status === "readable" ? "Reviewed" : check.status === "not_reviewed" ? "Review incomplete" : check.status === "not_confirmed" ? "Not confirmed" : "Not readable"}</span></p><p className="mt-1 text-xs leading-5 text-white/50">{check.finding || "No reliable indicator finding from this image."}</p></div>) : <p className="text-xs text-white/50">No readable indicator panels were identified.</p>}{plan.rationale && <p className="border-t border-white/10 pt-3 text-xs leading-5 text-white/55">Level rationale: {plan.rationale}</p>}{result.signals.slice(4).map(signal => <p key={signal.name} className="text-xs leading-5 text-white/55"><strong>{signal.name}:</strong> {signal.evidence}</p>)}</div></details>
        </section>
        {result.needs_more_info && <section className={panelClass}><p className="text-sm leading-5 text-white/65">{result.more_info_prompt}</p><button type="button" onClick={() => supportingRef.current?.click()} className={`${secondaryButton} mt-3 w-full`}>Add missing chart context</button></section>}
        {(plan.price_basis === "relative" || plan.price_basis === "user") && <button type="button" onClick={() => { setResult(null); setStatus("ready"); }} className={`${secondaryButton} w-full`}>{plan.price_basis === "relative" ? "Add a reference price & rescan" : "Update reference price & rescan"}</button>}
        <Link href={askHref} className={primaryButton}>Explain this setup with StockGPT</Link>
        <button type="button" onClick={reset} className={`${secondaryButton} w-full`}>Scan another chart</button>
        <p className="px-2 text-center text-[11px] leading-5 text-white/40">Based on this screenshot, not live prices. Estimated levels need confirmation; stops and targets are scenarios, not guarantees.{result.verification_status === "unavailable" ? " Independent review was unavailable; the score is reduced." : ""}</p>
      </div>}
    </main>
  );
}
