"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function StockSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/rankings?q=${encodeURIComponent(value.toUpperCase())}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stocks..."
        className="w-full rounded-xl border border-[#d4af37]/25 bg-[#08251a] py-2 pl-10 pr-3 text-sm text-[#F8F3E7]"
      />
      <span className="pointer-events-none absolute left-3 top-2 text-[#d4af37]">⌕</span>
    </form>
  );
}
