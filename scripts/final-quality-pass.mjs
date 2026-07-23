import fs from "node:fs";

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceAll(source, search, replacement) {
  if (!source.includes(search)) return source;
  return source.split(search).join(replacement);
}

// Restore global behaviours that were lost during mobile portfolio iterations.
{
  const path = "app/globals.css";
  let css = fs.readFileSync(path, "utf8");

  if (!css.includes("@keyframes stockTickerScroll")) {
    css += String.raw`

@keyframes stockTickerScroll {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-33.333%, 0, 0);
  }
}

.stock-ticker-track {
  animation: stockTickerScroll 42s linear infinite;
  will-change: transform;
}

.stock-ticker-track:hover {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .stock-ticker-track {
    animation-duration: 120s;
  }
}
`;
  }

  if (!css.includes("--sg-scrollbar-thumb-restored")) {
    css += String.raw`

:root {
  --sg-scrollbar-thumb-restored: 1;
}

.sg-candle-scrollbar,
.sg-public-candle-scrollbar,
.sg-landing,
.affiliate-page,
#affiliate-scroll-root {
  scrollbar-color: var(--sg-candle-body) var(--sg-scrollbar-track);
}

.sg-candle-scrollbar::-webkit-scrollbar-thumb,
.sg-candle-scrollbar *::-webkit-scrollbar-thumb,
.sg-public-candle-scrollbar::-webkit-scrollbar-thumb,
.sg-public-candle-scrollbar *::-webkit-scrollbar-thumb,
.sg-landing::-webkit-scrollbar-thumb,
.sg-landing *::-webkit-scrollbar-thumb,
.affiliate-page::-webkit-scrollbar-thumb,
.affiliate-page *::-webkit-scrollbar-thumb,
#affiliate-scroll-root::-webkit-scrollbar-thumb,
#affiliate-scroll-root *::-webkit-scrollbar-thumb {
  min-height: 54px;
  min-width: 54px;
  border: 7px solid var(--sg-scrollbar-track);
  border-radius: 999px;
  background:
    linear-gradient(to bottom, var(--sg-candle-body-light), var(--sg-candle-body) 48%, var(--sg-candle-body-dark));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    inset 0 -1px 0 rgba(0, 0, 0, 0.22),
    0 0 0 1px rgba(221, 177, 89, 0.22),
    0 0 18px rgba(221, 177, 89, 0.18);
}

.sg-candle-scrollbar::-webkit-scrollbar-thumb:hover,
.sg-candle-scrollbar *::-webkit-scrollbar-thumb:hover,
.sg-public-candle-scrollbar::-webkit-scrollbar-thumb:hover,
.sg-public-candle-scrollbar *::-webkit-scrollbar-thumb:hover,
.sg-landing::-webkit-scrollbar-thumb:hover,
.sg-landing *::-webkit-scrollbar-thumb:hover,
.affiliate-page::-webkit-scrollbar-thumb:hover,
.affiliate-page *::-webkit-scrollbar-thumb:hover,
#affiliate-scroll-root::-webkit-scrollbar-thumb:hover,
#affiliate-scroll-root *::-webkit-scrollbar-thumb:hover {
  background:
    linear-gradient(to bottom, #ffe39a, var(--sg-candle-body-hover) 48%, #a98231);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    inset 0 -1px 0 rgba(0, 0, 0, 0.24),
    0 0 0 1px rgba(221, 177, 89, 0.35),
    0 0 24px rgba(221, 177, 89, 0.28);
}

.sg-candle-scrollbar::-webkit-scrollbar-corner,
.sg-public-candle-scrollbar::-webkit-scrollbar-corner,
.sg-landing::-webkit-scrollbar-corner,
.affiliate-page::-webkit-scrollbar-corner,
#affiliate-scroll-root::-webkit-scrollbar-corner {
  background: var(--sg-scrollbar-track-deep);
}
`;
  }

  write(path, css);
}

