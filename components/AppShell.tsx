import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { StockSearch } from "@/components/StockSearch";

const sidebarItems = [
  ["/", "Dashboard", "◈"],
  ["/rankings", "Rankings", "♛"],
  ["/screener", "Screener", "⌕"],
  ["/watchlist", "Watchlist", "◉"],
  ["/world-news", "Insights", "✦"],
  ["/reports", "Reports", "▤"],
  ["/account", "Account", "◎"],
  ["/settings", "Settings", "⚙"],
] as const;

const topNav = [
  ["/", "Dashboard"],
  ["/rankings", "Rankings"],
  ["/screener", "Screener"],
  ["/watchlist", "Watchlist"],
  ["/world-news", "Insights"],
  ["/reports", "Reports"],
  ["/about", "About"],
] as const;

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001c12] via-[#02140d] to-[#03130c] text-[#F8F3E7]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1800px] gap-3 p-3 lg:grid-cols-[240px_1fr]">
        <aside className="hidden rounded-2xl border border-[#D6AE46]/20 bg-gradient-to-b from-[#052416] to-[#062b1a] p-3 lg:flex lg:flex-col">
          <Link href="/" className="mb-3 rounded-xl border border-[#D6AE46]/30 bg-[#08251a] p-3">
            <Image src="/logo.png" alt="StockGPT" width={180} height={48} className="h-11 w-auto shrink-0 object-contain" priority />
            <p className="mt-1 text-[11px] tracking-[0.2em] text-[#D6AE46]/90">AI-POWERED INVESTING</p>
          </Link>
          <nav className="space-y-1">{sidebarItems.map(([href, label, icon]) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${activePath === href ? "bg-[#123726] text-[#F1CF6B]" : "text-[#F8F3E7]/85 hover:bg-[#0a2d20]"}`}><span>{icon}</span>{label}</Link>)}</nav>
          <Link href="/pricing" className="mt-auto rounded-xl border border-[#D6AE46]/40 bg-[#0c3122] p-3 text-sm text-[#F1CF6B]">👑 Upgrade to Premium</Link>
        </aside>
        <section className="flex min-h-screen flex-col gap-3">
          <header className="sticky top-2 z-20 flex h-[74px] items-center justify-between rounded-2xl border border-[#D6AE46]/20 bg-[#062018]/95 px-4 backdrop-blur">
            <div className="flex items-center gap-4 overflow-x-auto">
              <Link href="/" className="lg:hidden"><Image src="/logo.png" alt="StockGPT" width={130} height={38} className="h-9 w-auto object-contain" /></Link>
              {topNav.map(([href, label]) => <Link key={href} href={href} className={`whitespace-nowrap border-b-2 pb-1 text-sm ${activePath === href ? "border-[#D6AE46] text-[#F1CF6B]" : "border-transparent text-[#F8F3E7]/85"}`}>{label}</Link>)}
            </div>
            <div className="hidden items-center gap-2 md:flex"><StockSearch /><Link href="/account" className="rounded-full border border-[#D6AE46]/50 px-3 py-2 text-[#F1CF6B]">◌</Link></div>
          </header>
          <div className="flex-1">{children}</div>
        </section>
      </div>
    </div>
  );
}
