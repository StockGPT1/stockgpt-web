import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { Database } from "@/lib/database.types";
import {
  calculatePortfolioPerformance,
  classifyBrokerActivityFlow,
  convertHistoricalValue,
  type HistoricalFxRate,
  type PortfolioPerformanceResult,
} from "@/lib/portfolio-history";

const RANGE_MS: Partial<Record<TimeRange, number>> = {
  "1D": 86_400_000,
  "5D": 5 * 86_400_000,
  "1M": 30 * 86_400_000,
  "6M": 182 * 86_400_000,
  "1Y": 365 * 86_400_000,
  "5Y": 5 * 365 * 86_400_000,
};

function chartRanges(points: ChartPoint[]) {
  const latest = points.at(-1) ? Date.parse(points.at(-1)!.date) : 0;
  return (["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"] as TimeRange[]).reduce<Partial<Record<TimeRange, ChartPoint[]>>>((result, range) => {
    const start = range === "MAX" ? Number.NEGATIVE_INFINITY : latest - (RANGE_MS[range] ?? 0);
    const selected = points.filter((point) => Date.parse(point.date) >= start);
    if (selected.length > 1) result[range] = selected;
    return result;
  }, {});
}

export async function loadConnectedPortfolioHistory(
  supabase: SupabaseClient<Database>,
  accountId: string,
) {
  const [history, activities] = await Promise.all([
    supabase.from("broker_account_value_history")
      .select("value_at,total_value,cash_value,currency,source,quality")
      .eq("account_id", accountId)
      .order("value_at", { ascending: true }),
    supabase.from("broker_activities")
      .select("id,activity_type,occurred_at,gross_amount,net_amount,currency")
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: true }),
  ]);
  if (history.error || activities.error) throw new Error("Connected Portfolio history unavailable");
  const rows = history.data ?? [];
  const dates = [...new Set(rows.map((row) => row.value_at.slice(0, 10)))];
  const currencies = [...new Set(rows.map((row) => row.currency).filter((currency) => currency !== "USD"))];
  const fx = currencies.length && dates.length
    ? await supabase.from("historical_fx_rates")
        .select("base_currency,quote_currency,effective_date,rate")
        .in("base_currency", currencies)
        .eq("quote_currency", "USD")
        .in("effective_date", dates)
    : { data: [], error: null };
  if (fx.error) throw new Error("Historical FX evidence unavailable");
  const rates: HistoricalFxRate[] = (fx.data ?? []).map((row) => ({
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    effectiveDate: row.effective_date,
    rate: Number(row.rate),
  }));
  const converted = rows.map((row) => ({
    at: row.value_at,
    value: convertHistoricalValue(Number(row.total_value), row.currency, "USD", row.value_at, rates),
    cash: convertHistoricalValue(Number(row.cash_value), row.currency, "USD", row.value_at, rates),
  }));
  const conversionComplete = converted.every((point) => point.value != null);
  const activityRows = activities.data ?? [];
  const activityDates = [...new Set(activityRows.map((row) => row.occurred_at?.slice(0, 10)).filter((value): value is string => Boolean(value)))];
  const activityCurrencies = [...new Set(activityRows.map((row) => row.currency).filter((value): value is string => Boolean(value && value !== "USD")))];
  const activityFx = activityCurrencies.length && activityDates.length
    ? await supabase.from("historical_fx_rates")
        .select("base_currency,quote_currency,effective_date,rate")
        .in("base_currency", activityCurrencies)
        .eq("quote_currency", "USD")
        .in("effective_date", activityDates)
    : { data: [], error: null };
  if (activityFx.error) throw new Error("Historical flow FX evidence unavailable");
  const allRates = rates.concat((activityFx.data ?? []).map((row) => ({
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    effectiveDate: row.effective_date,
    rate: Number(row.rate),
  })));
  const flows = activityRows.map((row) => {
    const direction = classifyBrokerActivityFlow(row.activity_type);
    const raw = row.net_amount ?? row.gross_amount;
    const amount = raw == null || !row.currency || !row.occurred_at
      ? null
      : convertHistoricalValue(Math.abs(Number(raw)), row.currency, "USD", row.occurred_at, allRates);
    return { at: row.occurred_at, amount, direction };
  });
  const performance: PortfolioPerformanceResult = conversionComplete
    ? calculatePortfolioPerformance({
        points: converted.map((point) => ({ at: point.at, value: point.value! })),
        flows,
      })
    : { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["historical_fx_unavailable"] };
  const points: ChartPoint[] = conversionComplete
    ? converted.map((point) => ({ date: point.at, close: point.value! }))
    : [];
  return {
    chartData: chartRanges(points),
    performance,
    pointCount: points.length,
    limitations: conversionComplete ? performance.limitations : ["historical_fx_unavailable"],
  };
}
