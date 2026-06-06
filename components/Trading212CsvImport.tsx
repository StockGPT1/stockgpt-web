"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

function ImportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#072116]/8 bg-white px-3 py-2">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#072116]/42">
        {label}
      </p>
      <p className="mt-1 truncate text-[15px] font-black leading-none text-[#072116]">
        {value}
      </p>
    </div>
  );
}

function ImportPanel({
  portfolioId,
  onComplete,
  onRequestClose,
}: {
  portfolioId?: string | null;
  onComplete?: () => void;
  onRequestClose?: () => void;
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

    if (file.size > 2 * 1024 * 1024) {
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

    if (fileInputRef.current) fileInputRef.current.value = "";
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

      const data = result.data ?? null;
      setPreview(data);

      const imported = data?.imported ?? 0;
      const skipped = data?.skipped ?? 0;

      setMessage(
        imported > 0
          ? `Preview ready: ${imported} supported holding${imported === 1 ? "" : "s"} found.${
              skipped > 0
                ? ` ${skipped} row${skipped === 1 ? "" : "s"} could not be matched.`
                : ""
            }`
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
      const imported = data?.imported ?? 0;
      const skipped = data?.skipped ?? 0;

      setIsSuccess(true);
      setSummary(data);
      setPreview(null);
      setMessage(
        imported > 0
          ? `Imported ${imported} holding${imported === 1 ? "" : "s"}.${
              skipped > 0
                ? ` ${skipped} row${skipped === 1 ? "" : "s"} could not be matched.`
                : ""
            }`
          : "No supported holdings were imported from this CSV.",
      );
      setCsvText("");
      setFileName("");

      if (fileInputRef.current) fileInputRef.current.value = "";

      router.refresh();
      onComplete?.();
    });
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-[28px] border border-[#ddb159]/25 bg-[#faf6f0] text-[#072116] shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#072116]/10 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#00a6ff] text-[12px] font-black text-white shadow-[0_8px_22px_rgba(0,166,255,0.25)]">
              212
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#0078bd]">
                Trading 212 import
              </p>
              <h3 className="mt-0.5 text-[22px] font-black leading-none tracking-[-0.04em] sm:text-[26px]">
                Import portfolio CSV
              </h3>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-[12px] font-semibold leading-5 text-[#072116]/58">
            Upload your Trading 212 CSV, preview the matches, then import into this portfolio.
          </p>
        </div>

        {onRequestClose && (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close Trading 212 import"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#072116]/10 bg-white text-[20px] font-black leading-none text-[#072116]/55 transition hover:border-[#ddb159]/50 hover:text-[#072116]"
          >
            ×
          </button>
        )}
      </div>

      <div className="grid max-h-[calc(100dvh-210px)] gap-4 overflow-y-auto px-4 py-4 sm:max-h-[calc(100dvh-170px)] sm:px-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["1", "Export CSV"],
            ["2", "Preview matches"],
            ["3", "Confirm import"],
          ].map(([step, label]) => (
            <div
              key={step}
              className="flex min-w-0 items-center gap-2 rounded-2xl border border-[#072116]/8 bg-white px-3 py-2"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#072116] text-[11px] font-black text-[#ddb159]">
                {step}
              </span>
              <span className="min-w-0 text-[11px] font-black uppercase tracking-[0.08em] text-[#072116]/70">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#ddb159]/25 bg-[#fff8e4] px-3 py-2">
          <p className="text-[11px] font-bold leading-5 text-[#8a641a]">
            StockGPT currently tracks S&P 500 portfolios in USD. Check your CSV currency before importing.
          </p>
        </div>

        <label className="block min-w-0 rounded-2xl border border-[#072116]/8 bg-white p-3">
          <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
            CSV file
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            className="block w-full min-w-0 cursor-pointer rounded-2xl border border-dashed border-[#00a6ff]/35 bg-[#f7fbff] px-3 py-3 text-[12px] font-bold text-[#072116] outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#00a6ff] file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.08em] file:text-white hover:border-[#00a6ff] focus:border-[#00a6ff]"
          />
          {fileName && (
            <div className="mt-2 flex min-w-0 flex-col gap-2 rounded-2xl bg-[#072116]/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 break-words text-[11px] font-black text-[#072116]">
                {fileName}
              </p>
              <button
                type="button"
                onClick={resetFile}
                className="h-8 rounded-full border border-[#072116]/10 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#072116]/55 transition hover:bg-white"
              >
                Clear
              </button>
            </div>
          )}
        </label>

        <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#072116]/8 bg-white px-3 py-3">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(event) => {
              setReplaceExisting(event.target.checked);
              setPreview(null);
            }}
            className="mt-1 size-4 shrink-0 accent-[#00a6ff]"
          />
          <span className="min-w-0 text-[11px] font-semibold leading-5 text-[#072116]/62">
            Replace holdings in this selected portfolio. Leave off to append/update imported holdings.
          </span>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={isPreviewing || !csvText.trim()}
            className="h-11 w-full rounded-2xl border border-[#00a6ff]/30 bg-white px-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#0078bd] transition hover:border-[#00a6ff] hover:bg-[#eef9ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewing ? "Previewing…" : "Preview CSV"}
          </button>
          <button
            type="button"
            onClick={submitImport}
            disabled={isImporting || !preview || !csvText.trim()}
            className="h-11 w-full rounded-2xl bg-[#072116] px-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#ddb159] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImporting ? "Importing…" : "Confirm import"}
          </button>
        </div>

        {message && (
          <div
            className={[
              "rounded-2xl border px-3 py-2",
              isSuccess
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-[#00a6ff]/20 bg-white text-[#072116]",
            ].join(" ")}
          >
            <p className="text-[11px] font-bold leading-5">{message}</p>
          </div>
        )}

        {preview && (
          <div className="rounded-2xl border border-[#00a6ff]/20 bg-[#eef9ff] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#0078bd]">
              Preview
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <ImportStat label="Matched" value={preview.imported} />
              <ImportStat label="Skipped" value={preview.skipped} />
              <ImportStat label="Value" value={money(preview.totalValue)} />
            </div>
            {preview.replaceWarning || replaceExisting ? (
              <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-800">
                {preview.replaceWarning ?? "Replace mode is on. This will clear holdings inside this portfolio before importing."}
              </p>
            ) : null}
            {preview.matchedTickers?.length ? (
              <p className="mt-3 break-words text-[10px] font-semibold leading-5 text-[#072116]/55">
                Matched: {preview.matchedTickers.slice(0, 20).join(", ")}
                {preview.matchedTickers.length > 20 ? "…" : ""}
              </p>
            ) : null}
            {preview.skippedTickers?.length ? (
              <p className="mt-2 break-words text-[10px] font-semibold leading-5 text-red-700/75">
                Skipped: {preview.skippedTickers.slice(0, 30).join(", ")}
                {preview.skippedTickers.length > 30 ? "…" : ""}
              </p>
            ) : null}
          </div>
        )}

        {summary && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Import complete
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <ImportStat label="Imported" value={summary.imported} />
              <ImportStat label="Skipped" value={summary.skipped} />
              <ImportStat label="Value" value={money(summary.totalValue)} />
            </div>
            {summary.skippedTickers?.length ? (
              <p className="mt-3 break-words text-[10px] font-semibold leading-5 text-[#072116]/55">
                Skipped: {summary.skippedTickers.slice(0, 20).join(", ")}
                {summary.skippedTickers.length > 20 ? "…" : ""}
              </p>
            ) : null}
          </div>
        )}

        <p className="text-[10px] font-semibold leading-5 text-[#072116]/42">
          This imports a CSV only. StockGPT does not connect to or control your Trading 212 account.
        </p>
      </div>
    </div>
  );
}

function ImportModal({
  open,
  portfolioId,
  onClose,
}: {
  open: boolean;
  portfolioId?: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-[#020806]/72 px-3 py-4 backdrop-blur-[10px] sm:items-center sm:px-5">
      <button
        type="button"
        aria-label="Close Trading 212 import overlay"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trading 212 CSV import"
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 w-full max-w-xl"
      >
        <ImportPanel portfolioId={portfolioId} onRequestClose={onClose} onComplete={onClose} />
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

        <ImportModal open={open} portfolioId={portfolioId} onClose={() => setOpen(false)} />
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

        <ImportModal open={open} portfolioId={portfolioId} onClose={() => setOpen(false)} />
      </div>
    );
  }

  return <ImportPanel portfolioId={portfolioId} />;
}
