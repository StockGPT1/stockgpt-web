"use client";
import { useEffect, useState, type ReactNode } from "react";
import { AppChromeProvider } from "@/components/AppChromeProvider";
import { MobileAppHeader } from "@/components/MobileAppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { StockIcon } from "@/components/StockIcon";
import styles from "@/components/ChartScanAnalysis.module.css";
import { ChartScannerWorkspace } from "@/components/ChartScannerWorkspace";
import { ChartScanAnalysis } from "@/components/ChartScanAnalysis";
import { normaliseChartLayout, normaliseChartScan } from "@/lib/chart-scanner";
import { CANDLE_PATTERNS } from "@/lib/chart-scan-candles";
const box = { x_pct: 4, y_pct: 12, width_pct: 84, height_pct: 74 };
const chartPrices = [120, 115, 110, 105, 100, 95, 90];
const priceY = (price: number) => (box.y_pct + (120 - price) / 30 * box.height_pct) / 100 * 640;
const axis = { scale: "linear", ticks: chartPrices.map(price => ({ price, y_pct: priceY(price) / 640 * 100 })) };
const candles = [
 { open: 108, high: 111, low: 105, close: 106 }, { open: 106, high: 110, low: 104, close: 108 },
 { open: 108, high: 109, low: 99, close: 101 }, { open: 101, high: 102, low: 94, close: 96 },
 { open: 96, high: 100, low: 95, close: 98 }, { open: 98, high: 103, low: 97, close: 101 },
 { open: 101, high: 102, low: 95, close: 97 }, { open: 97, high: 99, low: 94, close: 96 },
 { open: 96, high: 103, low: 95, close: 101 }, { open: 101, high: 107, low: 100, close: 105 },
 { open: 105, high: 108, low: 103, close: 104 }, { open: 104, high: 110, low: 103, close: 107 },
 { open: 107, high: 111, low: 106, close: 109.5 },
];
const chartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640" viewBox="0 0 1000 640"><rect width="1000" height="640" fill="#101a17"/><text x="40" y="40" fill="#eef4ee" font-family="Arial" font-size="24">DEMO · 1h · illustrative chart</text>${chartPrices.map(price => `<path d="M40 ${priceY(price)}H880" stroke="#2a3832"/><text x="915" y="${priceY(price) + 7}" fill="#a6baad" font-family="Arial" font-size="22">${price}</text>`).join("")}${candles.map((candle, index) => {
 const x = 60 + index * 64, color = candle.close >= candle.open ? "#88d6ad" : "#db8894";
 return `<path d="M${x} ${priceY(candle.high)}V${priceY(candle.low)}" stroke="${color}" stroke-width="3"/><rect x="${x - 10}" y="${Math.min(priceY(candle.open), priceY(candle.close))}" width="20" height="${Math.max(3, Math.abs(priceY(candle.open) - priceY(candle.close)))}" fill="${color}" rx="2"/>`;
}).join("")}</svg>`;
const demoChartImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(chartSvg)}`;
const layout = normaliseChartLayout({ price_series_type: "candles", price_plot_box: box, price_axis: axis }, 1);
const raw = { ticker: "DEMO", timeframe: "1h", verdict: "bullish", confidence: 76, current_price: "109.50", price_series_type: "candles", chart_coverage: "full", summary: "Two troughs held the same price floor. The recovery leans bullish, but wait for a close above the recent high before treating this as a breakout.", confirmation: "Watch for a completed hourly close above 110, then a hold of that level.", invalidation: "A close below the recent swing low weakens the recovery.", indicator_checks: [], signals: [{ name: "Double bottom", kind: "pattern", bias: "bullish", confidence: 80, evidence: "Two lows around 95 are separated by a clear rally. The newer candles climb towards the neckline.", region_id: "price", source_image: 0, supported: true, localisation_confirmed: true, localisation_confidence: 92, boxes: [{ x_pct: 20, y_pct: 65, width_pct: 12, height_pct: 13 }, { x_pct: 43, y_pct: 65, width_pct: 12, height_pct: 13 }] }], candle_audit: { present: [], absent: CANDLE_PATTERNS.map(p => p.id), unclear: [], not_applicable: [] }, trade_plan: { side: "long", entry: "110", stop_loss: "105", take_profit: "115", price_scale_readable: true, plan: "Wait for the hourly close above 110, then confirm that price holds the breakout. Reassess if the recovery fails.", projected_bars: "6–12 bars", projected_horizon: "6–12 hours" }, overlay: { price_axis_confirmed: true, price_plot_confirmed: true, price_plot_box: box, price_axis: axis } };
const fixture = normaliseChartScan(raw, layout, true, null, undefined, raw);
fixture.overlay.image_sizes = [{ width: 1000, height: 640 }];
fixture.signals[0].boxes = [{ x_pct: 20, y_pct: 65, width_pct: 12, height_pct: 13 }, { x_pct: 43, y_pct: 65, width_pct: 12, height_pct: 13 }];
function ScannerPreviewShell({ children, screen, onScreen }: { children: ReactNode; screen: string; onScreen: (screen: string) => void }) {
 const [examplesOpen, setExamplesOpen] = useState(false);
 useEffect(() => {
  const previous = document.documentElement.dataset.appShell;
  document.documentElement.dataset.appShell = "true";
  return () => { if (previous) document.documentElement.dataset.appShell = previous; else delete document.documentElement.dataset.appShell; };
 }, []);
 return <AppChromeProvider>
  <div className={`sg-scanner-preview-shell sg-app-shell relative mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden text-[#fffaf2] ${styles.backdrop}`}>
   <style>{`.sg-scanner-preview-shell.sg-app-shell { width: min(430px, 100vw) !important; max-width: 430px !important; } .sg-scanner-preview-shell .sg-app-content { padding-bottom: calc(112px + env(safe-area-inset-bottom)) !important; } .sg-scanner-preview-shell .sg-mobile-app-header { display: grid !important; } .sg-scanner-preview-shell .sg-bottom-nav, .sg-scanner-preview-shell [role="dialog"] { display: block !important; }`}</style>
   <MobileAppHeader />
   <button aria-label="Preview examples" aria-expanded={examplesOpen} onClick={() => setExamplesOpen(open => !open)} className="absolute right-3 top-2 z-[45] grid size-10 place-items-center rounded-full text-lg text-[#f2c35f]">···</button>
   {examplesOpen && <nav aria-label="Preview examples" className="absolute inset-x-3 top-14 z-50 rounded-2xl border border-[#f2c35f]/25 bg-[#08281b] p-4 shadow-xl">
    <p className="mb-3 text-xs leading-5 text-[#c7dece]">Design preview · example charts. Live scanning is available in the StockGPT app.</p>
    <div className="flex flex-wrap gap-2">{["landing", "bullish", "bearish", "mixed"].map(value => <button key={value} aria-pressed={screen === value} onClick={() => { onScreen(value); setExamplesOpen(false); }} className="min-h-11 rounded-lg border border-[#f2c35f]/40 px-3 py-2 text-sm">{value}</button>)}</div>
   </nav>}
   <div className="sg-app-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-[calc(112px+env(safe-area-inset-bottom))] pt-3">{children}</div>
   <MobileBottomNav unreadCount={0} nativeApp />
  </div>
 </AppChromeProvider>;
}
export default function ScannerDesignPreview({ initialScreen = "landing" }: { initialScreen?: string }) {
 const [screen, setScreen] = useState(initialScreen);
 const result = {...fixture, verdict: screen === "bearish" ? "bearish" : screen === "mixed" ? "inconclusive" : "bullish"} as typeof fixture;
 if (screen === "bearish") {
  result.trade_plan = {...fixture.trade_plan, side: "short", stop_loss: fixture.trade_plan.take_profit, take_profit: fixture.trade_plan.stop_loss};
  result.overlay = {...fixture.overlay, trade_lines: fixture.overlay.trade_lines.map(line => ({...line, kind: line.kind === "stop" ? "target" : line.kind === "target" ? "stop" : "entry"}))};
 }
 return <ScannerPreviewShell screen={screen} onScreen={setScreen}><div className={`mx-auto max-w-[820px] ${screen !== "landing" ? styles.workspace : ""}`}>{screen === "landing" ? <ChartScannerWorkspace /> : <><header className="mb-5 flex items-center justify-between"><strong>Design preview · example chart</strong><button type="button" onClick={() => setScreen("landing")} className={`${styles.helpButton} ${styles.tap}`}><StockIcon name="camera" className="size-4" />New scan</button></header><ChartScanAnalysis result={result} src={demoChartImage} supportingSrc={null} askHref="/ask-stockgpt" onReset={() => setScreen("landing")} onAddContext={() => {}} onReference={() => {}} /></>}</div></ScannerPreviewShell>;
}
