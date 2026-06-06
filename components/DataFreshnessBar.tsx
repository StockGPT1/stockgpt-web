import {
  type DataFreshnessSummary,
  type FreshnessRecord,
  formatFreshnessAge,
  formatFreshnessDate,
} from "@/lib/data-freshness";

function statusStyles(record: FreshnessRecord) {
  if (record.status === "fresh") {
    return {
      dot: "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.55)]",
      chip: "border-emerald-300/18 bg-emerald-300/[0.06] text-emerald-100/88",
      label: "Fresh",
    };
  }

  if (record.status === "stale") {
    return {
      dot: "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.55)]",
      chip: "border-amber-300/28 bg-amber-300/[0.09] text-amber-100/92",
      label: "Refreshing",
    };
  }

  return {
    dot: "bg-[#faf6f0]/42",
    chip: "border-[#faf6f0]/14 bg-[#faf6f0]/[0.035] text-[#faf6f0]/66",
    label: "Checking",
  };
}

function FreshnessChip({ record }: { record: FreshnessRecord }) {
  const styles = statusStyles(record);

  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 ${styles.chip}`}
      title={`${record.label}: ${formatFreshnessDate(record.latestAt)} · ${formatFreshnessAge(
        record,
      )}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${styles.dot}`} />
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
        {record.label}
      </span>
      <span className="text-[10px] font-bold tabular-nums">
        {formatFreshnessDate(record.latestAt)}
      </span>
      <span className="hidden text-[9px] font-black uppercase tracking-[0.1em] opacity-60 sm:inline">
        {styles.label}
      </span>
    </div>
  );
}

export function DataFreshnessBar({
  freshness,
}: {
  freshness: DataFreshnessSummary | null;
}) {
  if (!freshness) return null;

  const needsRefresh = freshness.hasStaleData || freshness.hasUnknownData;
  const records = [freshness.rankings, freshness.prices, freshness.news];

  return (
    <div className="relative z-30 shrink-0 border-b border-[#ddb159]/12 bg-[#03140d] px-3 py-2 shadow-[0_5px_14px_rgba(0,0,0,0.18)] sm:px-5">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`size-1.5 shrink-0 rounded-full ${
              needsRefresh
                ? "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.6)]"
                : "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.55)]"
            }`}
          />
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
            {needsRefresh ? "Some data still refreshing" : "Data freshness"}
          </p>
        </div>

        <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {records.map((record) => (
            <FreshnessChip key={`${record.table}-${record.column}`} record={record} />
          ))}
        </div>
      </div>
    </div>
  );
}