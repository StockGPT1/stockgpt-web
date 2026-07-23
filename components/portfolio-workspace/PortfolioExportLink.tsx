"use client";

import { useMemo } from "react";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import type {
  PortfolioMeta,
  PortfolioTransaction,
} from "@/components/portfolio-workspace/types";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeFileName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "portfolio";
}

export function PortfolioExportLink({
  meta,
  holdings,
  transactions,
}: {
  meta: PortfolioMeta;
  holdings: ExtendedHolding[];
  transactions: PortfolioTransaction[];
}) {
  const exportData = useMemo(() => {
    const columns = [
      "record_type",
      "date",
      "ticker",
      "company",
      "sector",
      "transaction_type",
      "shares",
      "entry_or_transaction_price",
      "current_price",
      "current_value_or_amount",
      "profit_loss",
      "allocation_pct",
      "ai_score",
      "ai_rank",
      "currency",
      "notes",
    ];
    const rows: unknown[][] = [columns];

    for (const holding of holdings) {
      rows.push([
        "holding",
        holding.addedAt,
        holding.ticker,
        holding.company,
        holding.sector,
        "",
        holding.shares,
        holding.entryPrice,
        holding.currentPrice > 0 ? holding.currentPrice : "unavailable",
        holding.currentPrice > 0 ? holding.currentValue : "unavailable",
        holding.currentPrice > 0 ? holding.totalPnLDollars : "unavailable",
        holding.currentPrice > 0 ? holding.currentAllocationPct : "unavailable",
        holding.score,
        holding.rank,
        meta.currency,
        holding.notes ?? "",
      ]);
    }

    for (const transaction of transactions) {
      rows.push([
        "transaction",
        transaction.createdAt,
        transaction.ticker ?? "",
        "",
        "",
        transaction.type,
        transaction.shares ?? "",
        transaction.price ?? "",
        "",
        transaction.amount ?? "",
        transaction.realisedPnl ?? "",
        "",
        "",
        "",
        transaction.currency || meta.currency,
        transaction.notes ?? "",
      ]);
    }

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const date = new Date().toISOString().slice(0, 10);
    return {
      href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
      filename: `${safeFileName(meta.name)}-${date}.csv`,
    };
  }, [holdings, meta, transactions]);

  return (
    <a
      href={exportData.href}
      download={exportData.filename}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl border border-[#ddb159]/18 px-4 text-left transition hover:bg-[#ddb159]/7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ddb159]/10 text-[#ddb159]">
          <PortfolioIcon name="import" className="size-4 rotate-180" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-black text-[#faf6f0]">
            Export portfolio CSV
          </span>
          <span className="mt-1 block truncate text-[9px] font-semibold text-[#faf6f0]/34">
            Holdings and activity in {meta.currency}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
        Download
      </span>
    </a>
  );
}
