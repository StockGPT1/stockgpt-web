"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ManualPortfolioEntry } from "@/components/ManualPortfolioEntry";
import { MobileSheet } from "@/components/MobileSheet";
import { WatchlistToggle } from "@/components/WatchlistToggle";
import { StockIcon } from "@/components/StockIcon";

type PortfolioOption = {
  id: string;
  name: string;
  cashBalance?: number | null;
  currency?: string | null;
};

type SuccessState = {
  portfolioId: string;
  updatedExisting: boolean;
};

export function AddToPortfolioButton({
  ticker,
  price,
  isAuthenticated,
  portfolios = [],
  defaultPortfolioId = null,
  initialInWatchlist = false,
}: {
  ticker: string;
  price: number | null;
  isAuthenticated: boolean;
  portfolios?: PortfolioOption[];
  defaultPortfolioId?: string | null;
  initialInWatchlist?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const upperTicker = ticker.toUpperCase();
  const titleId = `add-${upperTicker.toLowerCase()}-to-portfolio`;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
    setSuccess(null);
  }

  function openFlow() {
    if (!isAuthenticated) {
      const next = `/stock/${encodeURIComponent(upperTicker)}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }

    setSuccess(null);
    setOpen(true);
  }

  function renderBody() {
    if (success) {
      return (
        <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-5 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-300/15 text-emerald-300">
            <StockIcon name="check" className="size-6" />
          </div>
          <h3 className="mt-4 text-[24px] font-black tracking-[-0.04em] text-[#faf6f0]">
            {success.updatedExisting ? `${upperTicker} updated.` : `${upperTicker} added.`}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-[12px] font-semibold leading-5 text-[#faf6f0]/58">
            {success.updatedExisting
              ? "This holding already existed, so its position details were updated rather than duplicated."
              : "The stock is now tracked alongside your holdings for portfolio research and allocation review."}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/portfolio?portfolio=${encodeURIComponent(success.portfolioId)}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white"
            >
              View portfolio
            </Link>
            <button
              type="button"
              onClick={close}
              className="min-h-12 rounded-full border border-[#ddb159]/35 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
            >
              Keep researching
            </button>
          </div>
        </div>
      );
    }

    if (portfolios.length === 0) {
      return (
        <div className="rounded-3xl border border-[#ddb159]/20 bg-[#061b12] p-4 text-[#faf6f0] sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            No portfolio yet
          </p>
          <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em]">
            Create a Portfolio Draft first.
          </h3>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">
            You do not have a portfolio yet. Choose how you want to create one,
            then return to add {upperTicker}.
          </p>
          <div className="mt-5 grid gap-2">
            <Link
              href="/portfolio?builder=1&mode=manual"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ddb159] px-4 text-center text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Create manual portfolio
            </Link>
            <Link
              href="/portfolio?builder=1&mode=ai"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#ddb159]/35 px-4 text-center text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
            >
              Generate AI Portfolio Draft
            </Link>
            <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-[#ddb159]/16 bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-semibold leading-5 text-[#faf6f0]/55">
                Not ready to create a portfolio? Save it as a watchlist idea.
              </p>
              <WatchlistToggle
                ticker={upperTicker}
                initialInWatchlist={initialInWatchlist}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 rounded-2xl border border-[#ddb159]/16 bg-white/[0.035] p-3 text-[#faf6f0] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
              Add as
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/55">
              Use the form for a holding, or save the stock as a watchlist idea.
            </p>
          </div>
          <WatchlistToggle
            ticker={upperTicker}
            initialInWatchlist={initialInWatchlist}
            isAuthenticated={isAuthenticated}
          />
        </div>
        <ManualPortfolioEntry
          defaultTicker={ticker}
          defaultEntryPrice={price}
          compact
          isAuthenticated={isAuthenticated}
          portfolios={portfolios}
          defaultPortfolioId={defaultPortfolioId}
          onSuccess={setSuccess}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openFlow}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 max-w-full items-center justify-center rounded-full border border-[#ddb159]/40 bg-[#ddb159]/12 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-[#ddb159]/70 hover:bg-[#ddb159]/18 focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2 focus:ring-offset-[#072116] disabled:text-[#ddb159]/60"
      >
        Add to portfolio
      </button>

      {open && (
        <>
          {createPortal(
            <div className="fixed inset-0 z-[2147483647] hidden overflow-x-hidden bg-[#020805]/88 text-[#faf6f0] backdrop-blur-md lg:block">
              <button
                type="button"
                aria-label="Close add to portfolio modal"
                className="absolute inset-0 h-full w-full cursor-default"
                onClick={close}
              />

              <div className="relative z-10 flex min-h-full w-full items-center justify-center px-5 py-6">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  className="relative max-h-[88vh] w-full max-w-[580px] overflow-y-auto overflow-x-hidden rounded-[28px] border border-[#ddb159]/30 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.72)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={close}
                    className="absolute right-4 top-4 z-10 min-h-11 rounded-full border border-[#ddb159]/18 bg-[#faf6f0]/[0.045] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
                  >
                    Close
                  </button>

                  <header className="min-w-0 border-b border-[#ddb159]/14 bg-[#04140c] px-5 pb-4 pr-24 pt-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                      Portfolio workflow
                    </p>
                    <h2
                      id={titleId}
                      className="mt-1 text-[28px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]"
                    >
                      Add {upperTicker} to portfolio
                    </h2>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/55">
                      Track this stock alongside your holdings. This is research support,
                      not a buy or sell instruction.
                    </p>
                  </header>

                  <div className="min-w-0 p-4">{renderBody()}</div>
                </div>
              </div>
            </div>,
            document.body,
          )}

          <MobileSheet
            open={open}
            variant="full"
            title={`Add ${upperTicker} to portfolio`}
            eyebrow="Portfolio workflow"
            description="Track this stock alongside your holdings. Educational only; not a buy or sell instruction."
            onClose={close}
            labelledById={`${titleId}-mobile`}
          >
            {renderBody()}
          </MobileSheet>
        </>
      )}
    </>
  );
}
