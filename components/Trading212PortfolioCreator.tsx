"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPortfolioFromTrading212Csv,
  previewTrading212CsvForNewPortfolio,
} from "@/lib/actions/portfolio-management";

type ImportPreview = {
  imported: number;
  skipped: number;
  totalValue: number;
  skippedTickers: string[];
  matchedTickers?: string[];
};

type Props = {
  existingCount: number;
  onBack: () => void;
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

export function Trading212PortfolioCreator({ existingCount, onBack }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(`Trading 212 Import ${existingCount + 1}`);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isPreviewing, startPreviewing] = useTransition();
  const [isCreating, startCreating] = useTransition();

  async function handleFileChange(file: File | null) {
    setMessage(null);
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
    setMessage("CSV loaded. Preview the holdings before creating the portfolio.");
  }

  function resetFile() {
    setFileName("");
    setCsvText("");
    setPreview(null);
    setMessage(null);
    setIsSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function runPreview() {
    if (!csvText.trim()) {
      setIsSuccess(false);
      setMessage("Choose your Trading 212 CSV export first.");
      return;
    }

    setMessage(null);
    setPreview(null);
    setIsSuccess(false);

    startPreviewing(async () => {
      const result = await previewTrading212CsvForNewPortfolio(csvText);

      if (!result.success) {
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

  function createPortfolio() {
    if (!name.trim()) {
      setIsSuccess(false);
      setMessage("Portfolio name is required.");
      return;
    }

    if (!csvText.trim()) {
      setIsSuccess(false);
      setMessage("Choose your Trading 212 CSV export first.");
      return;
    }

    if (!preview) {
      setIsSuccess(false);
      setMessage("Preview the CSV before creating the portfolio.");
      return;
    }

    setMessage(null);
    setIsSuccess(false);

    startCreating(async () => {
      const result = await createPortfolioFromTrading212Csv({
        name,
        csvText,
        currency: "USD",
      });

      if (!result.success || !result.data?.portfolioId) {
        setMessage(result.error ?? "Could not create this portfolio from CSV.");
        return;
      }

      setIsSuccess(true);
      setMessage(
        `Created ${result.data.portfolioName} with ${result.data.imported} imported holding${
          result.data.imported === 1 ? "" : "s"
        }.`,
      );

      router.push(
        `/portfolio?portfolio=${encodeURIComponent(result.data.portfolioId)}&created=trading212`,
      );
    });
  }

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <header className="relative overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] px-5 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:px-6">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#ddb159]/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Add Existing Portfolio
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.05em] text-[#faf6f0] sm:text-[36px]">
              Import Trading 212 CSV
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/58 sm:text-[13px]">
              Upload your export, preview supported holdings, then create a normal
              StockGPT portfolio from the reviewed import.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/36 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
          >
            Back
          </button>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-3xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-6">
          <div className="grid gap-5">
            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                Portfolio name
              </span>
              <input
                value={name}
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                  setMessage(null);
                }}
                className="h-12 w-full rounded-2xl border-2 border-[#072116]/10 bg-white px-4 text-[15px] font-black text-[#072116] outline-none focus:border-[#ddb159]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                  Currency
                </span>
                <select
                  value="USD"
                  disabled
                  className="h-12 w-full rounded-2xl border-2 border-[#072116]/10 bg-[#f2eee5] px-4 text-[14px] font-black text-[#072116]/70"
                >
                  <option value="USD">USD · US dollars</option>
                </select>
                <p className="mt-1 text-[10px] font-semibold text-[#072116]/45">
                  This import uses StockGPT’s USD ranked-stock price feed.
                </p>
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                  CSV file
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  className="block h-12 w-full min-w-0 cursor-pointer rounded-2xl border-2 border-dashed border-[#00a6ff]/35 bg-[#f7fbff] px-3 py-2 text-[12px] font-bold text-[#072116] outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#00a6ff] file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.08em] file:text-white hover:border-[#00a6ff] focus:border-[#00a6ff]"
                />
              </label>
            </div>

            {fileName && (
              <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-[#072116]/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
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

            <div className="rounded-2xl border border-[#ddb159]/25 bg-[#fff8e4] px-3 py-2">
              <p className="text-[11px] font-bold leading-5 text-[#8a641a]">
                Review before saving. Unsupported tickers, cash rows, empty files,
                malformed numbers and non-CSV uploads are rejected or clearly skipped.
              </p>
            </div>

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
                onClick={createPortfolio}
                disabled={isCreating || !preview || !csvText.trim()}
                className="h-11 w-full rounded-2xl bg-[#072116] px-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#ddb159] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create portfolio"}
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
          </div>
        </div>

        <aside className="min-w-0 rounded-3xl border border-[#ddb159]/20 bg-[#061b12] p-4 text-[#faf6f0] shadow-[0_8px_22px_rgba(0,0,0,0.18)]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Import review
          </p>

          {preview ? (
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                <ImportStat label="Matched" value={preview.imported} />
                <ImportStat label="Skipped" value={preview.skipped} />
                <ImportStat label="Value" value={money(preview.totalValue)} />
              </div>
              {preview.matchedTickers?.length ? (
                <p className="break-words rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.05] px-3 py-2 text-[10px] font-semibold leading-5 text-[#faf6f0]/62">
                  Matched: {preview.matchedTickers.slice(0, 28).join(", ")}
                  {preview.matchedTickers.length > 28 ? "…" : ""}
                </p>
              ) : null}
              {preview.skippedTickers?.length ? (
                <p className="break-words rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-[10px] font-semibold leading-5 text-red-100/80">
                  Skipped: {preview.skippedTickers.slice(0, 28).join(", ")}
                  {preview.skippedTickers.length > 28 ? "…" : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[#ddb159]/24 bg-[#faf6f0]/[0.035] p-4">
              <p className="text-[13px] font-black">No preview yet.</p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/48">
                Upload a Trading 212 CSV and preview it before creating the portfolio.
              </p>
            </div>
          )}

          <p className="mt-4 text-[10px] font-semibold leading-5 text-[#faf6f0]/38">
            This creates a normal StockGPT portfolio. StockGPT does not connect to or
            control your Trading 212 account.
          </p>
        </aside>
      </section>
    </div>
  );
}
