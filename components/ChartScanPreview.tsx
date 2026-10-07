"use client";

/* eslint-disable @next/next/no-img-element -- Blob screenshots and overlays share the image's exact aspect ratio. */

import { useId, useRef, useState } from "react";
import type { ChartScanResult } from "@/lib/chart-scanner";
import { scannerHaptic } from "@/lib/chart-scan-haptics";
import styles from "./ChartScanAnalysis.module.css";

type Props = { src: string; supportingSrc?: string | null; result: ChartScanResult; focusedSignal?: number | null; onSignalChange?: (index: number | null) => void };
const tones = { entry: "#ffd361", stop: "#ff919e", target: "#36ffad", support: "#8fcaff", resistance: "#c7afff" };
const names = { entry: "Open", stop: "SL", target: "TP", support: "Support", resistance: "Resistance" };

function ChartImage({ src, result, showPatterns, showStructure, selectedSignal, imageIndex }: Props & { showPatterns: boolean; showStructure: boolean; selectedSignal: number | null; imageIndex: number }) {
  const maskId = useId();
  const plot = imageIndex === 0 ? result.overlay.price_plot_box : null;
  const selected = selectedSignal === null ? null : result.signals[selectedSignal];
  const findings = result.signals.map((signal, index) => ({ signal, index })).filter(({ signal, index }) => signal.source_image === imageIndex && signal.boxes.length > 0 &&
    (index === selectedSignal || (showPatterns && (signal.kind === "pattern" || signal.kind === "candle"))));
  const size = result.overlay.image_sizes[imageIndex] ?? { width: 100, height: 100 };
  const lines = imageIndex === 0 ? [
    ...result.overlay.trade_lines,
    ...(showStructure && result.overlay.support_y_pct !== null && result.levels.support ? [{ kind: "support" as const, price: result.levels.support, y_pct: result.overlay.support_y_pct }] : []),
    ...(showStructure && result.overlay.resistance_y_pct !== null && result.levels.resistance ? [{ kind: "resistance" as const, price: result.levels.resistance, y_pct: result.overlay.resistance_y_pct }] : []),
  ] : [];
  return <div>
    <div className="relative w-full bg-black">
      <img src={src} alt={imageIndex === 0 ? "Your main chart with Open, stop-loss, take-profit and verified pattern highlights" : "Supporting image with indicator evidence"} className="block h-auto w-full" />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none">
        <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={size.width} height={size.height}><rect width={size.width} height={size.height} fill="white" />{imageIndex === 0 && result.overlay.exclusions.map((box, index) => <rect key={index} x={box.x_pct / 100 * size.width} y={box.y_pct / 100 * size.height} width={box.width_pct / 100 * size.width} height={box.height_pct / 100 * size.height} fill="black" />)}</mask></defs>
        <g mask={`url(#${maskId})`}>{plot && lines.map(line => <g key={line.kind}><line x1={plot.x_pct / 100 * size.width} x2={(plot.x_pct + plot.width_pct) / 100 * size.width} y1={line.y_pct / 100 * size.height} y2={line.y_pct / 100 * size.height} stroke="#03120c" strokeWidth="4.5" strokeOpacity="0.8" vectorEffect="non-scaling-stroke" />
          <line x1={plot.x_pct / 100 * size.width} x2={(plot.x_pct + plot.width_pct) / 100 * size.width} y1={line.y_pct / 100 * size.height} y2={line.y_pct / 100 * size.height} stroke={tones[line.kind]} strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeDasharray={line.kind === "entry" || line.kind === "support" || line.kind === "resistance" ? "7 4" : undefined} /></g>)}</g>
        {findings.flatMap(({ signal, index }) => signal.boxes.map((box, boxIndex) => {
          const accent = signal.bias === "bearish" ? "#ff9eae" : signal.bias === "bullish" ? "#36ffad" : "#ffd361";
          const focused = selectedSignal === index;
          return <g key={`${index}:${boxIndex}`}><rect x={box.x_pct / 100 * size.width} y={box.y_pct / 100 * size.height} width={box.width_pct / 100 * size.width} height={box.height_pct / 100 * size.height} fill={accent} fillOpacity={focused ? "0.28" : selected ? "0.12" : "0.2"} stroke="#03120c" strokeOpacity="0.8" strokeWidth={focused ? "5" : "4"} vectorEffect="non-scaling-stroke" />
            <rect x={box.x_pct / 100 * size.width} y={box.y_pct / 100 * size.height} width={box.width_pct / 100 * size.width} height={box.height_pct / 100 * size.height} fill="none" stroke={accent} strokeWidth={focused ? "2.8" : "2"} vectorEffect="non-scaling-stroke" /></g>;
        }))}
      </svg>
      {plot && lines.map(line => <span key={line.kind} aria-hidden="true" className="pointer-events-none absolute rounded-md border border-current/30 bg-[#021009]/95 px-1.5 py-0.5 text-[10px] font-black leading-4"
        style={{ top: `${line.y_pct}%`, left: `${plot.x_pct + 0.5}%`, transform: line.y_pct < plot.y_pct + 4 ? "translateY(0)" : "translateY(-100%)", color: tones[line.kind] }}>{names[line.kind]} {line.price}</span>)}
      {findings.flatMap(({ signal, index }) => signal.boxes.map((box, boxIndex) => <span key={`${index}:${boxIndex}`} aria-hidden="true" className="pointer-events-none absolute grid size-5 place-items-center rounded-br-md bg-[#03120c]/95 text-[11px] font-black"
        style={{ top: `${box.y_pct}%`, left: `${box.x_pct}%`, color: signal.bias === "bearish" ? "#ff9eae" : signal.bias === "bullish" ? "#36ffad" : "#ffd361" }}>{index + 1}</span>))}
    </div>
    {lines.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#36ffad]/30 bg-[#063622] px-3 py-3">{lines.map(line => <span key={line.kind} className="inline-flex items-center gap-1.5 text-xs font-extrabold" style={{ color: tones[line.kind] }}><span className="h-0.5 w-4 bg-current" />{names[line.kind]} {line.price}</span>)}</div>}
  </div>;
}

export function ChartScanPreview(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [showPatterns, setShowPatterns] = useState(true);
  const [showStructure, setShowStructure] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [localSignal, setLocalSignal] = useState<number | null>(null);
  const selectedSignal = props.focusedSignal === undefined ? localSignal : props.focusedSignal;
  const selectSignal = (index: number | null) => {
    scannerHaptic();
    if (props.onSignalChange) props.onSignalChange(index);
    else setLocalSignal(index);
  };
  const signal = selectedSignal === null ? null : props.result.signals[selectedSignal];
  const showSupporting = signal?.source_image === 1 && props.supportingSrc;
  const hasStructure = props.result.overlay.resistance_y_pct !== null || props.result.overlay.support_y_pct !== null;
  const hasPatterns = props.result.signals.some(signal => (signal.kind === "pattern" || signal.kind === "candle") && signal.boxes.length > 0);
  const buttonClass = `${styles.chartControl} ${styles.tap}`;
  const charts = <><ChartImage {...props} imageIndex={0} selectedSignal={selectedSignal} showPatterns={showPatterns} showStructure={showStructure} />{showSupporting && <div className="border-t-2 border-[#ffd361] bg-[#063622]"><p className="px-3 py-3 text-sm font-extrabold text-[#ffe09b]">Indicator close-up · {signal.name}</p><ChartImage {...props} src={props.supportingSrc!} imageIndex={1} selectedSignal={selectedSignal} showPatterns={showPatterns} showStructure={showStructure} /></div>}</>;
  return <div className="min-w-0">
    <div className="mb-4"><p className="text-xs font-extrabold uppercase tracking-wider text-[#54ffb7]">The picture behind the plan</p><h3 className="mt-1 text-2xl font-black tracking-tight">See exactly what we see.</h3></div>
    <div className="mb-3 flex flex-wrap gap-2">
      {hasPatterns && <button type="button" aria-pressed={showPatterns} onClick={() => { scannerHaptic(); setShowPatterns(value => !value); }} className={`${buttonClass} ${showPatterns ? styles.activeTab : ""}`}>{showPatterns ? "Patterns on" : "Patterns off"}</button>}
      {hasStructure && <button type="button" aria-pressed={showStructure} onClick={() => { scannerHaptic(); setShowStructure(value => !value); }} className={`${buttonClass} ${showStructure ? styles.activeTab : ""}`}>Support / resistance</button>}
      <button type="button" onClick={() => { scannerHaptic("open"); setZoom(false); dialogRef.current?.showModal(); }} className={`${buttonClass} ${styles.expandButton}`}>Expand ↗</button>
    </div>
    <div className={styles.chartFrame}>{charts}</div>
    <p className="mt-3 inline-flex rounded-lg bg-[#17d98a]/15 px-3 py-2 text-xs font-extrabold text-[#80ffbf]">Open · SL · TP always on when the price scale is verified</p>
    {props.result.overlay.off_chart_levels.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{props.result.overlay.off_chart_levels.map(line => <span key={line.kind} className="rounded-lg border border-[#ffd361]/50 bg-[#ffd361]/10 px-3 py-2 text-xs font-bold text-[#ffe09b]">{names[line.kind]} {line.price} · outside screenshot</span>)}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" aria-pressed={selectedSignal === null} onClick={() => { setShowPatterns(true); selectSignal(null); }} className={`${buttonClass} ${selectedSignal === null && showPatterns ? styles.activeTab : ""}`}>All patterns</button>
      {props.result.signals.map((item, index) => <button type="button" key={`${item.region_id}:${item.name}`} aria-pressed={selectedSignal === index} onClick={() => selectSignal(index)} className={`${buttonClass} ${selectedSignal === index ? styles.activeTab : ""}`}>{index + 1}. {item.name}{item.boxes.length ? "" : " · text read"}</button>)}
    </div>
    {signal && <p aria-live="polite" className="mt-4 rounded-2xl border border-[#36ffad]/50 bg-[#087344]/35 p-4 text-sm leading-6 text-[#e0ffed]"><strong className="text-[#ffe09b]">{signal.name}:</strong> {signal.evidence}{signal.boxes.length === 0 ? " A precise location could not be agreed, so this finding has no box." : ` ${signal.boxes.length} highlighted area${signal.boxes.length === 1 ? "" : "s"}${showSupporting ? " in the supporting image below your main chart" : ""}.`}</p>}
    <p className="mt-3 text-xs leading-5 text-[#c7dece]">{props.result.overlay.calibration_status === "matched" ? "Numbers on boxes match the finding buttons. Tap to focus. Only locations agreed by both readers are highlighted." : "The price scale could not be verified. Your exits remain in the cards; use a clearer screenshot to place them accurately on the picture."}</p>
    <dialog ref={dialogRef} aria-labelledby={titleId} onClose={() => scannerHaptic("close")} className={styles.previewDialog}>
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]"><div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#36ffad]/40 bg-[#07492e] px-4 py-3"><h2 id={titleId} className="min-w-0 truncate text-sm font-extrabold">{signal?.name ?? "Your chart · all patterns"}</h2><div className="flex shrink-0 gap-2"><button type="button" aria-pressed={zoom} onClick={() => { scannerHaptic(); setZoom(value => !value); }} className={buttonClass}>{zoom ? "Fit" : "2×"}</button><button type="button" onClick={() => dialogRef.current?.close()} className={`${styles.tab} ${styles.activeTab} ${styles.tap}`}>Done</button></div></div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"><div style={{ width: zoom ? "200%" : "100%" }}>{charts}</div></div>
      </div>
    </dialog>
  </div>;
}
