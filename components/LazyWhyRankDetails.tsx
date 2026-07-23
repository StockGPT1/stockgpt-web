"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MobileSheet } from "@/components/MobileSheet";
import { useFocusedFlow } from "@/components/AppChromeProvider";
import { StockLogo } from "@/components/StockLogo";
import { useIsDesktop } from "@/components/useIsDesktop";
import { buildAskHref } from "@/lib/ask-context";
import { factorDescription, sentenceCaseFactor } from "@/lib/factor-labels";
import type { StableRankingRow } from "@/lib/stable-rankings";

type DiagnosticsPayload = {
  diagnostics?: {
    diagnosis?: string | null;
    factor_contributions?: unknown;
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

const NOISE_THRESHOLD = 0.0005;

/* Primary source: factor_contributions — how much each factor is
   actually adding to or subtracting from this stock's rank right now.
   The top_positive/negative_factors lists are day-over-day CHANGES and
   are usually ±0.000 noise, so they are only a fallback and near-zero
   entries are dropped rather than shown as meaningless "(+0.000)". */
function contributionEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([factor, raw]) => ({ factor, value: Number(raw) }))
    .filter((entry) => Number.isFinite(entry.value) && Math.abs(entry.value) > NOISE_THRESHOLD);
}

function changeEntryItem(item: unknown): FactorItem | null {
  if (typeof item === "string" && item.trim()) {
    return { code: item, label: sentenceCaseFactor(item), share: null };
  }
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = [record.factor, record.name, record.label, record.key].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== "",
  );
  if (!name) return null;
  const magnitude = [record.change, record.delta, record.current, record.contribution, record.value].find(
    (candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate),
  );
  /* near-zero day-over-day changes carry no information — skip them */
  if (magnitude !== undefined && Math.abs(magnitude) <= NOISE_THRESHOLD) return null;
  return { code: name, label: sentenceCaseFactor(name), share: null };
}

/* share: this factor's pull relative to the strongest factor shown
   (0..1), used for the strength bar; null when the source data has no
   usable magnitude (fallback lists). */
type FactorItem = { code: string; label: string; share: number | null };

function factorLists(diagnostics: DiagnosticsPayload["diagnostics"]) {
  const contributions = contributionEntries(diagnostics?.factor_contributions);

  const positives = contributions.filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
  const negatives = contributions.filter((entry) => entry.value < 0).sort((a, b) => a.value - b.value).slice(0, 3);
  const maxAbs = Math.max(...[...positives, ...negatives].map((entry) => Math.abs(entry.value)), 0);

  const describe = (entry: { factor: string; value: number }): FactorItem => ({
    code: entry.factor,
    label: sentenceCaseFactor(entry.factor),
    share: maxAbs > 0 ? Math.abs(entry.value) / maxAbs : null,
  });

  let drivers = positives.map(describe);
  let risks = negatives.map(describe);

  const fallback = (value: unknown) =>
    Array.isArray(value)
      ? value.map(changeEntryItem).filter((item): item is FactorItem => Boolean(item)).slice(0, 3)
      : [];

  if (drivers.length === 0) drivers = fallback(diagnostics?.top_positive_factors);
  if (risks.length === 0) risks = fallback(diagnostics?.top_negative_factors);

  return { drivers, risks };
}

function strengthWord(share: number) {
  if (share >= 0.72) return "Strong";
  if (share >= 0.38) return "Moderate";
  return "Mild";
}

/* One readable sentence a non-quant can act on, built from the factor
   names themselves. */
function verdictSentence(
  stock: StableRankingRow,
  drivers: FactorItem[],
  risks: FactorItem[],
) {
  if (drivers.length === 0 && risks.length === 0) return null;
  const ticker = stock.ticker ?? "This stock";
  /* lowercase only a sentence-case initial — "Sector-adjusted P/E" must
     not become "sector-adjusted p/e", and acronym starts stay intact */
  const inSentence = (label: string) =>
    label.length > 1 && label[1] === label[1].toLowerCase()
      ? label[0].toLowerCase() + label.slice(1)
      : label;
  const names = (items: FactorItem[]) => items.slice(0, 2).map((item) => inSentence(item.label)).join(" and ");
  if (drivers.length > 0 && risks.length > 0) {
    return `${ticker} earns its rank mainly through ${names(drivers)} — the main thing working against it is ${names(risks.slice(0, 1))}.`;
  }
  if (drivers.length > 0) {
    return `${ticker} earns its rank mainly through ${names(drivers)}, with no factor meaningfully working against it right now.`;
  }
  return `${ticker} is being held back by ${names(risks)} — no factor is adding meaningful support right now.`;
}

