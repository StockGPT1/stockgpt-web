import type { TradeLevels } from "@/lib/trading-levels";

function recommendationStyle(rec: TradeLevels["recommendation"]) {
  switch (rec) {
    case "Strong Buy":
      return {
        bg: "bg-emerald-500",
        text: "text-white",
        glow: "bg-emerald-500/20",
      };
    case "Buy":
      return {
        bg: "bg-emerald-400",
        text: "text-[#072116]",
        glow: "bg-emerald-400/20",
      };
    case "Hold / Watch":
      return {
        bg: "bg-[#ddb159]",
        text: "text-[#072116]",
        glow: "bg-[#ddb159]/20",
      };
    case "Avoid":
      return {
        bg: "bg-red-500",
        text: "text-white",
        glow: "bg-red-500/20",
      };
  }
}

export function TradeSetupCard({
  levels,
  currency = "$",
}: {
  levels: TradeLevels;
  currency?: string;
}) {
  const recStyle = recommendationStyle(levels.recommendation);
  const showLevels = levels.recommendation !== "Avoid";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      {/* Glow accent */}
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${recStyle.glow}`}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            AI Trade Setup
          </p>
          <h3 className="mt-0.5 text-[20px] font-black tracking-[-0.03em]">
            Suggested Levels
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${recStyle.bg} ${recStyle.text}`}
        >
          {levels.recommendation}
        </span>
      </div>

      {showLevels ? (
        <>
          {/* Levels grid */}
          <div className="relative mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#072116]/10 bg-white px-3 py-3">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/45">
                Entry
              </p>
              <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em]">
                {currency}
                {levels.entry.toFixed(2)}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-[#072116]/50">
                Suggested
              </p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/50 px-3 py-3">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-red-700/70">
                Stop Loss
              </p>
              <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em] text-red-700">
                {currency}
                {levels.stopLoss.toFixed(2)}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-red-700/70">
                −{levels.stopPct}%
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-3">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-emerald-700/70">
                Take Profit
              </p>
              <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em] text-emerald-700">
                {currency}
                {levels.takeProfit.toFixed(2)}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-emerald-700/70">
                +{levels.targetPct}%
              </p>
            </div>
          </div>

          {/* Risk:Reward */}
          <div className="relative mt-3 flex items-center justify-between rounded-xl bg-[#072116] px-4 py-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#ddb159]/80">
              Risk / Reward
            </p>
            <p className="text-[14px] font-black text-[#ddb159]">
              1 : {levels.riskReward}
            </p>
          </div>
        </>
      ) : (
        <div className="relative mt-5 rounded-xl border border-red-200 bg-red-50/50 p-4 text-center">
          <p className="text-[13px] font-bold text-red-700">
            Insufficient signal strength to suggest entry levels.
          </p>
          <p className="mt-1 text-[11px] font-semibold text-red-700/70">
            The model recommends waiting for a better setup.
          </p>
        </div>
      )}

      {/* Factor breakdown */}
      <div className="relative mt-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          Based on
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {levels.factors.map((f) => (
            <div
              key={f.label}
              className="rounded-lg border border-[#072116]/8 bg-white/60 px-3 py-2"
            >
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                {f.label}
              </p>
              <p className="mt-0.5 truncate text-[12px] font-bold">{f.value}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/55">
                {f.note}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="relative mt-4 text-[10px] font-medium leading-relaxed text-[#072116]/45">
        ⚠️ AI-generated setup based on quantitative factors. Not financial
        advice. Past performance does not guarantee future results.
      </p>
    </div>
  );
}
