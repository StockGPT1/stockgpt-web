"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CANDLE_PATTERNS, SCANNER_INDICATORS, type CandleAudit } from "@/lib/chart-scan-candles";
import { scannerHaptic, scannerHapticMode, scannerHapticServerSnapshot, setScannerHaptics, subscribeScannerHaptics } from "@/lib/chart-scan-haptics";
import { StockIcon } from "@/components/StockIcon";
import styles from "./ChartScanAnalysis.module.css";

export function ChartScanCapabilities({ audit }: { audit?: CandleAudit }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"candles" | "indicators" | "process">("candles");
  const [search, setSearch] = useState("");
  const mode = useSyncExternalStore(subscribeScannerHaptics, scannerHapticMode, scannerHapticServerSnapshot);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  const patterns = CANDLE_PATTERNS.filter(pattern => `${pattern.name} ${pattern.category}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <button type="button" onClick={() => { scannerHaptic("open"); dialog.current?.showModal(); setOpen(true); }} className={`${styles.helpButton} ${styles.tap}`}><StockIcon name="search" className="size-4" />How it works</button>
    <dialog ref={dialog} aria-labelledby={titleId} onClose={() => { setOpen(false); scannerHaptic("close"); }} className={styles.capabilityDialog}>
      <div className={styles.dialogHeader}><div><span className={styles.beta}>Beta</span><h2 id={titleId} className="mt-3 text-2xl font-black tracking-tight">A lot goes into your scan.</h2><p className="mt-2 text-sm leading-6 text-[#d5ffeb]">Candles. Indicators. Structure. One understandable plan.</p></div><button type="button" aria-label="Close how it works" onClick={() => dialog.current?.close()} className={`${styles.iconButton} ${styles.tap}`}><StockIcon name="close" className="size-5" /></button></div>
      <div className="px-4 py-5 sm:px-6">
        <div className={styles.statGrid}><div><strong>{CANDLE_PATTERNS.length}</strong><span>candle patterns</span></div><div><strong>{SCANNER_INDICATORS.length}</strong><span>indicator families</span></div><div><strong>2</strong><span>independent readers</span></div></div>
        <div role="tablist" aria-label="Scanner capabilities" className="my-5 grid grid-cols-3 gap-2">{([{ id: "candles", label: "Candles" }, { id: "indicators", label: "Indicators" }, { id: "process", label: "The process" }] as const).map(item => <button key={item.id} role="tab" type="button" id={`${titleId}-${item.id}`} aria-selected={tab === item.id} aria-controls={`${titleId}-panel`} onClick={() => { scannerHaptic(); setTab(item.id); }} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const tabs = ["candles", "indicators", "process"] as const;
          const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
          setTab(tabs[index]); scannerHaptic(); document.getElementById(`${titleId}-${tabs[index]}`)?.focus();
        }} tabIndex={tab === item.id ? 0 : -1} className={`${styles.tab} ${styles.tap} ${tab === item.id ? styles.activeTab : ""}`}>{item.label}</button>)}</div>
        <div role="tabpanel" id={`${titleId}-panel`} aria-labelledby={`${titleId}-${tab}`}>
          {tab === "candles" && <><h3 className="text-lg font-extrabold">Every candle scan gets the full checklist.</h3><p className="mt-2 text-sm leading-6 text-[#c9ead8]">Both readers check the latest 30 readable completed candles and visible turning points. Shape, trend, neighbours and gaps all matter. A pattern can be absent, unclear or awaiting agreement. Line charts cannot supply candle patterns.</p>
            {audit && <p className="mt-3 rounded-xl bg-[#17d98a]/15 p-3 text-sm font-bold text-[#a0ffd3]">{audit.applicable ? `${audit.checked} / ${audit.total} checks completed · ${audit.detected} patterns agreed` : "This screenshot has no readable candlestick series."}</p>}
            <label className="mt-4 block text-xs font-bold text-[#ffe09b]" htmlFor={`${titleId}-search`}>Explore the {CANDLE_PATTERNS.length} patterns</label><input id={`${titleId}-search`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search hammer, engulfing, doji…" className={styles.searchInput} type="search" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{patterns.map(pattern => <details key={pattern.id} className={styles.catalogCard} onToggle={() => scannerHaptic()}><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 p-3"><span className="text-sm font-bold">{pattern.name}</span><span className={`shrink-0 text-[10px] font-bold ${pattern.bias === "bullish" ? "text-[#66ffb6]" : pattern.bias === "bearish" ? "text-[#ffb4b4]" : "text-[#ffe09b]"}`}>{pattern.category}</span></summary><p className="px-3 pb-3 text-sm leading-6 text-[#d2efdf]">{pattern.rule} <span className="text-[#ffe09b]">{pattern.candles} candle{pattern.candles === 1 ? "" : "s"}.</span></p></details>)}</div>{patterns.length === 0 && <p className="py-4 text-sm">No patterns match that search.</p>}
          </>}
          {tab === "indicators" && <><h3 className="text-lg font-extrabold">More than candle shapes.</h3><p className="mt-2 text-sm leading-6 text-[#c9ead8]">The scan maps every visible panel and checks readable, labelled plots. An indicator must actually be present; hidden values are never invented.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{SCANNER_INDICATORS.map(name => <div key={name} className={styles.indicatorTile}><StockIcon name="trend-up" className="size-5" /><strong>{name}</strong></div>)}</div><p className="mt-3 text-sm leading-6 text-[#c9ead8]">Other clearly labelled indicators can be read too. A close-up helps with small panels.</p><h4 className="mt-6 text-lg font-extrabold text-[#ffe09b]">Price structure gets its own pass.</h4><div className="mt-3 flex flex-wrap gap-2">{["Double bottoms", "Double tops", "Head & shoulders", "Inverse head & shoulders", "Flags", "Triangles", "Breakouts & retests", "Support & resistance"].map(name => <span key={name} className="rounded-xl border border-[#fbd270]/50 bg-[#fbd270]/10 px-3 py-2 text-sm font-bold text-[#ffe09b]">{name}</span>)}</div><p className="mt-3 text-sm leading-6 text-[#c9ead8]">Forming structures stay conditional until their trigger is visible.</p></>}
          {tab === "process" && <><h3 className="text-lg font-extrabold">From screenshot to scenario.</h3><ol className="mt-4 space-y-3">{[
            ["Map the actual chart", "Find the price pane, price labels and every indicator panel. Keep buttons, legends and volume bars out of candle evidence."],
            ["Read it twice, independently", "Two AI readers evaluate the image separately. Compare their direction, triggers, candle checklist and prices. Disagreement reduces the StockGPT Score."],
            ["Put the plan in plain sight", "Open, stop loss and take profit stay on your main chart when the visible price scale is verified. Off-screen levels remain in the price cards."],
            ["Show the evidence and timing", "Translucent boxes use locations agreed by both readers. Entry, target and reassessment windows are estimates from the screenshot, never promised dates."],
          ].map(([name, text], index) => <li key={name} className={styles.processCard}><span>{index + 1}</span><div><h4 className="font-extrabold">{name}</h4><p className="mt-1 text-sm leading-6 text-[#d2efdf]">{text}</p></div></li>)}</ol></>}
        </div>
        <div className="mt-6 border-t border-[#36e9a0]/30 pt-5"><h3 className="text-sm font-extrabold text-[#ffe09b]">Feel every move</h3><p className="mt-1 text-xs leading-5 text-[#c9ead8]">Native app feedback on taps, opening views and scan completion.</p><div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Scanner haptic strength">{(["strong", "light", "off"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setScannerHaptics(value)} className={`${styles.tab} ${styles.tap} ${mode === value ? styles.activeTab : ""}`}>{value === "strong" ? "Strong" : value === "light" ? "Light" : "Off"}</button>)}</div></div>
        <p className="mt-5 text-xs leading-5 text-[#c9ead8]">Beta: AI can miss or misread patterns. The StockGPT Score measures visible setup quality, not a win probability. These are screenshot-based scenarios, not live trade instructions.</p>
        <button type="button" onClick={() => dialog.current?.close()} className={`${styles.primary} ${styles.tap} mt-5 w-full`}>Got it. Show me the chart.</button>
      </div>
    </dialog>
  </>;
}
