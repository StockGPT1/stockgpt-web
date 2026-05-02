import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

const items = [
  ["/", "Dashboard", "◈"],
  ["/rankings", "Rankings", "♛"],
  ["/world-news", "Insights", "✦"],
  ["/watchlist", "Watchlist", "◉"],
  ["/account", "Account", "◎"],
  ["/settings", "Settings", "⚙"],
] as const;

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#174934_0%,#081810_40%,#040b08_100%)] text-[#F8F3E7]">
      <div className="mx-auto grid w-full max-w-[1700px] gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-[#D4AF37]/25 bg-[#04120d]/85 p-4 shadow-[0_0_50px_rgba(8,55,35,0.45)] backdrop-blur">
          <Link href="/" className="mb-8 flex items-center gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#0a261b] p-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-[#D4AF37]/50 bg-[#082117] p-1">
              <Image src="/logo.png" alt="StockGPT" fill className="object-contain" />
            </div>
            <div>
              <p className="text-3xl font-semibold leading-none"><span className="text-white">Stock</span> <span className="text-[#D4AF37]">GPT</span></p>
              <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]/85">AI-powered investing</p>
            </div>
          </Link>
          <nav className="space-y-2">
            {items.map(([href, label, icon]) => (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${activePath === href ? "border-[#D4AF37]/60 bg-[#0e3022] text-[#F8F3E7]" : "border-transparent text-[#F8F3E7]/78 hover:border-[#D4AF37]/20 hover:bg-[#0b241a]"}`}>
                <span className="text-[#D4AF37]">{icon}</span><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-8 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-b from-[#0e2e22] to-[#081b14] p-4">
            <p className="text-lg font-semibold text-[#D4AF37]">Upgrade to Premium</p>
            <p className="mt-2 text-sm text-[#F8F3E7]/80">Unlock advanced insights and model-backed rankings.</p>
            <Link href="/pricing" className="mt-4 inline-block rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-[#0A1F16]">Go Premium</Link>
          </div>
        </aside>
        <section>
          <header className="mb-4 flex items-center justify-between rounded-2xl border border-[#D4AF37]/20 bg-[#05150f]/80 p-4">
            <div className="hidden gap-6 md:flex">{["Dashboard","Rankings","Watchlist","Insights"].map((x)=><span key={x} className="text-sm text-[#F8F3E7]/80">{x}</span>)}</div>
            <div className="flex items-center gap-3"><div className="rounded-xl border border-[#D4AF37]/25 bg-[#082117] px-4 py-2 text-sm text-[#F8F3E7]/70">Search stocks...</div><Link href="/account" className="rounded-full border border-[#D4AF37]/70 p-2 text-[#D4AF37]">◌</Link></div>
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}
