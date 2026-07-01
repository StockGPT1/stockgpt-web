import Image from "next/image";
import type { ReactNode, RefObject } from "react";
import type { DemoView } from "@/lib/demo/demoSteps";
import { demoTickerTape } from "@/lib/demo/demoData";

const navItems = [
  ["dashboard", "Dashboard", "◇"],
  ["rankings", "Rankings", "♛"],
  ["portfolio", "Portfolio", "✦"],
  ["watchlist", "Watchlist", "☆"],
  ["alerts", "Alerts", "◐"],
  ["news", "World News", "◈"],
] as const;

function activeNav(view: DemoView) {
  if (view === "dashboard") return "dashboard";
  if (view === "rankings" || view === "stock") return "rankings";
  return "portfolio";
}

export function DemoAppShell({
  view,
  contentRef,
  children,
}: {
  view: DemoView;
  contentRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const active = activeNav(view);

  return (
    <div className="demo-content pointer-events-none relative flex h-[100dvh] flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <header className="relative z-20 flex h-[64px] shrink-0 items-center gap-3 border-b border-[#ddb159]/18 bg-[#04180f] px-3 sm:px-5">
        <div className="relative h-11 w-[150px] shrink-0">
          <Image src="/logo.png" alt="StockGPT" fill priority className="object-contain object-left" sizes="150px" />
        </div>
        <div className="hidden h-10 min-w-0 flex-1 items-center rounded-full border border-[#ddb159]/18 bg-white/[0.05] px-4 text-xs font-semibold text-white/35 md:flex">
          Search stocks, features and research
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-10 items-center rounded-full border border-[#ddb159]/25 px-4 text-[10px] font-black uppercase text-[#ddb159] sm:flex">
            Ask StockGPT
          </div>
          <div className="grid size-10 place-items-center rounded-full border border-[#ddb159]/50 text-[#ddb159]">◎</div>
        </div>
      </header>

      <div className="flex h-6 shrink-0 overflow-hidden border-b border-[#ddb159]/14 bg-[#03140d]">
        {demoTickerTape.map(([symbol, price, move]) => (
          <div key={symbol} className="flex shrink-0 items-center gap-2 border-r border-[#ddb159]/12 px-4 text-[9px] font-black">
            <span className="text-[#ddb159]">{symbol}</span>
            <span className="text-white/70">{price}</span>
            <span className={move.startsWith("+") ? "text-emerald-300" : "text-red-300"}>{move}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[178px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] px-3 py-4 lg:block">
          <nav className="space-y-2">
            {navItems.map(([id, label, icon]) => {
              const isActive = id === active;
              return (
                <div
                  key={id}
                  className={`flex h-10 items-center gap-2.5 rounded-xl border px-3 text-[12px] font-bold ${
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]"
                      : "border-transparent text-[#faf6f0]/68"
                  }`}
                >
                  <span className="w-5 text-center text-base text-[#ddb159]">{icon}</span>
                  <span>{label}</span>
                </div>
              );
            })}
          </nav>
        </aside>

        <div
          ref={contentRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#072116,#051a11)] p-3 pb-[calc(52dvh+84px)] sm:p-4 xl:pb-5 xl:pr-[390px]"
        >
          {children}
          <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/72 px-4 py-3 text-[10px] leading-5 text-white/34">
            StockGPT is an educational research tool. Demo values are illustrative and are not financial advice or buy/sell signals.
          </div>
        </div>
      </div>

      <nav className="absolute inset-x-0 bottom-0 z-30 flex h-[64px] border-t border-[#ddb159]/20 bg-[#04180f] pb-[env(safe-area-inset-bottom)] lg:hidden">
        {[
          ["dashboard", "◇", "Home"],
          ["rankings", "♛", "Rankings"],
          ["portfolio", "✦", "Portfolio"],
          ["alerts", "◐", "Alerts"],
          ["news", "◈", "News"],
        ].map(([id, icon, label]) => (
          <div key={id} className={`relative flex flex-1 flex-col items-center justify-center text-[10px] font-bold ${active === id ? "text-[#ddb159]" : "text-white/52"}`}>
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
            {active === id && <span className="absolute inset-x-4 top-0 h-0.5 bg-[#ddb159]" />}
          </div>
        ))}
      </nav>
    </div>
  );
}
