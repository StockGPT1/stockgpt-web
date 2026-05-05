"use client";

import { useTransition } from "react";
import { removeFromWatchlist } from "@/lib/actions/watchlist";

export function WatchlistRemoveButton({ ticker }: { ticker: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => {
      removeFromWatchlist(ticker);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={`Remove ${ticker} from watchlist`}
      title="Remove from watchlist"
      className="grid size-7 place-items-center rounded-full text-[#072116]/30 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
