"use client";

import { useRouter } from "next/navigation";

export function DashboardPortfolioSelector({
  value,
  portfolios,
}: {
  value: string;
  portfolios: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  if (portfolios.length <= 1) return null;

  return (
    <label className="block min-w-0">
      <span className="sr-only">Choose dashboard portfolio</span>
      <select
        value={value}
        onChange={(event) => router.push(`/dashboard?portfolio=${encodeURIComponent(event.target.value)}`)}
        className="h-10 max-w-[210px] rounded-full border border-[#ddb159]/24 bg-[#061b12] px-3 text-[11px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
      >
        {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
      </select>
    </label>
  );
}