// Remove pill styling from 1D move displays on rankings.
{
  const path = "app/rankings/page.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    /function DailyMovePill\([\s\S]*?\n}\n\nfunction matchesMoveFilter/,
    String.raw`function DailyMovePill({
  changePct,
  className = "text-[10px]",
}: {
  changePct: number | null | undefined;
  className?: string;
}) {
  const valid = Number.isFinite(changePct);
  const value = valid ? Number(changePct) : null;
  const tone = value == null ? "text-[#072116]/35" : value >= 0 ? "text-emerald-700" : "text-red-700";

  return (
    <span
      title="1D price move"
      className={["inline-flex shrink-0 items-center justify-end font-black tabular-nums", className, tone].join(" ")}
    >
      {value == null ? "—" : (value >= 0 ? "+" : "") + value.toFixed(1) + "%"}
    </span>
  );
}

function matchesMoveFilter`,
  );

  write(path, source);
}

// Add generated timestamps to alert cards.
{
  const path = "components/NotificationsList.tsx";
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes("function formatAlertTimestamp")) {
    source = source.replace(
      "function severityStyle",
      String.raw`function formatAlertTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Generated just now";
  return "Generated " + date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }) + " · " + date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function severityStyle`,
    );
  }

  source = source.replace(
    /<Link\n\s+href=\{`\/stock\/\$\{notification\.ticker\}`\}[\s\S]*?\n\s+<\/Link>\n\s+\{notification\.company && \(/,
    String.raw`<Link
              href={\`/stock/\${notification.ticker}\`}
              className="text-[11px] font-black tracking-wider text-[#072116] underline decoration-[#ddb159]/40 underline-offset-2 hover:decoration-[#ddb159]"
            >
              {notification.ticker}
            </Link>
            <span className="rounded-full border border-[#072116]/10 bg-white/70 px-2 py-0.5 text-[9px] font-black text-[#072116]/48">
              {formatAlertTimestamp(notification.createdAt)}
            </span>
            {notification.company && (`,
  );

  write(path, source);
}

// Portfolio quality pass.
{
  const path = "components/PortfolioCommandCentreRevolut.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    /(\s+trimHolding,\n)(\s*}\s*from "@\/lib\/actions\/portfolio-management";)/,
    "$1  buyHoldingWithCash,\n$2",
  );

  source = source.replace(
    /function recommendedTrimPercent\(holding: ExtendedHolding\) \{[\s\S]*?\n}\n\nfunction buildRangeData/,
    String.raw`type HoldingDecision = {
  action: "trim" | "exit" | "add" | "hold" | "review";
  percent: number;
  dollarAmount: number;
  title: string;
  detail: string;
  evidence: string[];
  tone: "positive" | "negative" | "neutral";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cleanPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function highQualityHolding(holding: ExtendedHolding) {
  const topRank = holding.rank != null && holding.rank <= 90;
  const highScore = holding.scorePercentile >= 68 || holding.score >= 6500;
  const strongMomentum = ["Booming", "Strong"].includes(holding.sectorMomentum);
  return (topRank || highScore) && strongMomentum && !holding.recommendation.includes("Sell") && !holding.recommendation.includes("Urgently");
}

function buildHoldingDecision(holding: ExtendedHolding): HoldingDecision {
  const evidence: string[] = [];
  const target = holding.targetAllocationPct ?? null;
  const allocationGap = target == null ? 0 : holding.currentAllocationPct - target;
  const underweightGap = target == null ? 0 : target - holding.currentAllocationPct;
  const severeAction = holding.actionAlerts.some((alert) => alert.severity === "critical" || alert.action === "sell");
  let trimEvidence = 0;
  let addEvidence = 0;

  if (holding.recommendation.includes("Sell") || severeAction) {
    evidence.push("Critical action alert or sell signal is active.");
    if (holding.rank != null && holding.rank > 350) evidence.push("Rank is outside the preferred range.");
    return {
      action: "exit",
      percent: 100,
      dollarAmount: 0,
      title: "Exit review supported",
      detail: "This is only shown because the position has severe evidence against it. Review before acting.",
      evidence,
      tone: "negative",
    };
  }

  if (allocationGap >= 2.5) {
    trimEvidence += 3;
    evidence.push("Position is " + allocationGap.toFixed(1) + " percentage points above target allocation.");
  } else if (allocationGap >= 1.25) {
    trimEvidence += 1.5;
    evidence.push("Position is mildly above target allocation.");
  }

  if (holding.recommendation.includes("Trim")) {
    trimEvidence += 2.5;
    evidence.push("StockGPT action alert already flags a trim review.");
  }

  if (holding.actionAlerts.some((alert) => alert.action === "trim")) {
    trimEvidence += 2;
    evidence.push("Action alert specifically points to trimming exposure.");
  }

  if (holding.rank != null && holding.rank > 300) {
    trimEvidence += 2;
    evidence.push("Rank has fallen into the lower part of the universe.");
  }

  if (holding.scorePercentile < 35 || holding.rankPercentile < 35) {
    trimEvidence += 1.5;
    evidence.push("Current model percentile is weak versus the wider universe.");
  }

  if (["Weak", "Struggling"].includes(holding.sectorMomentum)) {
    trimEvidence += 1.25;
    evidence.push("Sector momentum is weak.");
  }

  if (holding.scoreChange <= -500) {
    trimEvidence += 1.25;
    evidence.push("Score has deteriorated materially since entry.");
  }

  if (underweightGap >= 1.5) {
    addEvidence += 2.5;
    evidence.push("Position is " + underweightGap.toFixed(1) + " percentage points below target allocation.");
  }

  if (highQualityHolding(holding)) {
    addEvidence += 2.5;
    evidence.push("Rank, score and sector momentum support adding exposure.");
  }

  if (holding.recommendation.includes("Buying More")) {
    addEvidence += 2;
    evidence.push("StockGPT action alert supports adding more.");
  }

  if (holding.actionAlerts.some((alert) => alert.action === "buy_more")) {
    addEvidence += 2;
    evidence.push("Action alert specifically points to buying more.");
  }

  if (holding.totalPnLDollars < 0 && holding.scorePercentile >= 70 && holding.rank != null && holding.rank <= 100) {
    addEvidence += 1;
    evidence.push("Pullback is against a still-strong model signal.");
  }

  if (trimEvidence >= 5) {
    const trimToTarget = target && holding.currentAllocationPct > target
      ? ((holding.currentAllocationPct - target) / Math.max(holding.currentAllocationPct, 0.1)) * 100
      : 0;
    const alertTrim = holding.actionAlerts.length > 0 ? 8 + holding.actionAlerts.length * 3 : 0;
    const qualityPenaltyTrim = holding.rank != null && holding.rank > 350 ? 18 : holding.rank != null && holding.rank > 250 ? 10 : 0;
    const percent = cleanPercent(clamp(Math.max(trimToTarget, alertTrim, qualityPenaltyTrim), 3, 65));

    return {
      action: "trim",
      percent,
      dollarAmount: 0,
      title: "Trim review supported",
      detail: "The trim size is calculated from allocation excess, current model weakness and active action alerts. It is not a default filler.",
      evidence: evidence.slice(0, 5),
      tone: "negative",
    };
  }

  if (addEvidence >= 5 && trimEvidence < 3) {
    return {
      action: "add",
      percent: 0,
      dollarAmount: 0,
      title: "Add-more review supported",
      detail: "Evidence favours increasing exposure, subject to available cash and your preferred position sizing.",
      evidence: evidence.slice(0, 5),
      tone: "positive",
    };
  }

  if (holding.daysSinceReview > 30 || holding.eventAlerts.length > 0) {
    return {
      action: "review",
      percent: 0,
      dollarAmount: 0,
      title: "Review, but no forced trade",
      detail: "There is enough change to review the position, but not enough evidence for an automatic trim or add-more suggestion.",
      evidence: evidence.slice(0, 5).length ? evidence.slice(0, 5) : ["Evidence is mixed rather than one-sided."],
      tone: "neutral",
    };
  }

  return {
    action: "hold",
    percent: 0,
    dollarAmount: 0,
    title: "No trade suggested",
    detail: "There is not enough robust evidence to suggest trimming or adding. Holding is the cleanest recommendation for now.",
    evidence: evidence.slice(0, 5).length ? evidence.slice(0, 5) : ["No strong concentration, quality or alert signal is forcing action."],
    tone: "neutral",
  };
}

function recommendedTrimPercent(holding: ExtendedHolding) {
  const decision = buildHoldingDecision(holding);
  return decision.action === "trim" || decision.action === "exit" ? decision.percent : 0;
}

function buildCashAllocationIdeas({
  holdings,
  stockOptions,
  cashBalance,
  totalValue,
}: {
  holdings: ExtendedHolding[];
  stockOptions: StockOption[];
  cashBalance: number;
  totalValue: number;
}) {
  const minimumCash = Math.max(50, totalValue * 0.01);
  const deployableCash = Math.max(0, cashBalance - minimumCash);
  if (deployableCash <= 0) return [];

  const heldTickers = new Set(holdings.map((holding) => holding.ticker));
  const currentIdeas = holdings
    .map((holding) => {
      if (!highQualityHolding(holding)) return null;
      if (holding.actionAlerts.some((alert) => alert.action === "sell" || alert.action === "trim")) return null;
      const target = holding.targetAllocationPct ?? 0;
      const gapPct = target - holding.currentAllocationPct;
      if (gapPct < 1) return null;
      const targetDollarGap = totalValue * (gapPct / 100);
      const amount = Math.floor(Math.min(deployableCash * 0.45, targetDollarGap, Math.max(35, holding.currentValue * 0.35)));
      if (amount < 25) return null;
      const conviction = gapPct * 2 + holding.scorePercentile / 10 + (holding.rank != null ? Math.max(0, 100 - holding.rank / 5) / 10 : 0);
      return {
        ticker: holding.ticker,
        company: holding.company,
        price: holding.currentPrice,
        amount,
        reason: "Under target with strong rank, score and sector support.",
        conviction,
      };
    })
    .filter((idea): idea is { ticker: string; company: string | null; price: number; amount: number; reason: string; conviction: number } => Boolean(idea));

  const newIdeas = stockOptions
    .filter((stock) => stock.ticker && !heldTickers.has(stock.ticker) && stock.rank != null && stock.rank <= 25 && stock.price != null && stock.price > 0)
    .slice(0, 8)
    .map((stock) => ({
      ticker: stock.ticker,
      company: stock.company,
      price: stock.price ?? 0,
      amount: Math.floor(Math.min(deployableCash * 0.25, Math.max(35, totalValue * 0.025))),
      reason: "High-ranked unowned name that could diversify spare cash.",
      conviction: 90 - (stock.rank ?? 25),
    }))
    .filter((idea) => idea.amount >= 25);

  return [...currentIdeas, ...newIdeas]
    .sort((a, b) => b.conviction - a.conviction)
    .slice(0, 3);
}

function buildRangeData`,
  );

  const cashPanel = String.raw`
function CashAllocationPanel({
  portfolioId,
  currency,
  cashBalance,
  totalValue,
  holdings,
  stockOptions,
}: {
  portfolioId: string;
  currency: string;
  cashBalance: number;
  totalValue: number;
  holdings: ExtendedHolding[];
  stockOptions: StockOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const ideas = useMemo(
    () => buildCashAllocationIdeas({ holdings, stockOptions, cashBalance, totalValue }),
    [cashBalance, holdings, stockOptions, totalValue],
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    ideas.forEach((idea) => {
      initial[idea.ticker] = String(idea.amount);
    });
    return initial;
  });

  if (cashBalance <= Math.max(50, totalValue * 0.01)) return null;

  function buyIdea(ticker: string, price: number) {
    const amount = Number(amounts[ticker]);
    if (!Number.isFinite(amount) || amount <= 0) return;
    startTransition(async () => {
      const result = await buyHoldingWithCash({
        portfolioId,
        ticker,
        dollarAmount: amount,
        entryPrice: price > 0 ? price : null,
        notes: "StockGPT spare cash allocation suggestion.",
      });
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 text-[#faf6f0]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Spare cash</p>
      <h3 className="mt-1 text-[18px] font-black tracking-[-0.04em]">{money(cashBalance, currency)} available</h3>
      {ideas.length === 0 ? (
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/52">
          No deployment is recommended right now. Cash is useful until there is a strong enough rank, allocation and risk signal.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {ideas.map((idea) => (
            <div key={idea.ticker} className="rounded-2xl border border-white/8 bg-white/[0.045] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[#faf6f0]">{idea.ticker} <span className="font-semibold text-[#faf6f0]/42">{idea.company ? "· " + idea.company : ""}</span></p>
                  <p className="mt-1 text-[11px] font-semibold leading-4 text-[#faf6f0]/48">{idea.reason}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-1 text-[9px] font-black text-[#ddb159]">Suggested</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amounts[idea.ticker] ?? String(idea.amount)}
                  onChange={(event) => setAmounts((current) => ({ ...current, [idea.ticker]: event.target.value }))}
                  className="h-10 min-w-0 rounded-2xl border border-white/10 bg-[#02150d] px-3 text-[12px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
                />
                <button type="button" disabled={isPending} onClick={() => buyIdea(idea.ticker, idea.price)} className="h-10 rounded-2xl bg-[#ddb159] px-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#072116] disabled:opacity-50">
                  Allocate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

`;

  if (!source.includes("function CashAllocationPanel")) {
    source = source.replace("function ManageHoldingModal", cashPanel + "function ManageHoldingModal");
  }

  source = source.replace(
    /function ManageHoldingModal\({[\s\S]*?\n}\n\nfunction MiniMetric/,
    String.raw`function ManageHoldingModal({ portfolioId, holding, recommendedPercent, onClose }: { portfolioId: string; holding: ExtendedHolding; recommendedPercent: number; onClose: () => void }) {
  const router = useRouter();
  const decision = buildHoldingDecision(holding);
  const initialTrim = decision.action === "trim" || decision.action === "exit" ? Math.max(1, Math.min(100, decision.percent)) : Math.max(1, Math.min(50, recommendedPercent || 10));
  const [customPercent, setCustomPercent] = useState(String(initialTrim));
  const [buyAmount, setBuyAmount] = useState(decision.action === "add" ? "100" : "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runTrim(rawPercent: number) {
    const percent = Math.round(Number(rawPercent) * 10) / 10;
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setMessage("Enter a trim percentage between 1 and 100.");
      return;
    }
    startTransition(async () => {
      const result = await trimHolding({ portfolioId, ticker: holding.ticker, percentage: percent });
      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }
      setMessage(holding.ticker + " trimmed by " + percent + "%.");
      router.refresh();
      window.setTimeout(onClose, 650);
    });
  }

  function runBuy() {
    const amount = Number(buyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a positive cash amount to allocate.");
      return;
    }
    startTransition(async () => {
      const result = await buyHoldingWithCash({
        portfolioId,
        ticker: holding.ticker,
        dollarAmount: amount,
        entryPrice: holding.currentPrice > 0 ? holding.currentPrice : null,
        notes: "StockGPT add-more recommendation.",
      });
      if (!result.success) {
        setMessage(result.error ?? "Could not buy with cash.");
        return;
      }
      setMessage("Allocated " + money(amount) + " to " + holding.ticker + ".");
      router.refresh();
      window.setTimeout(onClose, 650);
    });
  }

  function runRemove(creditCash: boolean) {
    const label = creditCash ? "sell this entire position and credit cash" : "remove this holding without adding cash";
    if (!window.confirm("Are you sure you want to " + label + " for " + holding.ticker + "?")) return;
    startTransition(async () => {
      const result = creditCash
        ? await trimHolding({ portfolioId, ticker: holding.ticker, percentage: 100 })
        : await removeHolding({ portfolioId, ticker: holding.ticker, creditCash: false });
      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }
      setMessage(creditCash ? holding.ticker + " sold." : holding.ticker + " removed.");
      router.refresh();
      window.setTimeout(onClose, 650);
    });
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#020805] p-3 sm:p-6">
      <button type="button" aria-label="Close manage holding" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[#ddb159]/22 bg-[#faf6f0] text-[#072116] shadow-[0_28px_90px_rgba(0,0,0,0.75)] sm:max-h-[calc(100dvh-48px)] sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-3 border-b border-[#072116]/10 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a641a]">Manage holding</p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <StockLogo ticker={holding.ticker} size={38} />
              <div className="min-w-0">
                <h3 className="truncate text-[28px] font-black leading-none tracking-[-0.05em]">{holding.ticker}</h3>
                <p className="mt-1 truncate text-[12px] font-bold text-[#072116]/52">{holding.company ?? "Holding"}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-[#072116]/12 text-[#072116]/55 transition hover:bg-[#072116]/5" aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric label="Value" value={money(holding.currentValue)} sub={number(holding.shares, 4) + " sh"} />
            <MiniMetric label="Allocation" value={holding.currentAllocationPct.toFixed(1) + "%"} sub={"target " + (holding.targetAllocationPct?.toFixed(1) ?? "—") + "%"} />
            <MiniMetric label="P/L" value={money(holding.totalPnLDollars)} sub={pct(holding.pnlPercent)} tone={holding.totalPnLDollars >= 0 ? "positive" : "negative"} />
            <MiniMetric label="Score" value={number(holding.score, 0)} sub={"rank #" + (holding.rank ?? "—")} tone="gold" />
          </div>

          <div className={["rounded-2xl border p-3", decision.tone === "positive" ? "border-emerald-500/20 bg-emerald-500/8" : decision.tone === "negative" ? "border-red-500/20 bg-red-500/8" : "border-[#ddb159]/20 bg-[#ddb159]/10"].join(" ")}>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a641a]">Recommended action</p>
            <h4 className="mt-1 text-[17px] font-black tracking-[-0.035em] text-[#072116]">{decision.title}</h4>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-[#072116]/65">{decision.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {decision.evidence.map((item) => (
                <span key={item} className="rounded-full border border-[#072116]/10 bg-white/70 px-2 py-1 text-[9px] font-bold text-[#072116]/58">{item}</span>
              ))}
            </div>
            {(decision.action === "trim" || decision.action === "exit") && (
              <button type="button" disabled={isPending} onClick={() => runTrim(decision.percent)} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-50">
                {decision.action === "exit" ? "Sell full position" : "Apply suggested " + decision.percent + "% trim"}
              </button>
            )}
            {decision.action === "add" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input type="number" min={1} step={1} value={buyAmount} onChange={(event) => setBuyAmount(event.target.value)} placeholder="Cash amount" className="h-10 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-black outline-none focus:border-[#ddb159]" />
                <button type="button" disabled={isPending} onClick={runBuy} className="h-10 rounded-2xl bg-[#072116] px-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-50">Add using cash</button>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#072116]/10 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/42">Manual trim</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input type="number" min={1} max={100} step={0.5} value={customPercent} onChange={(event) => setCustomPercent(event.target.value)} className="h-11 w-full rounded-2xl border border-[#072116]/10 px-3 text-[14px] font-black outline-none focus:border-[#ddb159]" />
                <button type="button" disabled={isPending} onClick={() => runTrim(Number(customPercent))} className="h-11 rounded-2xl bg-[#ddb159] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] disabled:opacity-50">Trim %</button>
              </div>
            </div>
            <div className="rounded-2xl border border-[#072116]/10 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/42">Manual add</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input type="number" min={1} step={1} value={buyAmount} onChange={(event) => setBuyAmount(event.target.value)} placeholder="Cash amount" className="h-11 w-full rounded-2xl border border-[#072116]/10 px-3 text-[14px] font-black outline-none focus:border-[#ddb159]" />
                <button type="button" disabled={isPending} onClick={runBuy} className="h-11 rounded-2xl bg-[#072116] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-50">Add</button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={isPending} onClick={() => runRemove(true)} className="h-11 rounded-2xl border border-red-500/30 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-50">Sell all + credit cash</button>
            <button type="button" disabled={isPending} onClick={() => runRemove(false)} className="h-11 rounded-2xl border border-[#072116]/15 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116]/55 disabled:opacity-50">Remove only</button>
          </div>

          {message && <p className="rounded-2xl bg-[#072116]/6 px-3 py-2 text-[11px] font-bold text-[#072116]/62">{message}</p>}
        </div>
      </div>
    </div>
  );
}

function MiniMetric`,
  );

  // Remove desktop diagonal pattern from the portfolio chart hero and use a subtle gradient instead.
  source = source.replace(/\s*<div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1\/2 bg-\[repeating-linear-gradient[\s\S]*?sm:block" \/>/g, "");
  source = replaceAll(
    source,
    "sm:bg-[#050706]",
    "sm:bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.09),transparent_34%),radial-gradient(circle_at_24%_58%,rgba(16,185,129,0.12),transparent_44%),linear-gradient(180deg,#050706_0%,#061b12_100%)]",
  );

  if (!source.includes("<CashAllocationPanel")) {
    source = source.replace(
      '          <div className="grid content-start gap-3">\n',
      '          <div className="grid content-start gap-3">\n            <CashAllocationPanel portfolioId={portfolioId} currency={currency} cashBalance={portfolioMeta.cashBalance} totalValue={summary.totalValue} holdings={holdings} stockOptions={stockOptions} />\n',
    );
  }

  write(path, source);
}
