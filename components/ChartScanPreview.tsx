"use client";

/* eslint-disable @next/next/no-img-element -- Blob screenshots and SVG overlays share the uploaded image's exact aspect ratio. */

import { useRef, useState } from "react";
import type { ChartScanResult } from "@/lib/chart-scanner";
import { nativeHaptic } from "@/lib/ios-native";

type Props = { src: string; supportingSrc?: string | null; result: ChartScanResult; focusedSignal?: number | null; onSignalChange?: (index: number | null) => void };
const tones = { entry: "#f2c35f", stop: "#fda4af", target: "#6ee7b7", support: "#93c5fd", resistance: "#c4b5fd" };
const names = { entry: "Open", stop: "SL", target: "TP", support: "Support", resistance: "Resistance" };

function ChartImage({ src, result, showPlan, showStructure, selectedSignal, imageIndex }: Props & { showPlan: boolean; showStructure: boolean; selectedSignal: number | null; imageIndex: number }) {
  const plot = imageIndex === 0 ? result.overlay.price_plot_box : null;
  const signal = selectedSignal === null ? null : result.signals[selectedSignal];
  const boxes = signal?.source_image === imageIndex ? signal.boxes : [];
  const accent = signal?.bias === "bearish" ? "#fda4af" : signal?.bias === "bullish" ? "#6ee7b7" : "#f2c35f";
  const size = result.overlay.image_sizes[imageIndex] ?? { width: 100, height: 100 };
  const lines = imageIndex === 0 ? [
    ...(showPlan ? result.overlay.trade_lines : []),
    ...(showStructure && result.overlay.support_y_pct !== null && result.levels.support ? [{ kind: "support" as const, price: result.levels.support, y_pct: result.overlay.support_y_pct }] : []),
    ...(showStructure && result.overlay.resistance_y_pct !== null && result.levels.resistance ? [{ kind: "resistance" as const, price: result.levels.resistance, y_pct: result.overlay.resistance_y_pct }] : []),
  ] : [];
  return (
    <div>
      <div className="relative w-full bg-black">
        <img src={src} alt={imageIndex === 0 ? "Your chart with trade levels and selected evidence" : "Supporting image with selected indicator evidence"} className="block h-auto w-full" />
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none">
          {plot && lines.map(line => <line key={line.kind} x1={plot.x_pct / 100 * size.width} x2={(plot.x_pct + plot.width_pct) / 100 * size.width}
            y1={line.y_pct / 100 * size.height} y2={line.y_pct / 100 * size.height} stroke={tones[line.kind]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray={line.kind === "entry" || line.kind === "support" || line.kind === "resistance" ? "5 4" : undefined} />)}
          {boxes.map((box, index) => <rect key={index} x={box.x_pct / 100 * size.width} y={box.y_pct / 100 * size.height} width={box.width_pct / 100 * size.width} height={box.height_pct / 100 * size.height} fill={accent} fillOpacity="0.1" stroke={accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
        </svg>
        {plot && lines.map(line => <span key={line.kind} aria-hidden="true" className="pointer-events-none absolute rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-bold leading-4"
          style={{ top: `${line.y_pct}%`, left: `${plot.x_pct + 0.5}%`, transform: "translateY(-100%)", color: tones[line.kind] }}>{names[line.kind]} {line.price}</span>)}
        {boxes.map((box, index) => <span key={index} aria-hidden="true" className="pointer-events-none absolute grid size-4 place-items-center rounded-br bg-black/85 text-[10px] font-bold"
          style={{ top: `${box.y_pct}%`, left: `${box.x_pct}%`, color: accent }}>{index + 1}</span>)}
      </div>
      {lines.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 bg-[#071c13] px-3 py-3">{lines.map(line => <span key={line.kind} className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: tones[line.kind] }}><span className="h-px w-4 bg-current" />{names[line.kind]} {line.price}</span>)}</div>}
    </div>
  );
}

export function ChartScanPreview(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showPlan, setShowPlan] = useState(true);
  const [showStructure, setShowStructure] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [localSignal, setLocalSignal] = useState<number | null>(() => {
    const preferred = props.result.signals.findIndex(signal => signal.kind === "pattern" && signal.boxes.length > 0 && (signal.source_image === 0 || props.supportingSrc));
    const first = preferred >= 0 ? preferred : props.result.signals.findIndex(signal => signal.boxes.length > 0 && (signal.source_image === 0 || props.supportingSrc));
    return first >= 0 ? first : null;
  });
  const selectedSignal = props.focusedSignal === undefined ? localSignal : props.focusedSignal;
  const selectSignal = (index: number | null) => {
    nativeHaptic("light");
    if (props.onSignalChange) props.onSignalChange(index);
    else setLocalSignal(index);
  };
  const signal = selectedSignal === null ? null : props.result.signals[selectedSignal];
  const imageIndex = signal?.source_image === 1 && props.supportingSrc ? 1 : 0;
  const imageSrc = imageIndex === 1 ? props.supportingSrc! : props.src;
  const hasPlan = props.result.overlay.trade_lines.length > 0;
  const hasStructure = props.result.overlay.resistance_y_pct !== null || props.result.overlay.support_y_pct !== null;
  const buttonClass = "min-h-11 rounded-full border border-[#38654c] bg-[#133b29] px-3 py-2 text-xs font-semibold text-[#dcecdf] transition active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";
  const chart = <ChartImage {...props} src={imageSrc} imageIndex={imageIndex} selectedSignal={selectedSignal} showPlan={showPlan} showStructure={showStructure} />;
  const label = signal?.name ?? "Your chart";
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">See it on your chart</h3><div className="flex flex-wrap gap-1.5">
        {hasPlan && <button type="button" aria-pressed={showPlan} onClick={() => { nativeHaptic("light"); setShowPlan(value => !value); }} className={buttonClass}>{showPlan ? "Hide plan" : "Show plan"}</button>}
        {hasStructure && <button type="button" aria-pressed={showStructure} onClick={() => { nativeHaptic("light"); setShowStructure(value => !value); }} className={buttonClass}>{showStructure ? "Hide S/R" : "Support / resistance"}</button>}
        <button type="button" onClick={() => { nativeHaptic("medium"); setZoom(false); dialogRef.current?.showModal(); }} className={buttonClass}>Expand</button>
      </div></div>
      <div className="overflow-hidden rounded-2xl border border-white/10">{chart}</div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" aria-pressed={selectedSignal === null} onClick={() => selectSignal(null)} className={buttonClass}>Main chart · no boxes</button>
        {props.result.signals.map((item, index) => <button type="button" key={`${item.region_id}:${item.name}`} aria-pressed={selectedSignal === index} onClick={() => selectSignal(index)}
          className={`${buttonClass} ${selectedSignal === index ? "border-[#f6c96b] bg-[#f6c96b]/20 text-[#ffe3a0]" : ""}`}>{index + 1}. {item.name}{item.boxes.length ? "" : " · text read"}</button>)}
      </div>
      {signal && <p aria-live="polite" className="mt-3 rounded-xl bg-[#52e0aa]/10 p-4 text-sm leading-6 text-[#dcecdf]"><strong className="text-[#fff4d8]">{signal.name}:</strong> {signal.evidence}{signal.boxes.length === 0 ? " A precise location could not be agreed, so this finding has no box." : ` ${signal.boxes.length} highlighted area${signal.boxes.length === 1 ? "" : "s"}${imageIndex === 1 ? " in the supporting image" : ""}.`}</p>}
      <p className="mt-3 text-xs leading-5 text-[#c7dece]">{props.result.overlay.calibration_status === "matched" ? "Tap a finding to see what the AI is looking at. Only locations agreed by both readers are highlighted." : "Price labels could not be verified, so levels are listed above without guessed chart lines."}</p>
      <dialog ref={dialogRef} aria-labelledby="chart-preview-title" className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-[#031009] p-0 text-[#fffaf2] backdrop:bg-black/80">
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]"><div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><h2 id="chart-preview-title" className="min-w-0 truncate text-sm font-bold">{label}</h2><div className="flex shrink-0 gap-2"><button type="button" aria-pressed={zoom} onClick={() => { nativeHaptic("light"); setZoom(value => !value); }} className={buttonClass}>{zoom ? "Fit" : "2×"}</button><button type="button" onClick={() => { nativeHaptic("light"); dialogRef.current?.close(); }} className="min-h-11 rounded-full bg-[#f2c35f] px-4 text-xs font-bold text-[#092116]">Done</button></div></div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"><div style={{ width: zoom ? "200%" : "100%" }}>{chart}</div></div>
        </div>
      </dialog>
    </div>
  );
}
