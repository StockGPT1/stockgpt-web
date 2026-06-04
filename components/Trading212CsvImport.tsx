"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  importTrading212Csv,
  previewTrading212Csv,
} from "@/lib/actions/portfolio-management";

type ImportPreview = {
  imported: number;
  skipped: number;
  totalValue: number;
  skippedTickers: string[];
  matchedTickers?: string[];
  replaceWarning?: string | null;
};

type ImportSummary = {
  imported: number;
  skipped: number;
  totalValue: number;
  skippedTickers: string[];
};

type Props = {
  portfolioId?: string | null;
  compact?: boolean;
  launcherOnly?: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function ResultStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/85 px-3 py-2">
      <p className="text-[8px] font-black uppercase tracking-wider text-[#072116]/45">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[15px] font-black text-[#072116]">
        {value}
      </p>
    </div>
  );
}

function ImportPanel({
  portfolioId,
  onComplete,
}: {
  portfolioId?: string | null;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [isPreviewing, startPreviewing] = useTransition();
  const [isImporting, startImporting] = useTransition();

  async function handleFileChange(file: File | null) {
    setMessage(null);
    setSummary(null);
    setPreview(null);
    setIsSuccess(false);

    if (!file) {
      setFileName("");
      setCsvText("");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileName("");
      setCsvText("");
      setMessage("Please upload a CSV file exported from Trading 212.");
      return;
    }

    const maxBytes = 2 * 1024 * 1024;

    if (file.size > maxBytes) {
      setFileName("");
      setCsvText("");
      setMessage("CSV file is too large. Please upload a file under 2MB.");
      return;
    }

    const text = await file.text();

    if (!text.trim()) {
      setFileName("");
      setCsvText("");
      setMessage("This CSV looks empty.");
      return;
    }

    setFileName(file.name);
    setCsvText(text);
    setMessage("CSV loaded. Preview it before importing.");
  }

  function resetFile() {
    setFileName("");
    setCsvText("");
    setPreview(null);
    setSummary(null);
    setMessage(null);
    setIsSuccess(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function runPreview() {
    if (!portfolioId) {
      setIsSuccess(false);
      setMessage("Choose or create a portfolio before importing.");
      return;
    }

    if (!csvText.trim()) {
      setIsSuccess(false);
      setMessage("Choose your Trading 212 CSV export first.");
      return;
    }

    setMessage(null);
    setSummary(null);
    setPreview(null);
    setIsSuccess(false);

    startPreviewing(async () => {
      const result = await previewTrading212Csv(csvText, {
        portfolioId,
        replaceExisting,
      });

      if (!result.success) {
        setIsSuccess(false);
        setMessage(result.error ?? "Could not preview your Trading 212 CSV.");
        return;
      }

      setPreview(result.data ?? null);

      const imported = result.data?.imported ?? 0;
      const skipped = result.data?.skipped ?? 0;

      setMessage(
        imported > 0
          ? `Preview ready: ${imported} supported holding${
              imported === 1 ? "" : "s"
            } found.${skipped > 0 ? ` ${skipped} row${skipped === 1 ? "" : "s"} could not be matched.` : ""}`
          : "No supported S&P 500 holdings were found in this CSV.",
      );
    });
  }

  function submitImport() {
    if (!portfolioId) {
      setIsSuccess(false);
      setMessage("Choose or create a portfolio before importing.");
      return;
    }

    if (!csvText.trim()) {
      setIsSuccess(false);
      setMessage("Choose your Trading 212 CSV export first.");
      return;
    }

    if (!preview) {
      setIsSuccess(false);
      setMessage("Preview the CSV before importing.");
      return;
    }

    if (replaceExisting) {
      const confirmed = window.confirm(
        "This will replace the holdings inside this selected portfolio only. Other portfolios will not be touched. Continue?",
      );

      if (!confirmed) return;
    }

    setMessage(null);
    setSummary(null);

    startImporting(async () => {
      const result = await importTrading212Csv(csvText, {
        portfolioId,
        replaceExisting,
      });

      if (!result.success) {
        setIsSuccess(false);
        setMessage(result.error ?? "Could not import your Trading 212 CSV.");
        return;
      }

      const data = result.data ?? null;
      setIsSuccess(true);
      setSummary(data);
      setPreview(null);

      const imported = data?.imported ?? 0;
      const skipped = data?.skipped ?? 0;

      setMessage(
        imported > 0
          ? `Imported ${imported} holding${imported === 1 ? "" : "s"} into this portfolio.${skipped > 0 ? ` ${skipped} row${skipped === 1 ? "" : "s"} could not be matched.` : ""}`
          : "No supported holdings were imported from this CSV.",
      );

      setCsvText("");
      setFileName("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.refresh();
      onComplete?.();
    });
  }

  return (
    <div className="relative min-w-0 overflow-hidden rounded-3xl border border-[#00a6ff]/20 bg-[#f7fbff] text-[#072116] shadow-[0_10px_28px_rgba(0,0,0,0.16)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#00a6ff]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-[#ddb159]/15 blur-3xl" />

      <div className="relative min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#00a6ff] text-[13px] font-black tracking-[-0.04em] text-white shadow-[0_8px_20px_rgba(0,166,255,0.28)]">
              212
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#00a6ff]">
                Trading 212 import
              </p>
              <h3 className="mt-0.5 text-[23px] font-black tracking-[-0.04em] text-[#072116]">
                Upload your portfolio CSV
              </h3>
            </div>
          </div>

          <span className="rounded-full border border-[#00a6ff]/20 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0078bd]">
            Preview first
          </span>
        </div>

        <p className="mt-3 text-[12px] font-semibold leading-5 text-[#072116]/60">
          Import your real Trading 212 holdings and StockGPT will match them to
          rankings, scores, sector exposure and portfolio alerts.
        </p>

        <div className="mt-4 grid gap-2">
          {[
            ["1", "Export", "Trading 212 → Menu → History → Export → CSV."],
            ["2", "Preview", "Upload the CSV and check matched/skipped holdings."],
            ["3", "Import", "Append or replace holdings inside this portfolio only."],
          ].map(([step, title, text]) => (
            <div
              key={step}
              className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-2xl border border-[#072116]/8 bg-white px-3 py-2.5"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-[#072116] text-[12px] font-black text-[#ddb159]">
                {step}
              </div>

              <div className="min-w-0">
                <p className="text-[12px] font-black text-[#072116]">{title}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#072116]/55">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-bold leading-5 text-amber-800">
            Currency note: StockGPT currently tracks S&P 500 portfolios in USD.
            Check your Trading 212 CSV currency before importing, especially if
            your account displays GBP.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="block min-w-0">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              CSV file
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? null)
              }
              className="block w-full min-w-0 cursor-pointer rounded-2xl border-2 border-dashed border-[#00a6ff]/25 bg-white px-3 py-3 text-[12px] font-bold text-[#072116] outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#00a6ff] file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.1em] file:text-white hover:border-[#00a6ff] focus:border-[#00a6ff]"
            />
          </label>

          {fileName && (
            <div className="grid min-w-0 gap-2 rounded-2xl border border-[#00a6ff]/20 bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-[#072116]">
                  {fileName}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#072116]/55">
                  Ready to preview.
                </p>
              </div>

              <button
                type="button"
                onClick={resetFile}
                className="h-8 rounded-full border border-[#072116]/10 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#072116]/55 transition hover:bg-[#072116]/5"
              >
                Clear
              </button>
            </div>
          )}

          <label className="flex min-w-0 items-start gap-2 rounded-2xl border border-[#072116]/10 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => {
                setReplaceExisting(event.target.checked);
                setPreview(null);
              }}
              className="mt-0.5 size-4 shrink-0 accent-[#00a6ff]"
            />
            <span className="min-w-0 text-[11px] font-semibold leading-5 text-[#072116]/65">
              Replace holdings inside this selected portfolio. Turn this off to
              append/update imported holdings without clearing existing ones.
            </span>
          </label>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={isPreviewing || !csvText.trim()}
              className="h-11 w-full rounded-2xl border border-[#00a6ff]/30 bg-white px-4 text-[12px] font-black uppercase tracking-[0.1em] text-[#0078bd] transition hover:border-[#00a6ff] hover:bg-[#eef9ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPreviewing ? "Previewing…" : "Preview CSV"}
            </button>

            <button
              type="button"
              onClick={submitImport}
              disabled={isImporting || !preview || !csvText.trim()}
              className="h-11 w-full rounded-2xl bg-[#072116] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? "Importing…" : "Confirm import"}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={[
              "mt-3 rounded-2xl border px-3 py-2",
              isSuccess
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-[#00a6ff]/20 bg-white text-[#072116]",
            ].join(" ")}
          >
            <p className="text-[11px] font-bold leading-5">{message}</p>
          </div>
        )}

        {preview && (
          <div className="mt-3 rounded-2xl border border-[#00a6ff]/20 bg-[#eef9ff] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0078bd]">
              Import preview
            </p>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <ResultStat label="Matched" value={preview.imported} />
              <ResultStat label="Skipped" value={preview.skipped} />
              <ResultStat label="Value" value={money(preview.totalValue)} />
            </div>

            {replaceExisting && (
              <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2">
                <p className="text-[11px] font-bold leading-5 text-amber-800">
                  Replace mode is on. This will clear the holdings inside this
                  portfolio before importing the matched CSV holdings. Other
                  portfolios are safe.
                </p>
              </div>
            )}

            {preview.matchedTickers?.length ? (
              <p className="mt-3 text-[10px] font-semibold leading-5 text-[#072116]/55">
                Matched: {preview.matchedTickers.slice(0, 20).join(", ")}
                {preview.matchedTickers.length > 20 ? "…" : ""}
              </p>
            ) : null}

            {preview.skippedTickers?.length ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                  Skipped tickers
                </p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-red-700/80">
                  {preview.skippedTickers.slice(0, 30).join(", ")}
                  {preview.skippedTickers.length > 30 ? "…" : ""}
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-red-700/60">
                  These could not be matched to the StockGPT S&P 500 rankings.
                  ETF tickers, suffixes and non-US symbols may need manual
                  mapping later.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {summary && (
          <div className="mt-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Import complete
            </p>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <ResultStat label="Imported" value={summary.imported} />
              <ResultStat label="Skipped" value={summary.skipped} />
              <ResultStat label="Value" value={money(summary.totalValue)} />
            </div>

            {summary.skippedTickers?.length ? (
              <p className="mt-3 text-[10px] font-semibold leading-5 text-[#072116]/55">
                Skipped: {summary.skippedTickers.slice(0, 20).join(", ")}
                {summary.skippedTickers.length > 20 ? "…" : ""}
              </p>
            ) : null}
          </div>
        )}

        <p className="mt-3 text-[10px] font-semibold leading-5 text-[#072116]/45">
          CSV files are read in your browser and sent securely to StockGPT only
          for portfolio import. This does not connect to or control your Trading
          212 account.
        </p>
      </div>
    </div>
  );
}

export function Trading212CsvImport({
  portfolioId,
  compact = false,
  launcherOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);

  if (launcherOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!portfolioId}
          className="h-11 w-full rounded-2xl bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open import
        </button>

        {!portfolioId && (
          <p className="mt-2 text-[10px] font-semibold leading-5 text-[#072116]/45">
            Create or select a portfolio before importing.
          </p>
        )}

        {open && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-x-hidden bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#061b12] text-[20px] font-black text-[#ddb159] shadow-lg transition hover:bg-[#0d3420]"
                >
                  ×
                </button>
              </div>

              <ImportPanel
                portfolioId={portfolioId}
                onComplete={() => setOpen(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  if (compact) {
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!portfolioId}
          className="h-11 w-full rounded-2xl bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Import Trading 212 CSV
        </button>

        {open && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-x-hidden bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#061b12] text-[20px] font-black text-[#ddb159] shadow-lg transition hover:bg-[#0d3420]"
                >
                  ×
                </button>
              </div>

              <ImportPanel
                portfolioId={portfolioId}
                onComplete={() => setOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return <ImportPanel portfolioId={portfolioId} />;
}
