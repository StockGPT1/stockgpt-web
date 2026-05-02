import Link from "next/link";
import { ReactNode } from "react";

const items = [
  ["/", "Dashboard"],
  ["/rankings", "Rankings"],
  ["/world-news", "World News"],
  ["/watchlist", "Watchlist"],
  ["/account", "Account"],
  ["/settings", "Settings"],
] as const;

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="min-h-screen bg-[#0F2A1F] text-[#F8F3E7]">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 p-4 md:p-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-[#D4AF37]/25 bg-[#071D15] p-5 lg:block">
          <Link href="/" className="mb-8 flex items-center gap-3">
            <img src="/logo.png" alt="StockGPT" className="h-9 w-9 rounded" />
            <span className="text-xl font-semibold text-[#D4AF37]">StockGPT</span>
          </Link>
          <nav className="space-y-2">
            {items.map(([href, label]) => (
              <Link key={href} href={href} className={`block rounded-xl px-4 py-3 ${activePath === href ? "bg-[#D4AF37] text-[#0F2A1F]" : "text-[#F8F3E7]/85 hover:bg-[#0B241A]"}`}>
                {label}
              </Link>
            ))}
            <Link href="/pricing" className="mt-6 block rounded-xl border border-[#D4AF37] px-4 py-3 text-center font-semibold text-[#D4AF37]">Upgrade</Link>
          </nav>
        </aside>
        <div className="flex-1">
          <header className="mb-6 rounded-2xl border border-[#D4AF37]/20 bg-[#0B241A] px-5 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-[#D4AF37]">StockGPT Terminal</h1>
              <div className="flex gap-3 text-sm"><Link href="/pricing" className="text-[#D4AF37]">Pricing</Link><Link href="/logout">Logout</Link></div>
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
