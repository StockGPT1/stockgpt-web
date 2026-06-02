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
        "relative min-w-0 overflow-hidden rounded-3xl border border-[#00a6ff]/20 bg-[#f7fbff] text-[#072116] shadow-[0_10px_28px_rgba(0,0,0,0.16)]",
        compact ? "p-3" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#00a6ff]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-[#ddb159]/15 blur-3xl" />

      <div className="relative min-w-0">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#00a6ff] text-[13px] font-black tracking-[-0.04em] text-white shadow-[0_8px_20px_rgba(0,166,255,0.28)]">
              212
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#00a6ff]">
                Trading 212 import
              </p>
              <h3 className="mt-0.5 text-[21px] font-black tracking-[-0.04em] text-[#072116] sm:text-[24px]">
                Upload your portfolio CSV
              </h3>
            </div>
          </div>

          <span className="rounded-full border border-[#00a6ff]/20 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0078bd]">
            Fast setup
          </span>
        </div>

        <p className="mt-3 text-[12px] font-semibold leading-5 text-[#072116]/60">
          Import your real Trading 212 holdings and StockGPT will match them to
          rankings, scores, sector exposure and portfolio alerts.
        </p>

        <div className="mt-4 grid gap-2">
          {[
            ["1", "Export", "Trading 212 → Menu → History → Export → CSV."],
            ["2", "Upload", "Choose the CSV file below."],
            ["3", "Track", "StockGPT builds your live portfolio view."],
          ].map(([step, title, text]) => (
            <div
              key={step}
              className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-2xl border border-[#072116]/8 bg-white px-3 py-2.5"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-[#072116] text-[12px] font-black text-[#ddb159]">
                {step}
              </div>

              <div className="min-w-0">
                <p className="text-[12px] font-black text-[#072116]">
                  {title}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#072116]/55">
                  {text}
                </p>
              </div>
            </div>
          ))}
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
            <div className="min-w-0 rounded-2xl border border-[#00a6ff]/20 bg-white px-3 py-2">
              <p className="truncate text-[11px] font-black text-[#072116]">
                {fileName}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#072116]/55">
                Ready to import.
              </p>
            </div>
          )}

          <label className="flex min-w-0 items-start gap-2 rounded-2xl border border-[#072116]/10 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#00a6ff]"
            />
            <span className="min-w-0 text-[11px] font-semibold leading-5 text-[#072116]/65">
              Replace my current portfolio with this CSV. Turn this off to
              add/update imported holdings without clearing existing ones.
            </span>
          </label>

          <button
            type="button"
            onClick={submitImport}
            disabled={isPending || !csvText.trim()}
            className="h-11 w-full rounded-2xl bg-[#072116] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Importing…" : "Import Trading 212 CSV"}
          </button>
        </div>

        {message && (
          <div
            className={[
              "mt-3 rounded-2xl border px-3 py-2",
              isSuccess
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-700",
            ].join(" ")}
          >
            <p className="text-[11px] font-bold leading-5">{message}</p>

            {summary && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/80 px-2 py-1.5">
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#072116]/45">
                    Imported
                  </p>
                  <p className="text-[13px] font-black">{summary.imported}</p>
                </div>

                <div className="rounded-xl bg-white/80 px-2 py-1.5">
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#072116]/45">
                    Skipped
                  </p>
                  <p className="text-[13px] font-black">{summary.skipped}</p>
                </div>

                <div className="rounded-xl bg-white/80 px-2 py-1.5">
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

        <p className="mt-3 text-[10px] font-semibold leading-5 text-[#072116]/45">
          CSV files are read in your browser and sent securely to StockGPT only
          for portfolio import. This does not connect to or control your
          Trading 212 account.
        </p>
      </div>
    </div>
  );
}
