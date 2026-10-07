"use client";

import Link from "next/link";
import { useMemo, useRef, type ReactNode } from "react";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";
import { buildPortfolioOverviewSnapshot } from "@/lib/portfolio-overview";
import type { PortfolioMeta } from "@/components/portfolio-workspace/types";
import { formatDate, money, signedMoney, toneClass } from "@/components/portfolio-workspace/utils";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import styles from "./PortfolioOverview.module.css";

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className={styles.heading}>
    <div className="min-w-0"><h2 className={styles.title}>{title}</h2>{detail && <p className={styles.description}>{detail}</p>}</div>
    {action}
  </div>;
}

function Metric({ label, value, detail, onClick }: { label: string; value: string; detail: string; onClick?: () => void }) {
  return <div className={styles.metric}><dt className={styles.metricLabel}>{label}</dt><dd className={styles.metricValue} title={value}>{onClick ? <button type="button" onClick={onClick} aria-label={`Review ${value} flagged position${value === "1" ? "" : "s"}`} className={styles.reviewJump}>{value}<PortfolioIcon name="arrow" className="size-4 text-[#ddb159]" /></button> : value}</dd><p className={styles.metricDetail}>{detail}</p></div>;
}

export function PortfolioOverview({
  portfolioId, meta, summary, holdings, opportunities, canUsePremium, latestActivityDate,
  onHolding, onAnalysis, onViewHoldings, onAdd,
}: {
  portfolioId: string;
  meta: PortfolioMeta;
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  opportunities: DashboardPortfolioOpportunity[];
  canUsePremium: boolean;
  latestActivityDate: string | null;
  onHolding: (holding: ExtendedHolding) => void;
  onAnalysis: () => void;
  onViewHoldings: () => void;
  onAdd: () => void;
}) {
  const snapshot = useMemo(() => buildPortfolioOverviewSnapshot({ holdings, cashBalance: meta.cashBalance, riskTolerance: meta.riskTolerance }), [holdings, meta.cashBalance, meta.riskTolerance]);
  const hasHoldings = snapshot.holdingsCount > 0;
  const missingPrices = snapshot.missingPriceCount > 0;
  const partialValuation = !snapshot.valuationComplete;
  const unrealisedAvailable = !partialValuation && Number.isFinite(summary.unrealisedPnl);
  const researchIdeas = opportunities.slice(0, 3);
  const reviewsRef = useRef<HTMLElement>(null);

  return <div className={styles.overview}>
    <section aria-label="Portfolio at a glance" className={styles.snapshot}>
      <p className={styles.eyebrow}>At a glance</p>
      <dl className={styles.metrics}>
        <Metric label="Invested" value={money(snapshot.holdingsValue, meta.currency)} detail={partialValuation ? "Priced holdings value" : "Current holdings value"} />
        <Metric label="Cash" value={snapshot.cashValid ? money(meta.cashBalance, meta.currency) : "Unavailable"} detail={snapshot.allocationAvailable ? `${snapshot.cashPercentage.toFixed(1)}% of ${partialValuation ? "available valuation" : "portfolio value"}` : "Cash balance"} />
        <Metric label="Positions" value={String(snapshot.holdingsCount)} detail={snapshot.unknownSectorCount ? `${Math.max(0, snapshot.sectorCount - 1)} ${partialValuation ? "priced " : ""}sectors · ${snapshot.unknownSectorCount} unclassified` : `${snapshot.sectorCount} ${partialValuation ? "priced " : ""}sectors`} />
        <Metric label="Needs review" value={hasHoldings ? String(snapshot.reviews.length) : "—"} detail={hasHoldings ? "Positions with review flags" : "Add a holding to begin"} onClick={snapshot.reviews.length ? () => reviewsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) : undefined} />
      </dl>
    </section>

    {!hasHoldings && <section className={styles.empty}>
      <h2 className={styles.title}>{meta.cashBalance > 0 ? "Your cash is recorded" : "Start with what you own"}</h2>
      <p className={styles.description}>{meta.cashBalance > 0 ? "Log existing holdings to see allocation, unrealised returns and review signals." : "Add cash, log an existing holding or import your Trading 212 holdings."}</p>
      <button type="button" onClick={onAdd} data-native-haptic="medium" className={styles.primaryAction}>Add to portfolio <PortfolioIcon name="plus" className="size-4" /></button>
    </section>}

    {(hasHoldings || meta.cashBalance > 0) && <div className={styles.mainGrid}>
      <section className={styles.section}>
        <SectionHeading title={partialValuation ? "Available valuation" : "Where your money sits"} detail={partialValuation ? "Priced holdings and cash. Unpriced positions are excluded from this breakdown." : "Allocation across your holdings and cash."} action={hasHoldings ? <button type="button" onClick={onViewHoldings} className={styles.textAction}>View all <span aria-hidden="true">→</span></button> : undefined} />
        {snapshot.allocationAvailable ? <ul className={styles.allocations}>
          {snapshot.allocations.map(row => <li key={row.key}>
            {row.holding ? <button type="button" onClick={() => onHolding(row.holding!)} className={styles.allocationRow} aria-label={`Review ${row.label}, ${row.displayPercentage.toFixed(1)}% of ${partialValuation ? "available valuation" : "portfolio value"}`}>
              <span className={styles.allocationLabel}>{row.label}<span className={styles.allocationCompany}>{row.holding.company || "Holding"}</span></span>
              <span className={styles.allocationNumbers}><span>{money(row.value, meta.currency)}</span><span className={styles.percentage}>{row.displayPercentage.toFixed(1)}%</span></span>
              <span className={styles.barTrack} aria-hidden="true"><span className={styles.barFill} style={{ width: `${row.percentage}%` }} /></span>
            </button> : <div className={styles.allocationRow}>
              <span className={styles.allocationLabel}>{row.label}<span className={styles.allocationCompany}>{row.kind === "cash" ? "Cash balance" : "Remaining positions"}</span></span>
              <span className={styles.allocationNumbers}><span>{money(row.value, meta.currency)}</span><span className={styles.percentage}>{row.displayPercentage.toFixed(1)}%</span></span>
              <span className={styles.barTrack} aria-hidden="true"><span className={`${styles.barFill} ${row.kind === "cash" ? styles.cashBar : styles.otherBar}`} style={{ width: `${row.percentage}%` }} /></span>
            </div>}
          </li>)}
        </ul> : <p className={styles.stateCopy}>Allocation appears when portfolio balances can be valued.</p>}
        {missingPrices && <p className={styles.valuationNote}>{snapshot.missingPriceCount} holding{snapshot.missingPriceCount === 1 ? " has" : "s have"} no current price. Review {snapshot.missingPriceCount === 1 ? "it" : "them"} below before treating this as a complete valuation.</p>}
        {partialValuation && !missingPrices && <p className={styles.valuationNote}>A balance or holding valuation is unavailable. Percentages are hidden until those values can be confirmed.</p>}
      </section>

      {hasHoldings && <div className={styles.sidebar}>
      <section className={styles.section}>
        <SectionHeading title="Unrealised contributors" detail="Largest open-position gains and losses by amount, since entry." />
        <div className={styles.contributors}>
          {([{ label: "Biggest gain", holding: snapshot.gainContributor }, { label: "Biggest loss", holding: snapshot.lossContributor }] as const).map(({ label, holding }) => <div key={label} className={styles.contributor}>
            <p className={styles.metricLabel}>{label}</p>
            {holding ? <button type="button" onClick={() => onHolding(holding)} className={styles.contributorButton} aria-label={`Review ${holding.ticker}, ${label.toLowerCase()} in unrealised return`}>
              <span className={styles.contributorTicker}>{holding.ticker} <PortfolioIcon name="arrow" className="size-4" /></span>
              <span className={`${styles.contributorValue} ${toneClass(holding.totalPnLDollars)}`}>{signedMoney(holding.totalPnLDollars, meta.currency)}</span>
              <span className={styles.contributorCompany}>{holding.company || holding.ticker}</span>
            </button> : <p className={styles.stateCopy}>{label === "Biggest gain" ? "No gain among priced holdings" : "No loss among priced holdings"}</p>}
          </div>)}
        </div>
        <dl className={styles.returnBreakdown}>
          <div><dt>Unrealised P/L</dt><dd className={unrealisedAvailable ? toneClass(summary.unrealisedPnl) : styles.muted}>{unrealisedAvailable ? signedMoney(summary.unrealisedPnl, meta.currency) : "Unavailable in full"}</dd></div>
          <div><dt>Recorded realised P/L</dt><dd className={Number.isFinite(summary.realisedPnl) ? toneClass(summary.realisedPnl) : styles.muted}>{Number.isFinite(summary.realisedPnl) ? signedMoney(summary.realisedPnl, meta.currency) : "Unavailable"}</dd></div>
        </dl>
        <p className={styles.footnote}>Unrealised P/L is on holdings you still own. Recorded realised P/L comes from the sale history available for this portfolio.</p>
      </section>
      <section ref={reviewsRef} className={`${styles.section} ${styles.reviewSection}`}>
      <SectionHeading title="Worth a look" detail="Active alerts and exposure flags. Open a holding to inspect the context." action={snapshot.reviews.length > 4 ? <button type="button" onClick={onViewHoldings} className={styles.textAction}>View holdings <span aria-hidden="true">→</span></button> : undefined} />
      {snapshot.reviews.length ? <ul className={styles.reviews}>
        {snapshot.reviews.slice(0, 4).map(review => <li key={review.key}><button type="button" onClick={() => onHolding(review.holding)} className={styles.reviewRow}>
          <span className={styles.reviewTicker}>{review.holding.ticker}</span><span className={styles.reviewText}><span className={styles.reviewTitle}>{review.title}</span><span className={styles.reviewDetail}>{review.detail}</span></span><PortfolioIcon name="arrow" className="size-4 shrink-0 text-[#ddb159]" />
        </button></li>)}
      </ul> : <p className={styles.stateCopy}>No current review flags in the available holding data.</p>}
      </section>
      </div>}
    </div>}

    <section className={styles.analysis}>
      <div><h2 className={styles.title}>Make sense of your portfolio</h2><p className={styles.description}>{hasHoldings ? "Explore your allocation, model signals and the reasons behind a review." : "Ask about your goals or explore how portfolio analysis works."}</p>{latestActivityDate && <p className={styles.footnote}>Last recorded activity: {formatDate(latestActivityDate)}.</p>}</div>
      <div className={styles.analysisActions}>
        <AskStockGPTButton canUseAskStockGPT={canUsePremium} isAuthenticated label="Ask StockGPT" context={{ contextType: "portfolio", portfolioId }} className="h-11 rounded-full px-4 text-xs" />
        <button type="button" onClick={onAnalysis} className={styles.secondaryAction}>Full analysis</button>
      </div>
    </section>

    <section className={styles.section}>
      <SectionHeading title="Portfolio-fit ideas" detail="Research prompts from the model, with a reason and a risk to check." action={<Link href="/rankings" className={styles.textAction}>Rankings <span aria-hidden="true">→</span></Link>} />
      {researchIdeas.length ? <div className={styles.ideas}>
        {researchIdeas.map(idea => <article key={`${idea.ticker}-${idea.category}`} className={styles.idea}>
          <div className={styles.ideaHeading}><h3>{idea.ticker}<span>{idea.company}</span></h3><Link href={`/stock/${encodeURIComponent(idea.ticker)}`} className={styles.researchAction}>Research <span className="sr-only">{idea.ticker}</span><PortfolioIcon name="arrow" className="size-4" /></Link></div>
          <p className={styles.ideaCategory}>{idea.category}</p><p className={styles.ideaReason}>{idea.reason}</p><p className={styles.ideaRisk}><span>Risk to consider:</span> {idea.risk || "Review the stock's risks before drawing a conclusion."}</p>
          <p className={styles.footnote}>{idea.updatedAt ? `Model data: ${formatDate(idea.updatedAt, true)}` : "Model data timestamp unavailable"}</p>
        </article>)}
      </div> : <p className={styles.stateCopy}>{hasHoldings ? "No portfolio-fit research ideas are available in the current model data." : "Portfolio-fit research appears as you add holdings and the model finds relevant ideas."}</p>}
    </section>
  </div>;
}
