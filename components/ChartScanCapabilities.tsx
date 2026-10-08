"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CANDLE_PATTERNS, SCANNER_INDICATORS, SCANNER_CAPABILITY_STATS, CANDLE_LOOKBACK, type CandleAudit } from "@/lib/chart-scan-candles";
import { SCANNER_INDICATOR_CATALOG } from "@/lib/chart-scan-indicators";
import { scannerHaptic } from "@/lib/chart-scan-haptics";
import { StockIcon } from "@/components/StockIcon";
import styles from "./ChartScanAnalysis.module.css";

export function ChartScanCapabilities({ audit }: { audit?: CandleAudit }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"candles" | "indicators" | "process">("candles");
  const [search, setSearch] = useState("");
  const [indicatorSearch, setIndicatorSearch] = useState("");
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  const patterns = CANDLE_PATTERNS.filter(pattern => `${pattern.name} ${pattern.category}`.toLowerCase().includes(search.toLowerCase()));
  const indicators = SCANNER_INDICATOR_CATALOG.filter(indicator => `${indicator.name} ${indicator.aliases.join(" ")} ${indicator.category}`.toLowerCase().includes(indicatorSearch.toLowerCase()));
  const completedPatterns = audit?.checks.filter(check => check.status === "detected" && check.completed).length ?? 0;
  const formingPatterns = audit?.checks.filter(check => check.status === "detected" && !check.completed).length ?? 0;
  return <>
    <button type="button" onClick={() => { scannerHaptic("open"); dialog.current?.showModal(); setOpen(true); }} className={`${styles.helpButton} ${styles.tap}`}><StockIcon name="search" className="size-4" />How it works</button>
    <dialog ref={dialog} aria-labelledby={titleId} data-native-haptics="managed" onClose={() => { setOpen(false); scannerHaptic("close"); }} className={styles.capabilityDialog}>
      <div className={styles.dialogHeader}><div><span className={styles.beta}>Beta</span><h2 id={titleId} className="mt-3 text-2xl font-black tracking-tight">A lot goes into your scan.</h2><p className="mt-2 text-sm leading-6 text-[#d5ffeb]">Candles. Indicators. Structure. One understandable plan.</p></div><button type="button" aria-label="Close how it works" onClick={() => dialog.current?.close()} className={`${styles.iconButton} ${styles.tap}`}><StockIcon name="close" className="size-5" /></button></div>
      <div className="px-4 py-5 sm:px-6">
        <div className={styles.statGrid}>{SCANNER_CAPABILITY_STATS.map(stat => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span><small>{stat.detail}</small></div>)}</div>
        <p className="mt-3 text-xs leading-5 text-[#c9ead8]">50+ candle patterns and {SCANNER_INDICATOR_CATALOG.length} named technical indicators. Two independent readers assess the visible evidence, looking back up to {CANDLE_LOOKBACK} readable completed candles. Indicators need visible labels and plots; hidden values are never calculated. Your results show what was actually assessed.</p>
        <div role="tablist" aria-label="Scanner capabilities" className="my-5 grid grid-cols-3 gap-2">{([{ id: "candles", label: "Candles" }, { id: "indicators", label: "Indicators" }, { id: "process", label: "The process" }] as const).map(item => <button key={item.id} role="tab" type="button" id={`${titleId}-${item.id}`} aria-selected={tab === item.id} aria-controls={`${titleId}-panel`} onClick={() => { scannerHaptic(); setTab(item.id); }} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const tabs = ["candles", "indicators", "process"] as const;
          const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
          setTab(tabs[index]); scannerHaptic(); document.getElementById(`${titleId}-${tabs[index]}`)?.focus();
        }} tabIndex={tab === item.id ? 0 : -1} className={`${styles.tab} ${styles.tap} ${tab === item.id ? styles.activeTab : ""}`}>{item.label}</button>)}</div>
        <div role="tabpanel" id={`${titleId}-panel`} aria-labelledby={`${titleId}-${tab}`}>
          {tab === "candles" && <><h3 className="text-lg font-extrabold">A full checklist. Clear evidence.</h3><p className="mt-2 text-sm leading-6 text-[#c9ead8]">Each reader reviews up to {CANDLE_LOOKBACK} readable completed candles and visible turning points. Shape, trend, neighbours and gaps all matter. Patterns can be absent, unclear or awaiting agreement. Line charts cannot supply candle patterns.</p>
            {audit && <div className="mt-3 rounded-xl bg-[#377b55]/15 p-3 text-sm text-[#a0ffd3]">{audit.applicable ? <><p className="font-bold">Your chart: {audit.checked} / {audit.total} checks reviewed</p><p className="mt-1">{completedPatterns} completed pattern{completedPatterns === 1 ? "" : "s"} agreed · {formingPatterns} still forming</p><p className="mt-2 text-xs leading-5 text-[#c9ead8]">Reviewed includes absent and unclear patterns. A check is only a detection when both readers agree.</p></> : <p>This screenshot has no readable candlestick series.</p>}</div>}
            <details className="mt-4 border-t border-[#6cbd96]/30 pt-1"><summary onClick={() => scannerHaptic()} className="min-h-12 cursor-pointer content-center text-sm font-extrabold text-[#ffe09b]">Explore all 50+ candle patterns</summary>
              <label className="mt-2 block text-xs font-bold text-[#ffe09b]" htmlFor={`${titleId}-search`}>Find a pattern</label><input id={`${titleId}-search`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search hammer, engulfing, doji…" className={styles.searchInput} type="search" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">{patterns.map(pattern => <details key={pattern.id} className={styles.catalogCard}><summary onClick={() => scannerHaptic()} className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 p-3"><span className="text-sm font-bold">{pattern.name}</span><span className={`shrink-0 text-[10px] font-bold ${pattern.bias === "bullish" ? "text-[#66ffb6]" : pattern.bias === "bearish" ? "text-[#ffb4b4]" : "text-[#ffe09b]"}`}>{pattern.category}</span></summary><p className="px-3 pb-3 text-sm leading-6 text-[#d2efdf]">{pattern.rule} <span className="text-[#ffe09b]">{pattern.candles} candle{pattern.candles === 1 ? "" : "s"}.</span></p></details>)}</div>{patterns.length === 0 && <p className="py-4 text-sm">No patterns match that search.</p>}
            </details>
          </>}
          {tab === "indicators" && <><h3 className="text-lg font-extrabold">More than candle shapes.</h3><p className="mt-2 text-sm leading-6 text-[#c9ead8]">The scan maps every visible panel and checks readable, labelled plots. An indicator must actually be present; hidden values are never invented.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{SCANNER_INDICATORS.map(name => <div key={name} className={styles.indicatorTile}><StockIcon name="trend-up" className="size-5" /><strong>{name}</strong></div>)}</div><details className="mt-4 border-t border-[#6cbd96]/30 pt-1"><summary onClick={() => scannerHaptic()} className="min-h-12 cursor-pointer content-center text-sm font-extrabold text-[#ffe09b]">Explore all {SCANNER_INDICATOR_CATALOG.length} technical indicators</summary>
              <label className="mt-2 block text-xs font-bold text-[#ffe09b]" htmlFor={`${titleId}-indicator-search`}>Find an indicator</label><input id={`${titleId}-indicator-search`} value={indicatorSearch} onChange={event => setIndicatorSearch(event.target.value)} placeholder="Search RSI, Supertrend, volume…" className={styles.searchInput} type="search" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">{indicators.map(indicator => <details key={indicator.id} className={styles.catalogCard}><summary onClick={() => scannerHaptic()} className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 p-3"><span className="text-sm font-bold">{indicator.name}</span><span className="shrink-0 text-[10px] font-bold text-[#ffe09b]">{indicator.category}</span></summary><p className="px-3 pb-3 text-sm leading-6 text-[#d2efdf]">{indicator.evidence}</p></details>)}</div>{indicators.length === 0 && <p className="py-4 text-sm">No indicators match that search.</p>}
            </details><p className="mt-3 text-sm leading-6 text-[#c9ead8]">The catalogue describes recognisable tools. Your scan assesses the ones shown in your image. A close-up helps with small panels.</p><h4 className="mt-6 text-lg font-extrabold text-[#ffe09b]">Price structure gets its own pass.</h4><div className="mt-3 flex flex-wrap gap-2">{["Double bottoms", "Double tops", "Head & shoulders", "Inverse head & shoulders", "Flags", "Triangles", "Breakouts & retests", "Support & resistance"].map(name => <span key={name} className="rounded-xl border border-[#fbd270]/50 bg-[#fbd270]/10 px-3 py-2 text-sm font-bold text-[#ffe09b]">{name}</span>)}</div><p className="mt-3 text-sm leading-6 text-[#c9ead8]">Forming structures stay conditional until their trigger is visible.</p></>}
          {tab === "process" && <><h3 className="text-lg font-extrabold">From screenshot to scenario.</h3><ol className="mt-4 space-y-3">{[
            ["Map the actual chart", "Find the price pane, price labels and every indicator panel. Keep buttons, legends and volume bars out of candle evidence."],
            ["Read it twice, independently", "Two AI readers evaluate the image separately. Compare their direction, triggers, candle checklist and prices. Disagreement reduces the StockGPT Score."],
            ["Put the plan in plain sight", "Open, stop loss and take profit stay on your main chart when the visible price scale is verified. Off-screen levels remain in the price cards."],
            ["Show the evidence and timing", "Translucent boxes use locations agreed by both readers. Entry, target and reassessment windows are estimates from the screenshot, never promised dates."],
          ].map(([name, text], index) => <li key={name} className={styles.processCard}><span>{index + 1}</span><div><h4 className="font-extrabold">{name}</h4><p className="mt-1 text-sm leading-6 text-[#d2efdf]">{text}</p></div></li>)}</ol></>}
        </div>
        <p className="mt-5 text-xs leading-5 text-[#c9ead8]">Beta: AI can miss or misread patterns. The StockGPT Score measures visible setup quality, not a win probability. These are screenshot-based scenarios, not live trade instructions.</p>
        <button type="button" onClick={() => dialog.current?.close()} className={`${styles.primary} ${styles.tap} mt-5 w-full`}>Got it. Show me the chart.</button>
      </div>
    </dialog>
  </>;
}
