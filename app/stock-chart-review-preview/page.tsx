import { notFound } from "next/navigation";
import { StockChart, type ChartPoint, type TimeRange } from "@/components/StockChart";

export const metadata = {
  title: "StockGPT stock chart design preview",
  robots: { index: false, follow: false },
};

const RANGES: TimeRange[] = ["1D", "5D", "1M", "1Y", "5Y", "MAX"];
const END = Date.parse("2026-10-08T15:30:00.000Z");

function demoHistory(days: number): ChartPoint[] {
  return Array.from({ length: 48 }, (_, index) => {
    const progress = index / 47;
    return {
      date: new Date(END - days * 86_400_000 * (1 - progress)).toISOString(),
      close: 112 + progress * 31 + Math.sin(index * 0.61) * 3 * Math.sin(progress * Math.PI),
    };
  });
}

export default function StockChartReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const data: Partial<Record<TimeRange, ChartPoint[]>> = {};
  [1, 5, 30, 365, 1825, 3650].forEach((days, index) => {
    data[RANGES[index]] = demoHistory(days);
  });

  return (
    <main className="sg-app-content min-h-dvh px-4 py-8 text-[#fffaf2] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f2c35f]">StockGPT · development preview</p>
          <h1 className="mt-2 text-3xl font-black">Sample stock</h1>
          <p className="mt-2 text-xs text-[#fffaf2]/55">Illustrative prices for chart design review.</p>
        </header>
        <section className="max-w-full overflow-hidden rounded-2xl border border-[#ddb159]/20 p-3 sm:p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#f2c35f]">Price chart</p>
          <div className="mt-2 min-w-0 max-w-full overflow-hidden">
            <StockChart ticker="DEMO" data={data} initialRange="1Y" height={320} appearance="portfolio" interaction="stock" rangeOrder={RANGES} showUnavailableRanges />
          </div>
        </section>
      </div>
    </main>
  );
}
