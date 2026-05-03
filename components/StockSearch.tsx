"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function StockSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = query.trim().toUpperCase();
    if (!value) return;
    router.push(`/stocks/${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-sm">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stocks..."
        className="w-full rounded-xl border border-[#D6AE46]/20 bg-[#08251a] py-2 pl-10 pr-3 text-sm text-[#F8F3E7] placeholder:text-[#b8c5b6]"
      />
      <span className="pointer-events-none absolute left-3 top-2.5 text-[#D6AE46]">⌕</span>
    </form>
  );
}
