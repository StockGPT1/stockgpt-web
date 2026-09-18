import type { ChartPoint, TimeRange } from "@/components/StockChart";

function cleanPoint(point: ChartPoint): ChartPoint | null {
  const time = new Date(point.date).getTime();
  const close = Number(point.close);

  if (!Number.isFinite(time) || !Number.isFinite(close) || close < 0) return null;

  const basis = point.basis == null ? undefined : Number(point.basis);
  const pnl = point.pnl == null ? undefined : Number(point.pnl);
  const pnlPct = point.pnlPct == null ? undefined : Number(point.pnlPct);

  return {
    ...point,
    close,
    basis: basis != null && Number.isFinite(basis) ? basis : undefined,
    pnl: pnl != null && Number.isFinite(pnl) ? pnl : undefined,
    pnlPct: pnlPct != null && Number.isFinite(pnlPct) ? pnlPct : undefined,
  };
}

export function sanitisePortfolioChartData(
  chartData: Partial<Record<TimeRange, ChartPoint[]>>,
): Partial<Record<TimeRange, ChartPoint[]>> {
  return Object.fromEntries(
    Object.entries(chartData).map(([range, rawPoints]) => {
      const byTimestamp = new Map<number, ChartPoint>();

      for (const rawPoint of rawPoints ?? []) {
        const point = cleanPoint(rawPoint);
        if (!point) continue;
        const timestamp = new Date(point.date).getTime();
        byTimestamp.set(timestamp, point);
      }

      const points = [...byTimestamp.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, point]) => point);

      return [range, points];
    }),
  ) as Partial<Record<TimeRange, ChartPoint[]>>;
}
