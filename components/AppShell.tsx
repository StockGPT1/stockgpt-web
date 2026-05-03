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
  ["#", "Alerts", "🔔"],
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
    <div className="min-h-screen bg-[#02140d] text-[#f8f3e7]">
      <header className="h-[116px] border-b border-[#d4af37]/20 bg-[#03130c]">
        <div className="mx-auto flex h-full w-full max-w-[2048px] items-center gap-6 px-6">
          <Link href="/" className="flex w-[330px] items-center gap-3">
            <Image src="/logo.png" alt="Stock GPT" width={62} height={62} className="h-[62px] w-[62px] shrink-0 rounded-xl object-contain" priority />
            <div><p className="text-5xl leading-none text-[#f8f3e7]">Stock <span className="text-[#d4af37]">GPT</span></p><p className="text-sm tracking-[0.18em] text-[#d4af37]">AI-POWERED INVESTING</p></div>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-8 xl:flex">{topNav.map(([href, label]) => <Link key={label} href={href} className={`border-b-2 pb-2 text-[33px] ${activePath === href ? "border-[#d4af37] text-[#d4af37]" : "border-transparent text-[#f8f3e7]/90"}`}>{label}</Link>)}</nav>
          <div className="hidden items-center gap-4 lg:flex"><div className="w-[360px]"><StockSearch /></div><Link href="/account" className="grid h-[58px] w-[58px] place-items-center rounded-full border border-[#d4af37] text-2xl text-[#d4af37]">◌</Link></div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[2048px] grid-cols-1 gap-5 px-[25px] pb-6 pt-5 xl:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="hidden min-h-[936px] rounded-2xl border border-[#d4af37]/20 bg-[#031a12] p-[25px] xl:block">
          <nav className="space-y-[10px]">{sidebarItems.map(([href, label, icon]) => <Link key={label} href={href} className={`flex h-[60px] items-center gap-3 rounded-xl px-4 text-[30px] ${activePath === href ? "border border-[#d4af37]/45 bg-[#0a2a1d]" : ""}`}><span className="text-[#d4af37]">{icon}</span>{label}</Link>)}</nav>
          <div className="mt-10 rounded-xl border border-[#d4af37]/25 bg-[#052416] p-4"><p className="text-2xl text-[#d4af37]">👑</p><h3 className="mt-2 text-[34px] font-semibold">Upgrade to Premium</h3><p className="mt-2 text-[24px] text-[#d8d2bf]">Unlock advanced insights, custom reports and more.</p><Link href="/pricing" className="mt-4 block rounded-xl bg-[#d4af37] px-4 py-3 text-center text-[28px] font-semibold text-[#052416]">Go Premium</Link></div>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
