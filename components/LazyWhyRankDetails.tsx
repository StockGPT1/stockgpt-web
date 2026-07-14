"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MobileSheet } from "@/components/MobileSheet";
import { useFocusedFlow } from "@/components/AppChromeProvider";
import { StockLogo } from "@/components/StockLogo";
import { useIsDesktop } from "@/components/useIsDesktop";
import { buildAskHref } from "@/lib/ask-context";
import type { StableRankingRow } from "@/lib/stable-rankings";

type DiagnosticsPayload = {
  diagnostics?: {
    diagnosis?: string | null;
    top_positive_factors?: unknown;
    top_negative_factors?: unknown;
    updated_at?: string | null;
  } | null;
  ranking?: { factor_coverage?: number | null; data_confidence?: string | null } | null;
};

type LazyWhyRankDetailsProps = {
  stock: StableRankingRow;
  dailyMove: number | null | undefined;
  light?: boolean;
  variant?: "sheet" | "inline";
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

/* Same humanisation as lib/portfolio-alerts' formatFactorName (kept
   local — that module is server-side): "PE_rel" → "PE Relative". */
function formatFactorName(factor: string) {
  return factor
    .replace(/_/g, " ")
    .replace(/\brel\b/gi, "relative")
    .replace(/\bz\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/* Factor entries arrive in several shapes ("PE_rel", { factor, change },
   { name, contribution }, …). Render a readable label for each instead
   of the stringified object. */
function factorLabel(item: unknown): string | null {
  if (typeof item === "string") return formatFactorName(item) || null;
  if (typeof item === "number") return String(item);
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const name = [record.factor, record.name, record.label, record.key, record.id].find(
      (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== "",
    );
    const magnitude = [record.change, record.delta, record.contribution, record.value, record.weight].find(
      (candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate),
    );
    if (name && magnitude !== undefined) {
      return `${formatFactorName(name)} (${magnitude >= 0 ? "+" : ""}${magnitude.toFixed(3)})`;
    }
    if (name) return formatFactorName(name);
    const firstString = Object.values(record).find(
      (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== "",
    );
    return firstString ? formatFactorName(firstString) : null;
  }
  return null;
}

function strings(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(factorLabel)
      .filter((item): item is string => Boolean(item))
      .slice(0, 3);
  }
  if (value && typeof value === "object") return Object.keys(value as object).slice(0, 3);
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  return [];
}

function WhyContent({
  stock,
  data,
  loading,
  error,
  compact = false,
}: {
  stock: StableRankingRow;
  data: DiagnosticsPayload | null;
  loading: boolean;
  error: string | null;
  compact?: boolean;
}) {
  const drivers = strings(data?.diagnostics?.top_positive_factors);
  const risks = strings(data?.diagnostics?.top_negative_factors);

  return (
    <div className={compact ? "grid gap-3 text-[#faf6f0]" : "grid gap-4 text-[#faf6f0]"}>
      {!compact && (
        <div className="flex items-center gap-3">
          <StockLogo ticker={stock.ticker} company={stock.company} size={42} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black">{stock.company ?? stock.ticker}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">
              AI score {Number(stock.score ?? 0).toLocaleString()} · Rank #{stock.rank ?? "—"}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid gap-2">
          <div className="h-12 animate-pulse rounded-xl bg-[#faf6f0]/8" />
          <div className="h-12 animate-pulse rounded-xl bg-[#faf6f0]/8" />
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-[#ddb159]/20 bg-[#ddb159]/8 p-3 text-[11px] font-semibold leading-5 text-[#e7c56c]">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <p className={compact ? "text-[11px] font-semibold leading-5 text-[#faf6f0]/68" : "text-[13px] font-semibold leading-6 text-[#faf6f0]/68"}>
            {data?.diagnostics?.diagnosis ??
              "The latest factor explanation is not available. The rank remains visible, but StockGPT will not invent drivers."}
          </p>

          <div className={compact ? "grid grid-cols-2 gap-3" : "grid gap-4 sm:grid-cols-2"}>
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Main drivers</p>
              <ul className="mt-1.5 grid gap-1.5 text-[10px] font-semibold leading-4 text-[#faf6f0]/62">
                {(drivers.length ? drivers : ["Factor detail unavailable"]).slice(0, compact ? 2 : 3).map((item) => (
                  <li key={item} className="min-w-0">— {item}</li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Risks</p>
              <ul className="mt-1.5 grid gap-1.5 text-[10px] font-semibold leading-4 text-[#faf6f0]/62">
                {(risks.length ? risks : ["Review company and market risk before acting"]).slice(0, compact ? 2 : 3).map((item) => (
                  <li key={item} className="min-w-0">— {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={buildAskHref({ contextType: "stock", ticker: stock.ticker ?? "" })}
          className="grid min-h-11 place-items-center rounded-xl bg-[#ddb159] px-3 text-center text-[10px] font-black text-[#061b12]"
        >
          Ask about {stock.ticker}
        </Link>
        <Link
          href={`/stock/${stock.ticker}`}
          className="grid min-h-11 place-items-center rounded-xl border border-[#ddb159]/24 px-3 text-center text-[10px] font-black text-[#ddb159]"
        >
          Open stock page
        </Link>
      </div>
    </div>
  );
}

export function LazyWhyRankDetails({
  stock,
  light = false,
  variant = "sheet",
  expanded = false,
  onExpandedChange,
}: LazyWhyRankDetailsProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const isInline = variant === "inline";
  const open = isInline ? expanded : sheetOpen;
  const ticker = stock.ticker ?? "stock";
  const detailId = `ranking-why-${ticker.replace(/[^a-z0-9_-]/gi, "-")}`;

  useFocusedFlow(`ranking-why-${stock.ticker}`, !isInline && sheetOpen);

  /* Escape closes the desktop drawer (the mobile sheet handles its own) */
  useEffect(() => {
    if (!isDesktop || !sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDesktop, sheetOpen]);

  async function loadDetails() {
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/rankings/financial-metrics?ticker=${encodeURIComponent(stock.ticker ?? "")}`,
      );
      const payload = (await response.json().catch(() => null)) as DiagnosticsPayload | null;
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Premium factor detail is locked."
            : "The latest factor detail is unavailable.",
        );
      }
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Factor detail is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function toggleDetails() {
    const nextOpen = !open;
    if (isInline) {
      onExpandedChange?.(nextOpen);
    } else {
      setSheetOpen(nextOpen);
    }
    if (nextOpen) void loadDetails();
  }

  const content = <WhyContent stock={stock} data={data} loading={loading} error={error} />;

  if (isInline) {
    return (
      <div className="contents">
        <button
          type="button"
          onClick={toggleDetails}
          aria-expanded={open}
          aria-controls={detailId}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/26 bg-[#04180f]/34 px-3 text-[10px] font-black text-[#ddb159] transition hover:border-[#ddb159]/52 hover:bg-[#ddb159]/9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
        >
          {open ? "Hide explanation" : "Why this rank →"}
        </button>

        {open && (
          <div
            id={detailId}
            className="col-span-2 -mx-3 -mb-3 mt-2 overflow-hidden border-t border-[#ddb159]/12 bg-[linear-gradient(180deg,rgba(221,177,89,0.035),rgba(3,24,15,0.3))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] motion-reduce:transition-none"
            style={{ animation: "rankWhyReveal 160ms ease-out" }}
          >
            <WhyContent stock={stock} data={data} loading={loading} error={error} compact />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleDetails}
        className={`inline-flex h-11 items-center justify-center rounded-full border px-3 text-[10px] font-black ${
          light ? "border-[#072116]/12 text-[#8a641a]" : "border-[#ddb159]/22 text-[#8a641a]"
        }`}
      >
        Why?
      </button>
      {!isDesktop && (
        <MobileSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={`Why ${stock.ticker} ranks #${stock.rank ?? "—"}`}
          eyebrow="Ranking intelligence"
        >
          {content}
        </MobileSheet>
      )}
      {isDesktop &&
        sheetOpen &&
        createPortal(
          /* portaled to <body>: a transformed ancestor inside the app
             shell would otherwise trap this fixed overlay under the
             header and swallow its clicks */
          <div
            className="fixed inset-0 z-[2147483000] flex justify-end bg-[#020805]/72"
            role="presentation"
          >
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close ranking detail"
              className="absolute inset-0 cursor-default"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label={`Why ${stock.ticker} ranks here`}
              className="relative z-10 h-[100dvh] w-full max-w-[520px] overflow-y-auto border-l border-[#ddb159]/22 bg-[#061b12] p-6 pt-16"
            >
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-[#ddb159]/22 text-xl text-[#ddb159]"
                aria-label="Close"
              >
                &times;
              </button>
              <p className="mb-5 text-[10px] font-black uppercase tracking-[0.17em] text-[#ddb159]">
                Why {stock.ticker} ranks #{stock.rank ?? "—"}
              </p>
              {content}
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
