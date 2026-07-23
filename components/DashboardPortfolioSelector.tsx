"use client";

import { useRouter } from "next/navigation";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";

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
      <span className="relative block max-w-[210px]">
        <select
          value={value}
          onChange={(event) => router.push(`/dashboard?portfolio=${encodeURIComponent(event.target.value)}`)}
          className="h-10 w-full appearance-none truncate rounded-full border border-[#ddb159]/26 bg-[#04140c]/62 pl-4 pr-9 text-[11px] font-black text-[#faf6f0] outline-none backdrop-blur focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/32"
        >
          {portfolios.map((portfolio) => (
            <option key={portfolio.id} value={portfolio.id} className="bg-[#061b12]">
              {portfolio.name}
            </option>
          ))}
        </select>
        <PortfolioIcon
          name="chevron"
          className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[#ddb159]"
        />
      </span>
    </label>
  );
}
