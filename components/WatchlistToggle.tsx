"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWatchlist } from "@/lib/actions/watchlist";

export function WatchlistToggle({
  ticker,
  initialInWatchlist,
  isAuthenticated,
}: {
  ticker: string;
  initialInWatchlist: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const previous = inWatchlist;
    setInWatchlist(!inWatchlist);

    startTransition(async () => {
      const result = await toggleWatchlist(ticker);
      if (!result.success) {
        setInWatchlist(previous);
        if (result.error === "not_authenticated") router.push("/login");
      } else if (result.inWatchlist !== undefined) {
        setInWatchlist(result.inWatchlist);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={[
        "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-[12px] font-black transition disabled:opacity-60",
        inWatchlist
          ? "border-[#ddb159] bg-[#ddb159] text-[#072116] hover:bg-[#c9a04f]"
          : "border-[#ddb159]/40 text-[#ddb159] hover:border-[#ddb159] hover:bg-[#ddb159]/10",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill={inWatchlist ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M12 2l2.9 6.3L22 9.2l-5 4.6L18.2 21 12 17.3 5.8 21 7 13.8 2 9.2l7.1-.9L12 2Z" />
      </svg>
      {inWatchlist ? "In Watchlist" : "Add to Watchlist"}
    </button>
  );
}