/* Each factor row: name + strength bar + word. Tapping unfolds a
   plain-English description of what the indicator measures. */
function FactorColumn({
  title,
  tone,
  items,
  emptyLabel,
}: {
  title: string;
  tone: "up" | "down";
  items: FactorItem[];
  emptyLabel: string;
}) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const barColor = tone === "up" ? "#61d7ab" : "#f1908d";

  return (
    <div className="min-w-0">
      <p className={`text-[8px] font-black uppercase tracking-[0.15em] ${tone === "up" ? "text-[#61d7ab]" : "text-[#f1908d]"}`}>
        {title}
      </p>
      <ul className="mt-1.5 grid gap-2">
        {items.length === 0 && (
          <li className="text-[10px] font-semibold leading-4 text-[#faf6f0]/45">{emptyLabel}</li>
        )}
        {items.map((item) => {
          const open = openCode === item.code;
          return (
            <li key={item.code} className="min-w-0">
              <button
                type="button"
                onClick={() => setOpenCode(open ? null : item.code)}
                aria-expanded={open}
                className="block w-full rounded-lg text-left transition hover:bg-[#faf6f0]/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[10.5px] font-bold text-[#faf6f0]/78">
                    {item.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[8.5px] font-black text-[#faf6f0]/40">
                    {item.share !== null && strengthWord(item.share)}
                    <span
                      aria-hidden="true"
                      className={`text-[8px] text-[#ddb159]/75 transition-transform ${open ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </span>
                </span>
                {item.share !== null && (
                  <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-[#faf6f0]/8">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(item.share * 100, 8)}%`,
                        background: barColor,
                        opacity: 0.85,
                      }}
                    />
                  </span>
                )}
              </button>
              {open && (
                <p className="mt-1.5 rounded-lg border border-[#ddb159]/16 bg-[#ddb159]/[0.06] px-2 py-1.5 text-[9.5px] font-medium leading-4 text-[#faf6f0]/72">
                  {factorDescription(item.code)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Provenance footer: how much data sits behind this rank and how fresh
   it is — the trust signals users asked "why" for in the first place. */
function WhyMetaFooter({ data }: { data: DiagnosticsPayload | null }) {
  const coverage = data?.ranking?.factor_coverage;
  const confidence = data?.ranking?.data_confidence;
  const updatedAt = data?.diagnostics?.updated_at;

  const parts: string[] = [];
  if (typeof coverage === "number" && coverage > 0) {
    parts.push(coverage <= 1 ? `${Math.round(coverage * 100)}% factor coverage` : `${Math.round(coverage)} factors tracked`);
  }
  if (typeof confidence === "string" && confidence.trim()) {
    parts.push(`${confidence.trim().replace(/^\w/, (c) => c.toUpperCase())} data confidence`);
  }
  if (typeof updatedAt === "string" && updatedAt) {
    const date = new Date(updatedAt);
    if (Number.isFinite(date.getTime())) {
      parts.push(`Updated ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    }
  }

  if (parts.length === 0) return null;
  return (
    <p className="text-[9px] font-bold text-[#faf6f0]/34">{parts.join(" · ")}</p>
  );
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
  const { drivers, risks } = factorLists(data?.diagnostics);
  const verdict = verdictSentence(stock, drivers, risks);

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
          {verdict && (
            <p className="rounded-xl border border-[#ddb159]/14 bg-[#ddb159]/[0.05] px-3 py-2.5 text-[11px] font-semibold leading-5 text-[#f4f1e8]/85">
              {verdict}
            </p>
          )}

          <div className={compact ? "grid grid-cols-2 gap-3" : "grid gap-4 sm:grid-cols-2"}>
            <FactorColumn
              title="Pushing it up"
              tone="up"
              items={drivers.slice(0, compact ? 2 : 3)}
              emptyLabel="No factor is adding meaningful support right now."
            />
            <FactorColumn
              title="Holding it back"
              tone="down"
              items={risks.slice(0, compact ? 2 : 3)}
              emptyLabel="No factor is meaningfully dragging on the rank."
            />
          </div>

          <p className="text-[9px] font-semibold leading-4 text-[#faf6f0]/38">
            Tap a factor to see what it measures. Bar length = how hard that
            factor is pulling relative to the others.
          </p>

          <WhyMetaFooter data={data} />
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
