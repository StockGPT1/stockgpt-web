"use client";

import { useTransition } from "react";
import { removeFromWatchlist } from "@/lib/actions/watchlist";

export function WatchlistRemoveButton({
  ticker,
  variant = "light",
}: {
  ticker: string;
  variant?: "light" | "dark";
}) {
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
      className={[
        "grid size-8 place-items-center rounded-full border transition disabled:opacity-50",
        variant === "dark"
          ? "border-white/[0.07] bg-black/10 text-[#faf6f0]/34 hover:border-red-300/20 hover:bg-red-400/10 hover:text-red-200"
          : "border-transparent text-[#072116]/30 hover:bg-red-50 hover:text-red-500",
      ].join(" ")}
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
