import { PortfolioOpportunitiesWidget } from "@/components/PortfolioOpportunitiesWidget";
import { demoHoldings, demoOpportunities } from "@/lib/demo/demoData";
import { DemoMiniChart } from "./DemoMiniChart";

function MiniMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.055] p-3">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/42">
        {label}
      </p>
      <p className="mt-1 truncate text-[17px] font-black text-[#faf6f0]">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#faf6f0]/48">
        {sub}
      </p>
    </div>
  );
}

function DemoOrderForm({ mode }: { mode: "Trim" | "Buy more" }) {
  const fields =
    mode === "Trim"
      ? ["Value sold", "Price at order", "Shares sold"]
      : ["Value", "Price at order", "Shares"];

  return (
    <div className="rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/72 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            {mode} form
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-[#faf6f0]/52">
            Enter any two fields. StockGPT calculates the third and validates
            the order again on the server.
          </p>
        </div>
        <span className="rounded-full border border-[#ddb159]/24 px-3 py-1 text-[9px] font-black text-[#ddb159]">
          Demo only
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field} className="min-w-0">
            <p className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">
              {field}
            </p>
            <div className="h-11 rounded-2xl border border-[#ddb159]/18 bg-[#020805]/55 px-3 py-3 text-[12px] font-black text-[#faf6f0]/36">
              {field.includes("Price") ? "example 498.16" : "enter value"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-[#faf6f0]/[0.045] px-3 py-2 text-[11px] font-bold text-[#faf6f0]/58">
        Preview: 1.004 shares at $498.16 for $500.00. Educational workflow, not
        an instruction.
      </div>
    </div>
  );
}

export function DemoPortfolioManageView() {
  return (
    <div className="grid min-w-0 gap-3">
      <section className="overflow-hidden rounded-3xl border border-[#ddb159]/18 bg-[linear-gradient(180deg,#092116,#020805)]">
        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,330px)]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Portfolio overview
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-6xl">
              £8,012
            </h1>
            <p className="mt-2 text-sm font-black text-emerald-300">
              +£434 contribution-adjusted return · +5.6%
            </p>
            <p className="mt-2 text-[11px] font-semibold text-[#faf6f0]/45">
              Real chart history appears only after enough confirmed stored
              snapshots. Sparse or synthetic placeholders stay in a ghost state.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl bg-[#072116]/38">
              <DemoMiniChart height={230} gold />
            </div>
          </div>
          <div className="grid content-start gap-2">
            <div className="grid grid-cols-2 gap-2">
              <MiniMetric label="Health" value="82/100" sub="healthy draft" />
              <MiniMetric label="Holdings" value="4" sub="3 sectors" />
              <MiniMetric label="Cash" value="£1,460" sub="18.2% drag" />
              <MiniMetric label="Largest" value="27.3%" sub="position" />
            </div>
            <PortfolioOpportunitiesWidget
              opportunities={[...demoOpportunities]}
              variant="portfolio"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Holdings
          </p>
          <p className="mt-1 text-xs font-semibold text-white/45">
            Rows show value, P/L, allocation, AI score and a Manage action.
          </p>
        </div>
        {demoHoldings.map((holding) => (
          <div
            key={holding.ticker}
            className="grid min-w-0 gap-2 rounded-2xl bg-[#faf6f0] p-3 text-[#072116] sm:grid-cols-[minmax(160px,1fr)_92px_92px_82px_82px_94px] sm:items-center"
          >
            <div className="min-w-0">
              <p className="font-black">{holding.ticker}</p>
              <p className="truncate text-[10px] font-semibold text-[#072116]/45">
                {holding.company}
              </p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase text-[#072116]/35">
                Value
              </p>
              <p className="font-black">{holding.value}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase text-[#072116]/35">
                P/L
              </p>
              <p
                className={`font-black ${holding.pnl.startsWith("+") ? "text-emerald-700" : "text-red-700"}`}
              >
                {holding.pnl}
              </p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase text-[#072116]/35">
                Allocation
              </p>
              <p className="font-black">{holding.allocation}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase text-[#072116]/35">
                AI score
              </p>
              <p className="font-black text-[#8a641a]">{holding.score}</p>
            </div>
            <div className="rounded-full bg-[#072116] px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
              Manage
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="rounded-3xl border border-[#ddb159]/20 bg-[#04140c] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Manage holding decision panel
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            MSFT · Microsoft
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MiniMetric
              label="Recent movement"
              value="+0.6%"
              sub="latest reliable move"
            />
            <MiniMetric label="AI view" value="8,516" sub="rank #2" />
            <MiniMetric label="StockGPT view" value="Review" sub="not advice" />
          </div>
          <div className="mt-3 rounded-2xl border border-[#ddb159]/18 bg-[#ddb159]/10 p-3">
            <p className="text-[13px] font-black text-[#faf6f0]">
              Consider adding only after checking concentration.
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/58">
              The stock is high conviction and below target, but technology
              exposure is already meaningful. StockGPT frames this as research
              support, not a buy instruction.
            </p>
          </div>
          <div className="mt-3 grid gap-3">
            <DemoOrderForm mode="Trim" />
            <DemoOrderForm mode="Buy more" />
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-3xl border border-[#ddb159]/20 bg-[#061b12]/76 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              Add / Import
            </p>
            <div className="mt-3 grid gap-2">
              {[
                "Add cash",
                "Log existing holding",
                "Buy with cash or external purchase",
                "Import Trading 212 CSV",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.045] px-3 py-2 text-[11px] font-black text-[#faf6f0]/68"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[#ddb159]/20 bg-[#061b12]/76 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              Portfolio preferences
            </p>
            <div className="mt-3 grid gap-2">
              {[
                ["Objective", "Balanced"],
                ["Risk", "Moderate"],
                ["Time horizon", "5+ years"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-[#faf6f0] p-3 text-[#072116]"
                >
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="px-2 pb-32 text-[10px] font-semibold leading-5 text-white/42 sm:pb-4">
        Demo values are illustrative. Portfolio monitoring is educational
        research support, not financial advice.
      </p>
    </div>
  );
}
