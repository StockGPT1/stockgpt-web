import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { createClient } from "@/utils/supabase/server";
import { getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
import { calculateTradeLevels } from "@/lib/trading-levels";

type SearchParams = { a?: string; b?: string };
type Stock = { ticker: string | null; company: string | null; sector: string | null; rank: number | null; score: number | string | null; price: number | string | null };

function cleanTicker(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function pct(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—";
}

function whole(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function betterClass(left: number | null, right: number | null, side: "left" | "right", higher = true) {
  if (left == null || right == null || left === right) return "";
  const leftBetter = higher ? left > right : left < right;
  const winner = leftBetter ? "left" : "right";
  return winner === side ? "ring-1 ring-[#ddb159]/45 bg-[#ddb159]/10" : "";
}

async function loadStock(ticker: string) {
  if (!ticker) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("stock_rankings").select("ticker,company,sector,rank,score,price").eq("ticker", ticker).maybeSingle();
  if (!data) return null;

  const stock = data as Stock;
  const chart = await getStockChart(ticker, ["1D", "6M", "1Y"]);
  const livePrice = getLatestPriceFromChart(chart) ?? (Number(stock.price) || 0);
  const trade = await calculateTradeLevels({ ticker, price: livePrice, score: Number(stock.score) || 0, rank: Number(stock.rank) || null, sector: stock.sector ?? null });
  if (!trade) return null;
  return { ...stock, livePrice, trade };
}

function MetricRow({ label, left, right, leftScore, rightScore, higher = true }: { label: string; left: string; right: string; leftScore?: number | null; rightScore?: number | null; higher?: boolean }) {
  return (
    <div className="grid gap-2 border-t border-[#072116]/8 py-2.5 first:border-t-0 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#072116]/45">{label}</div>
      <div className={["min-w-0 rounded-xl px-2 py-1.5 text-[12px] font-black text-[#072116]", betterClass(leftScore ?? null, rightScore ?? null, "left", higher)].join(" ")}>{left}</div>
      <div className={["min-w-0 rounded-xl px-2 py-1.5 text-[12px] font-black text-[#072116]", betterClass(leftScore ?? null, rightScore ?? null, "right", higher)].join(" ")}>{right}</div>
    </div>
  );
}

function StockHeader({ stock }: { stock: NonNullable<Awaited<ReturnType<typeof loadStock>>> }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#ddb159]/20 bg-[#04180f]/70 p-4 text-[#faf6f0]">
      <div className="flex min-w-0 items-center gap-3">
        <StockLogo ticker={stock.ticker} company={stock.company} size={38} />
        <div className="min-w-0">
          <p className="text-[24px] font-black leading-none tracking-[-0.04em]">{stock.ticker}</p>
          <p className="mt-1 truncate text-[12px] font-semibold text-[#faf6f0]/58">{stock.company}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#ddb159] px-3 py-1 text-[10px] font-black text-[#072116]">Rank #{stock.rank ?? "—"}</span>
        <span className="rounded-full border border-[#ddb159]/25 px-3 py-1 text-[10px] font-black text-[#ddb159]">{stock.sector ?? "Sector —"}</span>
      </div>
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const leftTicker = cleanTicker(params.a) || "AAPL";
  const rightTicker = cleanTicker(params.b) || "MSFT";
  const [left, right] = await Promise.all([loadStock(leftTicker), loadStock(rightTicker)]);

  return (
    <AppShell activePath="/rankings">
      <main className="min-h-full overflow-y-auto overflow-x-hidden pb-8 pr-1">
        <section className="rounded-[28px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,0.07),rgba(250,246,240,0.025),rgba(221,177,89,0.06))] p-4 shadow-[0_16px_38px_rgba(0,0,0,0.2)]">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">StockGPT comparison</p>
          <h1 className="mt-1 text-[32px] font-black leading-none tracking-[-0.055em] text-[#faf6f0]">Compare two stocks</h1>
          <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-6 text-[#faf6f0]/58">Compare ranking metrics, AI trade-plan levels and expected return side by side.</p>
          <form className="mt-4 grid gap-2 rounded-2xl border border-[#ddb159]/14 bg-[#02150d]/62 p-2 sm:grid-cols-[1fr_1fr_auto]">
            <input name="a" defaultValue={leftTicker} placeholder="First ticker" className="h-11 min-w-0 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 text-[13px] font-black uppercase text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35" />
            <input name="b" defaultValue={rightTicker} placeholder="Second ticker" className="h-11 min-w-0 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 text-[13px] font-black uppercase text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35" />
            <button className="h-11 rounded-2xl bg-[#ddb159] px-6 text-[12px] font-black uppercase tracking-[0.1em] text-[#072116]">Compare</button>
          </form>
        </section>
        {!left || !right ? (
          <div className="mt-3 rounded-2xl bg-[#faf6f0] p-6 text-[13px] font-bold text-[#072116]/65">One of those tickers could not be found or does not currently have enough data for a generated trade plan.</div>
        ) : (
          <section className="mt-3 grid gap-3">
            <div className="grid gap-3 lg:grid-cols-2"><StockHeader stock={left} /><StockHeader stock={right} /></div>
            <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
              <MetricRow label="Price" left={money(left.livePrice)} right={money(right.livePrice)} />
              <MetricRow label="AI score" left={whole(left.score)} right={whole(right.score)} leftScore={Number(left.score)} rightScore={Number(right.score)} />
              <MetricRow label="Rank" left={`#${left.rank ?? "—"}`} right={`#${right.rank ?? "—"}`} leftScore={Number(left.rank)} rightScore={Number(right.rank)} higher={false} />
              <MetricRow label="Entry" left={money(left.trade.entry)} right={money(right.trade.entry)} />
              <MetricRow label="Stop" left={`${money(left.trade.stopLoss)} (${pct(left.trade.stopPct)})`} right={`${money(right.trade.stopLoss)} (${pct(right.trade.stopPct)})`} leftScore={Math.abs(left.trade.stopPct)} rightScore={Math.abs(right.trade.stopPct)} higher={false} />
              <MetricRow label="Target" left={`${money(left.trade.takeProfit)} (${pct(left.trade.targetPct)})`} right={`${money(right.trade.takeProfit)} (${pct(right.trade.targetPct)})`} leftScore={left.trade.targetPct} rightScore={right.trade.targetPct} />
              <MetricRow label="Risk/reward" left={`1:${left.trade.riskReward.toFixed(1)}`} right={`1:${right.trade.riskReward.toFixed(1)}`} leftScore={left.trade.riskReward} rightScore={right.trade.riskReward} />
              <MetricRow label="Expected" left={left.trade.plan ? `${left.trade.plan.expectedAnnualReturn.toFixed(1)}%/yr` : "—"} right={right.trade.plan ? `${right.trade.plan.expectedAnnualReturn.toFixed(1)}%/yr` : "—"} leftScore={left.trade.plan?.expectedAnnualReturn ?? null} rightScore={right.trade.plan?.expectedAnnualReturn ?? null} />
              <MetricRow label="Hold" left={left.trade.plan?.recommendedHoldPeriod ?? "—"} right={right.trade.plan?.recommendedHoldPeriod ?? "—"} />
              <MetricRow label="Rating" left={left.trade.recommendation} right={right.trade.recommendation} />
            </div>
            <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40">Comparison uses current StockGPT ranking data and generated trade-plan levels. It is a research tool, not financial advice.</p>
          </section>
        )}
      </main>
    </AppShell>
  );
}
