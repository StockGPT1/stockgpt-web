import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";

export default function PortfolioPage() {
  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <PortfolioBuilder />
      </main>
    </AppShell>
  );
}
