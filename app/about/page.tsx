import { AppShell } from "@/components/AppShell";

export default function AboutPage() {
  return <AppShell activePath="/about"><main className="rounded-2xl border border-[#D6AE46]/20 bg-[#FFFAF0] p-5 text-[#062018]"><h1 className="text-2xl font-semibold">About StockGPT</h1><p className="mt-2 text-sm text-slate-700">StockGPT delivers AI-powered stock ranking workflows with subscription access and secure account management.</p></main></AppShell>;
}
