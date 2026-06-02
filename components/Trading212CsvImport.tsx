"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { importTrading212Csv } from "@/lib/actions/portfolio-management";

type ImportSummary = {
  imported: number;
  skipped: number;
  totalValue: number;
  skippedTickers: string[];
};

export function Trading212CsvImport({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(file: File | null) {
    setMessage(null);
    setSummary(null);
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
  }

  function submitImport() {
    if (!csvText.trim()) {
      setIsSuccess(false);
      setMessage("Choose your Trading 212 CSV export first.");
      return;
    }

    setMessage(null);
    setSummary(null);

    startTransition(async () => {
      const result = await importTrading212Csv(csvText, {
        replaceExisting,
      });

      if (!result.success) {
        setIsSuccess(false);
        setMessage(result.error ?? "Could not import your Trading 212 CSV.");
        return;
      }

      setIsSuccess(true);
      setSummary(result.data ?? null);

      const imported = result.data?.imported ?? 0;
      const skipped = result.data?.skipped ?? 0;

      setMessage(
        imported > 0
          ? `Imported ${imported} holding${imported === 1 ? "" : "s"} from Trading 212.${skipped > 0 ? ` ${skipped} row${skipped === 1 ? "" : "s"} could not be matched.` : ""}`
          : "No supported holdings were found in this CSV.",
      );

      setCsvText("");
      setFileName("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.refresh();
    });
  }

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]",
        compact ? "p-3" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full bg-[#ddb159]/20 blur-3xl" />

      <div className="relative">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ Trading 212 CSV Import
        </p>

        <h3
          className={[
            "mt-1 font-black tracking-[-0.035em]",
            compact ? "text-[18px]" : "text-[22px]",
          ].join(" ")}
        >
          Import your real portfolio
        </h3>

        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#072116]/55">
          Upload your Trading 212 CSV export. StockGPT will match tickers to
          the ranking model, calculate allocations and track alerts from your
          actual holdings.
        </p>

        <div className="mt-3 grid gap-2">
          <label className="block">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              CSV file
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-[#072116]/15 bg-white px-3 py-3 text-[12px] font-bold text-[#072116] outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#072116] file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.1em] file:text-[#ddb159] hover:border-[#ddb159] focus:border-[#ddb159]"
            />
          </label>

          {fileName && (
            <div className="rounded-xl border border-[#ddb159]/35 bg-[#fff8e8] px-3 py-2">
              <p className="truncate text-[11px] font-black text-[#072116]">
                {fileName}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#072116]/55">
                Ready to import.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 rounded-xl border border-[#072116]/10 bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
              className="mt-0.5 size-4 accent-[#ddb159]"
            />
            <span className="text-[11px] font-semibold leading-5 text-[#072116]/70">
              Replace my current portfolio with this CSV. Turn this off if you
              want to add/update holdings without deleting existing ones.
            </span>
          </label>

          <button
            type="button"
            onClick={submitImport}
            disabled={isPending || !csvText.trim()}
            className="h-11 w-full rounded-xl bg-[#ddb159] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Importing…" : "Import CSV"}
          </button>
        </div>

        {message && (
          <div
            className={[
              "mt-3 rounded-xl border px-3 py-2",
              isSuccess
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-700",
            ].join(" ")}
          >
            <p className="text-[11px] font-bold leading-5">{message}</p>

            {summary && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/70 px-2 py-1.5">
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#072116]/45">
                    Imported
                  </p>
                  <p className="text-[13px] font-black">{summary.imported}</p>
                </div>

                <div className="rounded-lg bg-white/70 px-2 py-1.5">
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#072116]/45">
                    Skipped
                  </p>
                  <p className="text-[13px] font-black">{summary.skipped}</p>
                </div>

                <div className="rounded-lg bg-white/70 px-2 py-1.5">
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#072116]/45">
                    Value
                  </p>
                  <p className="text-[13px] font-black">
                    ${summary.totalValue.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {summary?.skippedTickers?.length ? (
              <p className="mt-2 text-[10px] font-semibold leading-5 text-[#072116]/55">
                Skipped: {summary.skippedTickers.slice(0, 12).join(", ")}
                {summary.skippedTickers.length > 12 ? "…" : ""}
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-[#072116]/8 bg-white/70 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
            How to export from Trading 212
          </p>
          <p className="mt-1 text-[10px] font-semibold leading-5 text-[#072116]/55">
            Trading 212 app/web: Menu → History → Export → CSV. Export your
            Invest or ISA account, then upload the file here.
          </p>
        </div>
      </div>
    </div>
  );
}
