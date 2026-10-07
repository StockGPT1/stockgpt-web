"use client";

import { useRef, useState } from "react";
import type { ChartScanResult } from "@/lib/chart-scanner";

type Props = {
  src: string;
  result: ChartScanResult;
  selectedSignal: number | null;
};

function ChartImage({ src, result, selectedSignal, showLevels }: Props & { showLevels: boolean }) {
  const signal = selectedSignal === null ? null : result.signals[selectedSignal];
  const box = signal?.box;
  const plot = result.overlay.price_plot_box;
  const accent = signal?.bias === "bullish" ? "#6ee7b7" : signal?.bias === "bearish" ? "#fda4af" : "#f2c35f";

  return (
    <div className="relative w-full bg-black">
      <img src={src} alt="Original chart with the selected finding highlighted when its location is clear" className="block h-auto w-full" />
      {showLevels && plot && [
        { y: result.overlay.resistance_y_pct, colour: "#fda4af" },
        { y: result.overlay.support_y_pct, colour: "#6ee7b7" },
      ].map(({ y, colour }, index) => y === null ? null : (
        <span key={index} aria-hidden="true" className="pointer-events-none absolute border-t border-dashed opacity-80"
          style={{ top: `${y}%`, left: `${plot.x_pct}%`, width: `${plot.width_pct}%`, borderColor: colour }} />
      ))}
      {box && (
        <span aria-hidden="true" className="pointer-events-none absolute rounded-sm border transition-opacity"
          style={{ left: `${box.x_pct}%`, top: `${box.y_pct}%`, width: `${box.width_pct}%`, height: `${box.height_pct}%`, borderColor: accent, background: `${accent}0a` }}>
          <span className="absolute left-0 top-0 grid size-5 place-items-center rounded-br-md bg-[#031009]/95 text-[10px] font-bold" style={{ color: accent }}>
            {selectedSignal! + 1}
          </span>
        </span>
      )}
    </div>
  );
}

export function ChartScanPreview(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [zoom, setZoom] = useState(false);
  const signal = props.selectedSignal === null ? null : props.result.signals[props.selectedSignal];
  const hasLevels = props.result.overlay.resistance_y_pct !== null || props.result.overlay.support_y_pct !== null;
  const label = signal
    ? signal.box ? `${props.selectedSignal! + 1} · ${signal.name}`
      : signal.source_image > 0 ? "Evidence is in the supporting image" : "Precise location unavailable"
    : "Original chart";

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-h-10 items-center justify-between gap-3">
        <p className="truncate text-[11px] font-semibold text-[#fffaf2]/52" aria-live="polite">{label}</p>
        <div className="flex shrink-0 items-center gap-1">
          {hasLevels && (
            <button type="button" aria-pressed={showLevels} onClick={() => setShowLevels(current => !current)}
              className="min-h-10 rounded-full border border-[#fffaf2]/10 px-3 text-[10px] font-bold text-[#fffaf2]/70">
              {showLevels ? "Hide levels" : "Show levels"}
            </button>
          )}
          <button type="button" onClick={() => { setZoom(false); dialogRef.current?.showModal(); }}
            className="min-h-10 rounded-full border border-[#fffaf2]/10 px-3 text-[10px] font-bold text-[#fffaf2]/70">
            Expand
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-[#fffaf2]/10">
        <ChartImage {...props} showLevels={showLevels} />
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#fffaf2]/35">
        {props.result.signals.some(item => item.box) ? "Tap a finding below to see its location. One highlight at a time." : "Findings are listed below; no precise highlights are available for this image."}
      </p>
      <dialog ref={dialogRef} aria-labelledby="chart-preview-title"
        className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-[#031009] p-0 text-[#fffaf2] backdrop:bg-black/80">
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <h2 id="chart-preview-title" className="min-w-0 truncate text-[13px] font-bold">{label}</h2>
            <div className="flex shrink-0 gap-2">
              <button type="button" aria-pressed={zoom} onClick={() => setZoom(current => !current)} className="min-h-11 rounded-full border border-white/15 px-4 text-[12px] font-bold">
                {zoom ? "Fit" : "2×"}
              </button>
              <button type="button" onClick={() => dialogRef.current?.close()} className="min-h-11 rounded-full bg-[#f2c35f] px-4 text-[12px] font-bold text-[#092116]">Done</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <div style={{ width: zoom ? "200%" : "100%" }}>
              <ChartImage {...props} showLevels={showLevels} />
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
