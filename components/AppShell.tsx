import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

const items = [["/","Dashboard","◈"],["/rankings","Rankings","♛"],["/world-news","Insights","✦"],["/watchlist","Watchlist","◉"],["/account","Account","◎"],["/settings","Settings","⚙"]] as const;

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="min-h-screen bg-[#03130c] text-[#F8F3E7]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1940px] gap-4 p-3 lg:grid-cols-[260px_1fr] lg:p-4">
        <aside className="hidden lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-b from-[#051b12] via-[#03120c] to-[#02100a] p-4">
          <Link href="/" className="mb-4 rounded-2xl border border-[#D4AF37]/30 bg-[#0a261b] p-3"><div className="relative h-16 w-full"><Image src="/logo.png" alt="StockGPT logo" fill className="object-contain object-left" /></div></Link>
          <nav className="space-y-2">{items.map(([href,label,icon])=><Link key={href} href={href} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${activePath===href?"border-[#D4AF37]/60 bg-[#123724]":"border-transparent text-[#F8F3E7]/85 hover:bg-[#0a261b]"}`}><span className="text-[#D4AF37]">{icon}</span>{label}</Link>)}</nav>
          <div className="mt-auto rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-b from-[#123724] to-[#0a2118] p-4"><p className="text-2xl font-semibold text-[#D4AF37]">Upgrade to Premium</p><p className="mt-2 text-sm text-[#F8F3E7]/80">Unlock advanced insights and custom reports.</p><Link href="/pricing" className="mt-4 inline-block rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-[#072117]">Go Premium</Link></div>
        </aside>

        <section className="flex min-h-screen flex-col gap-3 lg:h-[calc(100vh-2rem)] lg:min-h-0">
          <header className="rounded-2xl border border-[#D4AF37]/20 bg-[#05160f] px-4 py-3 lg:px-6 lg:py-4">
            <div className="mb-3 flex items-center justify-between lg:mb-0">
              <Link href="/" className="relative h-10 w-36 lg:hidden"><Image src="/logo.png" alt="StockGPT logo" fill className="object-contain object-left" /></Link>
              <div className="flex items-center gap-2"><div className="rounded-xl border border-[#D4AF37]/25 bg-[#042015] px-3 py-2 text-sm text-[#F8F3E7]/80 lg:px-6 lg:py-3">Search stocks...</div><Link href="/account" className="rounded-full border border-[#D4AF37] p-2 text-[#D4AF37]">◌</Link></div>
            </div>
            <div className="flex gap-5 overflow-x-auto text-sm">{["Dashboard","Rankings","Screener","Watchlist","Insights","Reports","About"].map((x)=><span key={x} className="whitespace-nowrap text-[#F8F3E7]/90">{x}</span>)}</div>
          </header>

          <div className="flex-1 lg:min-h-0 lg:overflow-hidden">{children}</div>

          <nav className="grid grid-cols-4 gap-2 rounded-2xl border border-[#D4AF37]/20 bg-[#05160f] p-2 lg:hidden">{items.slice(0,4).map(([href,label])=><Link key={href} href={href} className={`rounded-lg px-2 py-2 text-center text-xs ${activePath===href?"bg-[#123724] text-[#D4AF37]":"text-[#F8F3E7]/80"}`}>{label}</Link>)}</nav>
        </section>
      </div>
    </div>
  );
}
