import { AppShell } from "@/components/AppShell";
import { PaywallCard } from "@/components/PaywallCard";

export default function ReportsPage() {
  return <AppShell activePath="/reports"><main className="space-y-3"><section className="rounded-2xl border border-[#D6AE46]/25 bg-[#062018] p-5"><h1 className="text-2xl font-semibold">Reports</h1><p className="text-sm text-[#b8c5b6]">Institutional-style report modules and exports.</p></section><PaywallCard /></main></AppShell>;
}
