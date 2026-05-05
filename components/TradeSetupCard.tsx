import type { TradeLevels, TradeTrigger } from "@/lib/trading-levels";

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

function TriggerIcon({ icon }: { icon: TradeTrigger["icon"] }) {
  if (icon === "target") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
      </svg>
    );
  }
  if (icon === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v5M12 18v.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function triggerToneStyle(tone: TradeTrigger["tone"]) {
  if (tone === "positive")
    return {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: "text-emerald-700",
      text: "text-emerald-900",
    };
  if (tone === "negative")
    return {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: "text-red-700",
      text: "text-red-900",
    };
  return {
    bg: "bg-[#072116]/4",
    border: "border-[#072116]/12",
    icon: "text-[#072116]/65",
    text: "text-[#072116]",
  };
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
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${recStyle.glow}`}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            ✦ AI Trade Plan
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

          {/* ✦ NEW: AI Timeline + Plan */}
          {levels.plan && (
            <div className="relative mt-4 rounded-xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#fdf8ed,#faf6f0)] p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
                ✦ AI Projected Timeline
              </p>

              {/* Timeline metrics */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                    Expected Return
                  </p>
                  <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-emerald-700">
                    {levels.plan.expectedAnnualReturn}%/yr
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                    Target Date
                  </p>
                  <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em]">
                    {levels.plan.expectedTargetDate}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
                    Hold Period
                  </p>
                  <p className="mt-0.5 text-[14px] font-black tracking-[-0.02em]">
                    {levels.plan.recommendedHoldPeriod}
                  </p>
                </div>
              </div>

              {/* Thesis */}
              <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#072116]/75">
                {levels.plan.thesis}
              </p>

              {/* Triggers */}
              <div className="mt-4">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
                  ✦ AI Action Plan — If This, Then That
                </p>
                <div className="mt-2 grid gap-2">
                  {levels.plan.triggers.map((trigger, i) => {
                    const tone = triggerToneStyle(trigger.tone);
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-lg border ${tone.border} ${tone.bg} px-3 py-2.5`}
                      >
                        <div className={`shrink-0 ${tone.icon}`}>
                          <TriggerIcon icon={trigger.icon} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[12px] font-black tracking-[-0.01em] ${tone.text}`}
                          >
                            {trigger.condition}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/60">
                            → {trigger.action}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="relative mt-5 rounded-xl border border-red-200 bg-red-50/50 p-4 text-center">
          <p className="text-[13px] font-bold text-red-700">
            Insufficient signal strength to suggest entry levels.
          </p>
          <p className="mt-1 text-[11px] font-semibold text-red-700/70">
            The AI recommends waiting for a better setup.
          </p>
        </div>
      )}

      {/* Factor breakdown */}
      <div className="relative mt-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ Built From
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
        ⚠️ AI-generated trade plan based on quantitative factors. Not financial
        advice. Past performance does not guarantee future results.
      </p>
    </div>
  );
}
