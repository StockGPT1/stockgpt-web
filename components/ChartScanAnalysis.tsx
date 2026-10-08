"use client";

import Link from "next/link";
import { useState } from "react";
import { ChartScanPreview } from "@/components/ChartScanPreview";
import { StockIcon } from "@/components/StockIcon";
import { scannerHaptic } from "@/lib/chart-scan-haptics";
import { candlePatternId } from "@/lib/chart-scan-candles";
import { trackClientEvent } from "@/lib/analytics/client-events";
import type { ChartScanResult } from "@/lib/chart-scanner";
import styles from "./ChartScanAnalysis.module.css";

type Props = {
  result: ChartScanResult;
  src: string;
  supportingSrc: string | null;
  askHref: string;
  onReset: () => void;
  onAddContext: () => void;
  onReference: () => void;
};
const panel = `${styles.panel} p-5 sm:p-6`;
const button = `flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold ${styles.tap}`;
const quietButton = `${button} ${styles.secondary}`;
const brightButton = `${button} ${styles.primary}`;

function Score({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? "#6cbd96" : "#ffd361";
  return <div className="w-28 shrink-0 text-center sm:w-32">
    <p className="mb-2 text-xs font-bold text-[#ffe3a0]">StockGPT Score</p>
    <div className="relative mx-auto size-24 sm:size-28" role="img" aria-label={`StockGPT Score ${value} out of 100. ${label}. Setup confidence, not a win probability.`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="43" fill="none" stroke="#90ffc033" strokeWidth="8" />
        <circle className={styles.scoreArc} cx="50" cy="50" r="43" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${value} 100`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true"><span className="text-3xl font-extrabold tabular-nums text-[#fff5df] sm:text-4xl">{value}</span><span className="text-xs text-[#c2d9c9]">out of 100</span></div>
    </div>
    <p className="mt-2 text-xs font-semibold text-[#e7edda]">{label}</p>
  </div>;
}

function TradeLevel({ label, value, tone, hint, expanded, onToggle }: { label: string; value: string | null; tone: "entry" | "stop" | "target"; hint: string; expanded: boolean; onToggle: () => void }) {
  return <button type="button" aria-expanded={expanded} aria-controls={`scan-level-${tone}`} data-tone={tone} data-established={value !== null} onClick={() => { scannerHaptic(); onToggle(); }}
    className={`${styles.tradeLevel} ${styles.tap}`}>
    <span className={styles.levelLabel}><span className={styles.levelName}><span aria-hidden="true" className={styles.levelDot} />{label}</span><StockIcon name="chevron-down" className={`${styles.levelChevron} shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} /></span>
    <span className={styles.levelValue}>{value ?? "Not established"}</span>
    <span className="mt-2 block text-xs leading-5 text-[#d5e4da]">{hint}</span>
  </button>;
}

export function ChartScanAnalysis({ result, src, supportingSrc, askHref, onReset, onAddContext, onReference }: Props) {
  const [focusedSignal, setFocusedSignal] = useState<number | null | undefined>(undefined);
  const [expandedLevel, setExpandedLevel] = useState<"entry" | "stop" | "target" | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const plan = result.trade_plan, score = result.stockgpt_score;
  const illustrative = plan.levels_basis === "illustrative";
  const direction = result.verdict === "bullish" ? "Bullish" : result.verdict === "bearish" ? "Bearish" : "No clear edge";
  const directionStyle = result.verdict === "bullish" ? styles.bullish : result.verdict === "bearish" ? styles.bearish : styles.neutral;
  const setup = illustrative ? "Practice scenario · no confirmed edge" : plan.status === "confirmed" ? "Trigger visible · check current price"
    : plan.status === "conditional" ? "Waiting for the price trigger" : "Estimated levels · confirm first";
  const riskHint = (value: number | null) => value === null ? "Relative to your entry" : `${value.toFixed(1)}% from entry`;
  const levels = [
    { label: "Open / entry", tone: "entry" as const, value: plan.entry, hint: "Tap to understand the entry", explanation: `The price to watch before opening this ${plan.side === "long" ? "upward" : "downward"} scenario. ${plan.plan || result.confirmation}` },
    { label: "Stop loss", tone: "stop" as const, value: plan.stop_loss, hint: riskHint(plan.stop_pct), explanation: `The planned exit if price goes against this scenario. ${result.invalidation}` },
    { label: "Take profit", tone: "target" as const, value: plan.take_profit, hint: riskHint(plan.target_pct), explanation: "The planned exit if price moves in your favour. This is an estimated target; price may turn before reaching it." },
  ];
  const levelHelp = levels.find(level => level.tone === expandedLevel);
  function jump(id: string) {
    scannerHaptic();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
  }
  async function shareRead() {
    scannerHaptic("open");
    const title = `StockGPT Beta · ${illustrative ? "Practice scenario" : direction}`;
    const text = [
      [result.ticker, result.timeframe].filter(Boolean).join(" · "),
      `Setup score: ${score.value}/100 (not a win probability).`,
      result.summary,
      `Entry: ${plan.entry ?? "not established"} · Stop loss: ${plan.stop_loss ?? "not established"} · Take profit: ${plan.take_profit ?? "not established"}`,
      `Scenario: ${plan.plan || result.confirmation}`,
      "Screenshot-based scenario. Estimated levels need confirmation; prices are not live.",
    ].filter(Boolean).join("\n\n");
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: "https://stockgpt.pro" });
        setShareStatus("Shared.");
        trackClientEvent("chart_scan_shared", { method: "native" });
      } else {
        await navigator.clipboard.writeText(`${title}\n\n${text}\n\nhttps://stockgpt.pro`);
        setShareStatus("Copied. Ready to paste.");
        trackClientEvent("chart_scan_shared", { method: "clipboard" });
      }
      scannerHaptic("complete");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setShareStatus("Sharing is unavailable here. Try your browser’s share menu.");
    }
  }
  const supports = result.signals.filter(signal => signal.bias === (plan.side === "long" ? "bullish" : "bearish"));
  const opposes = result.signals.filter(signal => signal.bias === (plan.side === "long" ? "bearish" : "bullish"));
  return <div className={`${styles.analysis} ${styles.arrive} space-y-5`}>
    <nav aria-label="Analysis sections" className={styles.sectionNav}>
      {[{ id: "scan-plan", name: "Your plan" }, { id: "scan-chart", name: "On the chart" }, { id: "scan-evidence", name: "The evidence" }].map(item =>
        <button key={item.id} type="button" onClick={() => jump(item.id)} className={`${styles.sectionJump} ${styles.tap}`}>{item.name}</button>)}
    </nav>

    <section id="scan-plan" className={`${panel} ${styles.hero} ${styles.anchor} ${directionStyle}`} aria-labelledby="scan-direction">
      <p className={styles.scanComplete}><span aria-hidden="true"><StockIcon name="check" className="size-3.5" /></span>Scan complete</p>
      <div className={styles.resultHeader}>
        <div className="min-w-0"><p className="text-sm font-semibold text-[#c7dece]">{[result.ticker, result.timeframe].filter(Boolean).join(" · ") || "Your chart analysis"}</p>
          <h2 id="scan-direction" className={`${styles.directionTitle} mt-3`}>{illustrative ? "A scenario to practise" : direction}</h2>
          <span className={`${styles.directionBadge} mt-2`}>{illustrative ? "Practice scenario" : result.verdict === "inconclusive" ? "Mixed chart evidence" : plan.side === "long" ? "↑ Upward bias" : "↓ Downward bias"}</span>
        </div>
        <Score value={score.value} label={score.label} />
      </div>
      <div id="scan-chart" className={`${styles.anchor} mt-5`}>
        <ChartScanPreview src={src} supportingSrc={supportingSrc} result={result} focusedSignal={focusedSignal} onSignalChange={setFocusedSignal} compact>
          <div className={`${styles.tradeLevels} mt-5`}>
            {levels.map(level => <TradeLevel key={level.tone} {...level} expanded={expandedLevel === level.tone} onToggle={() => setExpandedLevel(current => current === level.tone ? null : level.tone)} />)}
          </div>
          {levelHelp && <div id={`scan-level-${levelHelp.tone}`} className={styles.levelExplanation}><p className="text-xs font-bold text-[#ffe3a0]">{levelHelp.label}</p><p className="mt-2 text-sm leading-6 text-[#e3eee4]">{levelHelp.explanation}</p></div>}
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-[#c7dece]"><p>Potential reward / risk <strong className="text-[#fff4d8]">{plan.risk_reward ?? "Not measurable"}</strong></p><span className="text-xs">Tap any price card for help</span></div>
          {plan.assumptions && <p className="mt-4 rounded-xl border border-[#f6c96b]/30 bg-[#f6c96b]/10 p-3 text-sm leading-6 text-[#ffe3a0]">{plan.assumptions}</p>}
        </ChartScanPreview>
      </div>
      <p className="mt-5 text-base leading-7 text-[#e1ede4]">{result.summary}</p>
      <div className={`${styles.resultFacts} mt-5`}>
        <span>{supports.length} supporting clue{supports.length === 1 ? "" : "s"}</span><span>{opposes.length} opposing clue{opposes.length === 1 ? "" : "s"}</span><span>{result.verification_status === "reviewed" ? "Second read complete" : "Second read unavailable"}</span>
      </div>
      <div className={`${styles.nextMove} mt-5`}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#85f8c7]"><StockIcon name="alerts" className="size-4" />Your next move</h3>
        <p className="mt-2 text-sm font-semibold text-[#ffe3a0]">{setup}</p>
        <p className="mt-2 text-base leading-6 text-[#edf7ee]">{plan.plan || result.confirmation}</p>
      </div>
      <details className="mt-4 border-t border-[#38654c] pt-1">
        <summary onClick={() => scannerHaptic()} className="min-h-12 content-center text-sm font-semibold text-[#ffe3a0]">How confident is this score?</summary>
        <p className="text-sm leading-6 text-[#c7dece]">A score for the visible setup, not the chance of winning. It weighs supporting evidence, conflicts, the price trigger and level quality.</p>
        <ul className="mt-3 space-y-2 text-sm text-[#edf7ee]">{score.reasons.map(reason => <li key={reason} className="flex gap-2"><span aria-hidden="true" className="text-[#f6c96b]">•</span>{reason}</li>)}</ul>
      </details>
    </section>

    <section className={panel} aria-labelledby="scan-timing"><p className={`${styles.sectionLabel} mb-3`}>Your estimated timeline</p>
      <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#ffd361] text-[#072719]"><StockIcon name="clock" className="size-5" /></span><div><h3 id="scan-timing" className="text-2xl font-black tracking-tight">When could it happen?</h3><p className="text-xs text-[#c7dece]">{result.timeline.quality === "illustrative" ? "Illustrative monitoring windows" : "Estimated timeline"}</p></div></div>
      <ol className={`${styles.timelineGrid} mt-4`}>{[{ name: "Watch for entry", text: result.timeline.entry }, { name: "Allow for the target", text: result.timeline.target }, { name: "Check again", text: result.timeline.reassess }].map((step, index) =>
        <li key={step.name} className={styles.timelineCard}><span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#6cbd96]/30 bg-[#07442c] text-xs font-extrabold text-[#dcecdf]">{index + 1}</span><div><h4 className="text-sm font-bold text-[#fff4d8]">{step.name}</h4><p className="mt-2 text-sm leading-6 text-[#dcecdf]">{step.text}</p></div></li>)}
      </ol>
      <p className="mt-4 text-sm leading-6 text-[#c7dece]">{result.timeline.basis}</p><p className="mt-2 text-xs leading-5 text-[#c7dece]">Count from the latest candle in this screenshot. Market closures pause chart time. The price trigger matters more than the clock.</p>
    </section>

    <section className={`${styles.caution} p-5 sm:p-6`} aria-labelledby="scan-caution">
      <h3 id="scan-caution" className="text-2xl font-black tracking-tight text-[#edf7ee]">What could spoil the trade?</h3>
      <p className="mt-3 text-base leading-7 text-[#d5e4da]">{result.review.counterargument}</p>
      <div className="mt-4 rounded-xl border border-[#6cbd96]/25 bg-[#021e14]/70 p-3"><p className="text-sm font-bold text-[#edf7ee]">The exit rule</p><p className="mt-1 text-sm leading-6 text-[#d5e4da]">{result.invalidation}</p></div>
      <div className="mt-4 border-t border-[#6cbd96]/25 pt-4"><p className="text-sm font-bold text-[#edf7ee]">{result.review.headline}</p><p className="mt-1 text-sm leading-6 text-[#d5e4da]">{result.review.detail}</p></div>
    </section>

    <section id="scan-evidence" className={`${panel} ${styles.anchor}`} aria-labelledby="scan-evidence-title">
      <div className="flex items-start justify-between gap-3"><div><h3 id="scan-evidence-title" className="text-2xl font-black tracking-tight">Why this scenario?</h3><p className="mt-1 text-sm text-[#c7dece]">The chart clues, in plain English.</p></div><span className="rounded-full border border-[#ad9451]/60 bg-[#032a1b] px-3 py-2 text-xs font-black text-[#ffe09b]">{supports.length} supporting</span></div>
      <div className="mt-4 space-y-3">{[...supports, ...opposes, ...result.signals.filter(signal => signal.bias === "neutral")].map(signal => {
        const against = opposes.includes(signal), neutral = signal.bias === "neutral";
        return <div key={`${signal.region_id}:${signal.name}`} className={`${styles.evidenceCard} ${against || neutral ? styles.conflictCard : ""}`}>
          <span className={`text-xs font-bold ${against || neutral ? "text-[#ffe3a0]" : "text-[#85f8c7]"}`}>{against ? "Works against the trade" : neutral ? "Mixed clue" : "Supports the trade"}</span><h4 className="mt-1 text-lg font-extrabold">{result.signals.indexOf(signal) + 1}. {signal.name}</h4><p className="mt-2 text-sm leading-6 text-[#dcecdf]">{signal.evidence}</p>
          {signal.boxes.length > 0 && <button type="button" onClick={() => { setFocusedSignal(result.signals.indexOf(signal)); jump("scan-chart"); }} className={`${quietButton} mt-3 text-xs`}>Show me on the chart <span aria-hidden="true">↑</span></button>}
        </div>;
      })}{result.signals.length === 0 && <p className="text-sm leading-6 text-[#c7dece]">No directional finding survived review. The plan is an illustrative risk scenario.</p>}</div>
      {result.pattern_checks.length > 0 && <div className="mt-4 space-y-2">{result.pattern_checks.map(pattern => <div key={pattern.name} className="rounded-xl border border-[#6cbd96]/40 bg-[#032a1a] p-4"><p className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">{pattern.name}<span className={`rounded-full px-2.5 py-1 text-xs ${pattern.status === "confirmed" ? "bg-[#087648]/25 text-[#85f8c7]" : "bg-[#f6c96b]/20 text-[#ffe3a0]"}`}>{pattern.status === "confirmed" ? "Trigger seen" : "Still forming"}</span></p><p className="mt-2 text-sm leading-6 text-[#c7dece]">{pattern.evidence}</p></div>)}</div>}
      <div className="mt-5 rounded-2xl border border-[#6cbd96]/70 bg-[#02291a] p-4">
        <p className={styles.sectionLabel}>50+ candle patterns</p><div className="mt-2 flex items-end justify-between gap-3"><h4 className="text-xl font-black">{result.candle_audit.applicable ? `${result.candle_audit.detected} patterns agreed` : "A line chart, not candles"}</h4><span className="shrink-0 text-xs font-extrabold text-[#ffe09b]">{result.candle_audit.applicable ? result.candle_audit.checked === result.candle_audit.total ? "Checklist reviewed" : "Partial read" : "Not applicable"}</span></div>
        <p className="mt-2 text-xs leading-5 text-[#d5f5e2]">{result.candle_audit.applicable ? "Each pattern has its own status below. Agreement means both readers saw the shape and its context; a forming candle can still change." : "Candle patterns require visible open, high, low and close bodies. The scan uses price structure and readable indicators here."}</p>
        {result.candle_audit.checks.filter(check => check.status === "detected" || check.status === "unconfirmed").map(check => {
          const index = result.signals.findIndex(signal => signal.kind === "candle" && candlePatternId(null, signal.name) === check.id);
          return <div key={check.id} className="mt-3 rounded-xl border border-[#6cbd96]/40 bg-[#042c1c] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-sm font-extrabold">{check.name}</h5><span className="text-xs font-bold text-[#ffe09b]">{check.status === "unconfirmed" ? "Readers differ" : check.completed ? "Agreed" : "Still forming"}</span></div><p className="mt-2 text-sm leading-6 text-[#c9ead8]">{check.evidence}</p>{index >= 0 && result.signals[index].boxes.length > 0 && <button type="button" className={`${quietButton} mt-3 w-full`} onClick={() => { setFocusedSignal(index); jump("scan-chart"); }}>Highlight these candles ↑</button>}</div>;
        })}
        <details className="mt-3"><summary onClick={() => scannerHaptic()} className="min-h-12 content-center text-sm font-extrabold text-[#ffe09b]">View the 50+ candle checklist</summary><div>{result.candle_audit.checks.map(check => <div key={check.id} className={styles.auditRow}><span>{check.name}</span><span className={`shrink-0 text-xs font-bold ${check.status === "detected" ? "text-[#80ffbf]" : "text-[#ffe09b]"}`}>{check.status === "detected" ? check.completed ? "Agreed" : "Forming" : check.status === "not_present" ? "Not seen" : check.status === "unconfirmed" ? "Readers differ" : check.status === "unclear" ? "Unclear" : check.status === "not_applicable" ? "N/A" : "Not checked"}</span></div>)}</div></details>
      </div>
      <details className="mt-4 border-t border-[#38654c] pt-1"><summary onClick={() => scannerHaptic()} className="min-h-12 content-center text-sm font-bold text-[#ffe3a0]">All indicators · {result.indicator_checks.length} checked</summary>
        <div className="mt-2 space-y-4">{result.indicator_checks.map(check => <div key={check.id}><p className="text-sm font-bold">{check.name}<span className="ml-2 text-xs font-normal text-[#c7dece]">{check.status === "readable" ? "Read and reviewed" : check.status === "not_reviewed" ? "Review incomplete" : check.status === "not_confirmed" ? "Not confirmed" : "Not readable"}</span></p><p className="mt-1 text-sm leading-6 text-[#c7dece]">{check.finding || "No reliable finding from this image."}</p></div>)}{result.indicator_checks.length === 0 && <p className="text-sm text-[#c7dece]">No readable indicator panels were identified.</p>}{plan.rationale && <p className="border-t border-[#38654c] pt-3 text-sm leading-6 text-[#c7dece]">Why these prices: {plan.rationale}</p>}</div>
      </details>
    </section>

    {result.needs_more_info && <section className={panel}><p className="text-sm leading-6 text-[#dcecdf]">{result.more_info_prompt}</p><button type="button" onClick={() => { scannerHaptic(); onAddContext(); }} className={`${quietButton} mt-3 w-full`}>Add missing chart context</button></section>}
    {(plan.price_basis === "relative" || plan.price_basis === "user") && <button type="button" onClick={() => { scannerHaptic(); onReference(); }} className={`${quietButton} w-full`}>{plan.price_basis === "relative" ? "Add a reference price & rescan" : "Update reference price & rescan"}</button>}
    <Link href={askHref} onClick={() => scannerHaptic("open")} className={`${brightButton} w-full`}>Talk me through this trade <span aria-hidden="true">→</span></Link>
    <button type="button" onClick={shareRead} className={`${quietButton} w-full`}>Share this chart read <span aria-hidden="true">↗</span></button>
    {shareStatus && <p role="status" className="text-center text-sm text-[#ffe09b]">{shareStatus}</p>}
    <button type="button" onClick={onReset} className={`${quietButton} w-full`}>Scan another chart</button>
    <p className="px-2 text-center text-xs leading-5 text-[#bdd3c4]">Based on this screenshot, not live prices. Estimated levels need confirmation. Stops, targets and timing are scenarios, not guarantees.</p>
  </div>;
}
