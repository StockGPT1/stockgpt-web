"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deletePortfolio,
  renamePortfolio,
  updatePortfolioPreferences,
} from "@/lib/actions/portfolio-management";

type LegacyPortfolioOption = {
  id: string;
  name: string;
  legacyCurrency: boolean;
};

export function LegacyPortfolioCurrencyWorkspace({
  portfolioId,
  portfolioName,
  storedCurrency,
  portfolios,
  holdings,
  objective,
  riskTolerance,
  timeHorizon,
}: {
  portfolioId: string;
  portfolioName: string;
  storedCurrency: string | null;
  portfolios: LegacyPortfolioOption[];
  holdings: Array<{ ticker: string; shares: number | null }>;
  objective: string | null;
  riskTolerance: string | null;
  timeHorizon: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(portfolioName);
  const [objectiveValue, setObjectiveValue] = useState(objective ?? "balanced");
  const [riskValue, setRiskValue] = useState(riskTolerance ?? "moderate");
  const [horizonValue, setHorizonValue] = useState(timeHorizon ?? "medium");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectPortfolio(nextId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("portfolio", nextId);
    router.replace(`/portfolio?${params.toString()}`);
  }

  function saveMetadata() {
    startTransition(async () => {
      const renamed = await renamePortfolio({ portfolioId, name: name.trim() });
      if (!renamed.success) {
        setMessage(renamed.error ?? "Could not rename portfolio.");
        return;
      }
      const updated = await updatePortfolioPreferences({
        portfolioId,
        objective: objectiveValue as "growth" | "income" | "balanced" | "capital_preservation" | "watchlist",
        riskTolerance: riskValue as "conservative" | "moderate" | "aggressive",
        timeHorizon: horizonValue as "short" | "medium" | "long",
      });
      setMessage(updated.success ? "Portfolio details updated." : updated.error ?? "Could not update portfolio.");
      if (updated.success) router.refresh();
    });
  }

  function removePortfolio() {
    if (!window.confirm(`Delete “${portfolioName}” and its history?`)) return;
    startTransition(async () => {
      const result = await deletePortfolio({ portfolioId });
      if (!result.success) {
        setMessage(result.error ?? "Could not delete portfolio.");
        return;
      }
      router.push("/portfolio");
      router.refresh();
    });
  }

  return (
    <main className="min-h-full bg-[#061b12] px-4 pb-24 pt-8 text-[#faf6f0] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="min-w-64">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/45">Portfolio</span>
            <select value={portfolioId} onChange={(event) => selectPortfolio(event.target.value)} className="h-12 w-full rounded-2xl border border-[#ddb159]/25 bg-[#04140c] px-4 text-sm font-bold">
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}{portfolio.legacyCurrency ? " · Legacy currency" : ""}
                </option>
              ))}
            </select>
          </label>
          <Link href="/portfolio?builder=1" className="rounded-full bg-[#ddb159] px-5 py-3 text-xs font-black text-[#061b12]">Create a USD portfolio</Link>
        </div>

        <section className="mt-8 rounded-[28px] border border-[#ddb159]/25 bg-[#0a281b] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#ddb159]">Legacy currency basis</p>
          <h1 className="mt-3 text-2xl font-black">Financial analysis is limited</h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#faf6f0]/65">
            This Portfolio was created before StockGPT standardized Portfolio accounting in USD. Its stored {storedCurrency ?? "unknown"} currency basis cannot be reconciled safely from the stored data, so StockGPT is keeping the record intact rather than guessing an FX conversion.
          </p>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#faf6f0]/50">
            Financial totals, P&amp;L, health, charts and financial actions are unavailable. You can still review the tracked instruments, update nonfinancial details, create a new USD Portfolio, import again, or delete this Portfolio.
          </p>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#faf6f0]/10 bg-[#081f15] p-6">
          <h2 className="text-sm font-black">Tracked instruments</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {holdings.length === 0 ? <p className="text-sm text-[#faf6f0]/45">No tracked holdings.</p> : holdings.map((holding) => (
              <div key={holding.ticker} className="rounded-2xl border border-[#faf6f0]/8 px-4 py-3">
                <span className="font-black">{holding.ticker}</span>
                <span className="ml-2 text-sm text-[#faf6f0]/50">{holding.shares ?? "Unknown"} shares</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#faf6f0]/10 bg-[#081f15] p-6">
          <h2 className="text-sm font-black">Safe Portfolio details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} aria-label="Portfolio name" className="h-12 rounded-2xl border border-[#faf6f0]/10 bg-[#04140c] px-4" />
            <select value={objectiveValue} onChange={(event) => setObjectiveValue(event.target.value)} aria-label="Objective" className="h-12 rounded-2xl border border-[#faf6f0]/10 bg-[#04140c] px-4"><option value="growth">Growth</option><option value="income">Income</option><option value="balanced">Balanced</option><option value="capital_preservation">Preservation</option><option value="watchlist">Watchlist</option></select>
            <select value={riskValue} onChange={(event) => setRiskValue(event.target.value)} aria-label="Risk tolerance" className="h-12 rounded-2xl border border-[#faf6f0]/10 bg-[#04140c] px-4"><option value="conservative">Conservative</option><option value="moderate">Moderate</option><option value="aggressive">Aggressive</option></select>
            <select value={horizonValue} onChange={(event) => setHorizonValue(event.target.value)} aria-label="Time horizon" className="h-12 rounded-2xl border border-[#faf6f0]/10 bg-[#04140c] px-4"><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select>
          </div>
          {message && <p role="status" className="mt-4 text-sm text-[#faf6f0]/65">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={pending || !name.trim()} onClick={saveMetadata} className="rounded-full bg-[#ddb159] px-5 py-3 text-xs font-black text-[#061b12] disabled:opacity-50">Save details</button>
            <Link href="/portfolio?builder=1&mode=manual" className="rounded-full border border-[#ddb159]/30 px-5 py-3 text-xs font-black text-[#ddb159]">Recreate manually</Link>
            <button type="button" disabled={pending} onClick={removePortfolio} className="rounded-full border border-[#f1908d]/35 px-5 py-3 text-xs font-black text-[#ffc0bd] disabled:opacity-50">Delete portfolio</button>
          </div>
        </section>
      </div>
    </main>
  );
}
