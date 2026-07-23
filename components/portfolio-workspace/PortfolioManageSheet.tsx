"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { PortfolioExportLink } from "@/components/portfolio-workspace/PortfolioExportLink";
import { PortfolioSheet } from "@/components/portfolio-workspace/PortfolioSheet";
import type {
  PortfolioMeta,
  PortfolioTransaction,
} from "@/components/portfolio-workspace/types";
import {
  deletePortfolio,
  renamePortfolio,
  updatePortfolioPreferences,
} from "@/lib/actions/portfolio-management";

type FeedbackTone = "neutral" | "error" | "success";

function Feedback({
  message,
  tone,
}: {
  message: string | null;
  tone: FeedbackTone;
}) {
  if (!message) return null;
  const style =
    tone === "error"
      ? "border-[#f1908d]/24 bg-[#f1908d]/8 text-[#ffc0bd]"
      : tone === "success"
        ? "border-[#61d7ab]/24 bg-[#61d7ab]/8 text-[#9de9cc]"
        : "border-[#faf6f0]/8 bg-[#faf6f0]/4 text-[#faf6f0]/58";
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-4 rounded-2xl border px-4 py-3 text-[11px] font-bold leading-5 ${style}`}
    >
      {message}
    </p>
  );
}

function PreferenceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      <span className="mb-2 block text-[10px] font-black text-[#faf6f0]/42">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04140c] px-4 text-[13px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/18"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PortfolioManageSheet({
  open,
  onClose,
  portfolioId,
  meta,
  holdings,
  transactions,
}: {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  meta: PortfolioMeta;
  holdings: ExtendedHolding[];
  transactions: PortfolioTransaction[];
}) {
  const router = useRouter();
  const [name, setName] = useState(meta.name);
  const [objective, setObjective] = useState(meta.objective ?? "balanced");
  const [risk, setRisk] = useState(meta.riskTolerance ?? "moderate");
  const [horizon, setHorizon] = useState(meta.timeHorizon ?? "medium");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<FeedbackTone>("neutral");
  const [isPending, startTransition] = useTransition();
  const dirty =
    name.trim() !== meta.name ||
    objective !== (meta.objective ?? "balanced") ||
    risk !== (meta.riskTolerance ?? "moderate") ||
    horizon !== (meta.timeHorizon ?? "medium");

  function resetAndClose() {
    setName(meta.name);
    setObjective(meta.objective ?? "balanced");
    setRisk(meta.riskTolerance ?? "moderate");
    setHorizon(meta.timeHorizon ?? "medium");
    setMessage(null);
    onClose();
  }

  function save() {
    if (!name.trim()) {
      setMessage("Portfolio name cannot be empty.");
      setTone("error");
      return;
    }
    setMessage("Saving changes…");
    setTone("neutral");
    startTransition(async () => {
      const renamed =
        name.trim() !== meta.name
          ? await renamePortfolio({ portfolioId, name: name.trim() })
          : { success: true };
      if (!renamed.success) {
        setMessage(renamed.error ?? "Could not rename portfolio.");
        setTone("error");
        return;
      }
      const result = await updatePortfolioPreferences({
        portfolioId,
        objective: objective as
          | "growth"
          | "income"
          | "balanced"
          | "capital_preservation"
          | "watchlist",
        riskTolerance: risk as "conservative" | "moderate" | "aggressive",
        timeHorizon: horizon as "short" | "medium" | "long",
      });
      if (!result.success) {
        setMessage(result.error ?? "Could not save preferences.");
        setTone("error");
        return;
      }
      setMessage("Portfolio updated.");
      setTone("success");
      router.refresh();
      window.setTimeout(resetAndClose, 550);
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete “${meta.name}”? This permanently removes its holdings and portfolio history.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deletePortfolio({ portfolioId });
      if (!result.success) {
        setMessage(result.error ?? "Could not delete portfolio.");
        setTone("error");
        return;
      }
      router.push("/portfolio");
      router.refresh();
    });
  }

  return (
    <PortfolioSheet
      open={open}
      onClose={resetAndClose}
      title="Manage portfolio"
      subtitle="Preferences, data and administration"
      closeConfirmation={
        dirty && !isPending ? "Discard unsaved portfolio changes?" : null
      }
    >
      <div className="space-y-8">
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Portfolio details
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-[10px] font-black text-[#faf6f0]/42">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04140c] px-4 text-[14px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/18"
            />
          </label>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[#faf6f0]/8 px-4 py-3">
            <span>
              <span className="block text-[10px] font-black text-[#faf6f0]">
                Display currency
              </span>
              <span className="mt-1 block text-[9px] font-semibold text-[#faf6f0]/34">
                Managed globally in Settings
              </span>
            </span>
            <Link
              href="/settings"
              className="min-h-11 rounded-full border border-[#ddb159]/18 px-4 py-3 text-[10px] font-black text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
            >
              {meta.currency} · Change
            </Link>
          </div>

          <div className="mt-3 rounded-2xl border border-[#faf6f0]/8 px-4 py-3">
            <p className="text-[10px] font-black text-[#faf6f0]">
              Dashboard portfolio selection
            </p>
            <p className="mt-1 text-[9px] font-semibold leading-5 text-[#faf6f0]/34">
              StockGPT automatically uses the highest-value active portfolio on the dashboard, so there is no fragile manual primary-portfolio setting to maintain.
            </p>
          </div>
        </section>

        <section className="border-t border-[#faf6f0]/8 pt-7">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Investment preferences
          </p>
          <div className="mt-4 grid gap-4">
            <PreferenceSelect
              label="Objective"
              value={objective}
              onChange={setObjective}
              options={[
                ["growth", "Growth"],
                ["income", "Income"],
                ["balanced", "Balanced"],
                ["capital_preservation", "Preservation"],
                ["watchlist", "Watchlist"],
              ]}
            />
            <PreferenceSelect
              label="Risk tolerance"
              value={risk}
              onChange={setRisk}
              options={[
                ["conservative", "Conservative"],
                ["moderate", "Moderate"],
                ["aggressive", "Aggressive"],
              ]}
            />
            <PreferenceSelect
              label="Time horizon"
              value={horizon}
              onChange={setHorizon}
              options={[
                ["short", "Short"],
                ["medium", "Medium"],
                ["long", "Long"],
              ]}
            />
          </div>
        </section>

        <section className="border-t border-[#faf6f0]/8 pt-7">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Portfolio data
          </p>
          <p className="mt-2 text-[10px] font-semibold leading-5 text-[#faf6f0]/34">
            Export current holdings and the loaded activity history without changing the portfolio.
          </p>
          <div className="mt-4">
            <PortfolioExportLink
              meta={meta}
              holdings={holdings}
              transactions={transactions}
            />
          </div>
        </section>

        <section className="border-t border-[#faf6f0]/8 pt-7">
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={save}
            className="h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12] disabled:opacity-35"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          <Feedback message={message} tone={tone} />
        </section>

        <section className="border-t border-red-400/14 pt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">
            Danger zone
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/38">
            Deleting a portfolio removes its holdings and cannot be undone.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={remove}
            className="mt-4 h-12 w-full rounded-2xl border border-red-400/26 text-[11px] font-black text-red-200 disabled:opacity-40"
          >
            Delete portfolio
          </button>
        </section>
      </div>
    </PortfolioSheet>
  );
}
