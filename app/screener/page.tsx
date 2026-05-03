import { AppShell } from "@/components/AppShell";

export default function ScreenerPage() {
  return <AppShell activePath="/screener"><main className="rounded-2xl border border-[#D6AE46]/20 bg-[#FFFAF0] p-5 text-[#062018]"><h1 className="text-2xl font-semibold">Screener</h1><p className="mt-2 text-sm text-slate-600">Use Rankings search and filters to screen stocks. Advanced screener controls are coming soon.</p><a className="mt-4 inline-block rounded-lg bg-[#062018] px-3 py-2 text-sm text-[#F8F3E7]" href="/rankings">Open Rankings Filters</a></main></AppShell>;
}
