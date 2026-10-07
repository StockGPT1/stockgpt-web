"use client";

/* eslint-disable @next/next/no-img-element -- Local blob screenshots preserve their natural aspect ratio for price-coordinate overlays. */

import { useRef, useState } from "react";
import type { ChartScanResult } from "@/lib/chart-scanner";

type Props = { src: string; result: ChartScanResult };
const tones = { entry: "#f2c35f", stop: "#fda4af", target: "#6ee7b7", support: "#93c5fd", resistance: "#c4b5fd" };
const names = { entry: "Entry", stop: "Stop", target: "Target", support: "Support", resistance: "Resistance" };

function ChartImage({ src, result, showPlan, showStructure }: Props & { showPlan: boolean; showStructure: boolean }) {
  const plot = result.overlay.price_plot_box;
  const lines = [
    ...(showPlan ? result.overlay.trade_lines : []),
    ...(showStructure && result.overlay.support_y_pct !== null && result.levels.support ? [{ kind: "support" as const, price: result.levels.support, y_pct: result.overlay.support_y_pct }] : []),
    ...(showStructure && result.overlay.resistance_y_pct !== null && result.levels.resistance ? [{ kind: "resistance" as const, price: result.levels.resistance, y_pct: result.overlay.resistance_y_pct }] : []),
  ];
  return (
    <div>
      <div className="relative w-full bg-black">
        <img src={src} alt="Your original chart with price-calibrated trade levels" className="block h-auto w-full" />
        {plot && lines.map(line => (
          <span key={line.kind} aria-hidden="true" className="pointer-events-none absolute border-t"
            style={{ top: `${line.y_pct}%`, left: `${plot.x_pct}%`, width: `${plot.width_pct}%`, borderColor: tones[line.kind], borderStyle: line.kind === "entry" || line.kind === "support" || line.kind === "resistance" ? "dashed" : "solid", boxShadow: "0 1px 1px #0008" }} />
        ))}
      </div>
      {lines.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 bg-[#071c13] px-3 py-3">
        {lines.map(line => <span key={line.kind} className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: tones[line.kind] }}><span className="h-px w-4 bg-current" />{names[line.kind]} {line.price}</span>)}
      </div>}
    </div>
  );
}

export function ChartScanPreview(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showPlan, setShowPlan] = useState(true);
  const [showStructure, setShowStructure] = useState(false);
  const [zoom, setZoom] = useState(false);
  const hasPlan = props.result.overlay.trade_lines.length > 0;
  const hasStructure = props.result.overlay.resistance_y_pct !== null || props.result.overlay.support_y_pct !== null;
  const buttonClass = "min-h-10 rounded-full border border-white/15 px-3 text-[11px] font-semibold text-white/75";
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Your chart</h3>
        <div className="flex flex-wrap gap-1.5">
          {hasPlan && <button type="button" aria-pressed={showPlan} onClick={() => setShowPlan(value => !value)} className={buttonClass}>{showPlan ? "Hide plan" : "Show plan"}</button>}
          {hasStructure && <button type="button" aria-pressed={showStructure} onClick={() => setShowStructure(value => !value)} className={buttonClass}>{showStructure ? "Hide S/R" : "Support / resistance"}</button>}
          <button type="button" onClick={() => { setZoom(false); dialogRef.current?.showModal(); }} className={buttonClass}>Expand</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10"><ChartImage {...props} showPlan={showPlan} showStructure={showStructure} /></div>
      <p className="mt-2 text-[11px] leading-4 text-white/45">{props.result.overlay.calibration_status === "matched" ? "Lines use the chart’s price scale. Levels outside this view remain in your plan above." : "The price scale could not be matched precisely, so levels are listed above without chart lines."}</p>
      <dialog ref={dialogRef} aria-labelledby="chart-preview-title" className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-[#031009] p-0 text-[#fffaf2] backdrop:bg-black/80">
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <h2 id="chart-preview-title" className="text-sm font-bold">Your chart & levels</h2>
            <div className="flex gap-2">
              <button type="button" aria-pressed={zoom} onClick={() => setZoom(value => !value)} className={buttonClass}>{zoom ? "Fit" : "2×"}</button>
              <button type="button" onClick={() => dialogRef.current?.close()} className="min-h-11 rounded-full bg-[#f2c35f] px-4 text-xs font-bold text-[#092116]">Done</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"><div style={{ width: zoom ? "200%" : "100%" }}><ChartImage {...props} showPlan={showPlan} showStructure={showStructure} /></div></div>
        </div>
      </dialog>
    </div>
  );
}
