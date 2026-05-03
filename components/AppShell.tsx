import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { StockSearch } from "@/components/StockSearch";

const sidebarItems = [
  ["/", "Dashboard"],
  ["/rankings", "Rankings"],
  ["/watchlist", "Watchlist"],
  ["/world-news", "World News"],
  ["/settings", "Settings"],
  ["/account", "Account"],
] as const;

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="h-screen overflow-hidden bg-[#02140d] text-[#f8f3e7]">
      <header className="h-[84px] border-b border-[#d4af37]/20 bg-[#03130c]">
        <div className="mx-auto flex h-full w-full items-center gap-4 px-4">
          <Link href="/" className="flex h-full items-center">
            <Image src="/logo.png" alt="StockGPT" width={220} height={72} className="h-[72px] w-auto object-contain" priority />
          </Link>
          <div className="mx-auto w-full max-w-2xl"><StockSearch /></div>
          <Link href="/account" className="rounded-full border border-[#d4af37] px-3 py-2 text-[#d4af37]">◌</Link>
        </div>
      </header>

      <div className="grid h-[calc(100vh-84px)] grid-cols-[240px_1fr]">
        <aside className="border-r border-[#d4af37]/20 bg-[#031a12] p-4">
          <nav className="space-y-2">{sidebarItems.map(([href, label]) => <Link key={href} href={href} className={`block rounded-lg px-3 py-3 text-sm ${activePath === href ? "bg-[#0a2a1d] text-[#d4af37]" : "text-[#f8f3e7]/90 hover:bg-[#082318]"}`}>{label}</Link>)}</nav>
        </aside>
        <section className="overflow-hidden p-4">{children}</section>
      </div>
    </div>
  );
}
