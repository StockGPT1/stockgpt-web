import Image from "next/image";
import type { ReactNode, RefObject } from "react";
import type { DemoView } from "@/lib/demo/demoSteps";
import { demoTickerTape } from "@/lib/demo/demoData";
import { StockIcon, type StockIconName } from "@/components/StockIcon";

const navItems = [
  ["dashboard", "Dashboard", "dashboard"],
  ["rankings", "Rankings", "rankings"],
  ["portfolio", "Portfolio", "portfolio"],
  ["watchlist", "Watchlist", "watchlist"],
  ["alerts", "Alerts", "alerts"],
  ["news", "World News", "news"],
] as const;

function activeNav(view: DemoView) {
  if (view === "dashboard") return "dashboard";
  if (view === "rankings" || view === "stock") return "rankings";
  return "portfolio";
}

export function DemoAppShell({
  view,
  contentRef,
  guideOpen,
  children,
}: {
  view: DemoView;
  contentRef: RefObject<HTMLDivElement | null>;
  guideOpen: boolean;
  children: ReactNode;
}) {
  const active = activeNav(view);

  return (
    <div className="demo-content relative flex h-[100dvh] flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <header className="relative z-20 flex h-[64px] shrink-0 items-center gap-2 border-b border-[#ddb159]/18 bg-[#04180f] px-3 shadow-[0_8px_28px_rgba(0,0,0,0.24)] sm:px-5">
        <div className="absolute left-1/2 top-1/2 h-[46px] w-[155px] -translate-x-1/2 -translate-y-1/2 md:relative md:left-auto md:top-auto md:h-[52px] md:w-[205px] md:translate-x-0 md:translate-y-0">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-center md:object-left"
            sizes="(max-width: 768px) 155px, 205px"
          />
        </div>

        <div className="hidden h-10 min-w-0 flex-1 items-center rounded-full border border-[#ddb159]/18 bg-white/[0.05] px-4 text-xs font-semibold text-white/35 md:flex">
          Search stocks, features and research
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <div className="flex h-10 items-center rounded-full border border-[#ddb159]/25 px-4 text-[10px] font-black uppercase text-[#ddb159]">
            Ask StockGPT
          </div>
          <div
            className="grid size-10 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159]"
            aria-label="Demo account"
          >
            <StockIcon name="account" className="size-5" />
          </div>
        </div>

        <div
          className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] md:hidden"
          aria-label="Demo account"
        >
          <StockIcon name="account" className="size-5" />
        </div>
      </header>

      <div className="flex h-6 shrink-0 overflow-hidden border-b border-[#ddb159]/14 bg-[#03140d]">
        {demoTickerTape.map(([symbol, price, move]) => (
          <div
            key={symbol}
            className="flex shrink-0 items-center gap-2 border-r border-[#ddb159]/12 px-4 text-[9px] font-black"
          >
            <span className="text-[#ddb159]">{symbol}</span>
            <span className="text-white/70">{price}</span>
            <span className={move.startsWith("+") ? "text-emerald-300" : "text-red-300"}>
              {move}
            </span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-[#ddb159]/18 bg-[#04180f] px-3 py-2 md:hidden">
        <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-[#ddb159]/18 bg-white/[0.05] px-4 text-[11px] font-semibold text-white/35">
          Search stocks and research
        </div>
        <div
          className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/30 text-[#ddb159]"
          aria-label="Ask StockGPT demo"
        >
          <StockIcon name="ask" className="size-5" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[178px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] px-3 py-4 lg:block">
          <nav className="space-y-2">
            {navItems.map(([id, label, icon]) => {
              const isActive = id === active;

              return (
                <div
                  key={id}
                  className={`relative flex h-10 items-center gap-2.5 overflow-hidden rounded-xl border px-3 text-[12px] font-bold ${
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]"
                      : "border-transparent text-[#faf6f0]/78"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[#ddb159]" />
                  )}
                  <span className="grid w-5 place-items-center text-[#ddb159]">
                    <StockIcon name={icon as StockIconName} className="size-[18px]" />
                  </span>
                  <span>{label}</span>
                </div>
              );
            })}
          </nav>
        </aside>

        <div
          ref={contentRef}
          className={[
            "min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#072116,#051a11)] p-3 sm:p-3 lg:pb-3",
            guideOpen
              ? "pb-[clamp(270px,42dvh,360px)] lg:pb-3"
              : "pb-[84px] lg:pb-3",
          ].join(" ")}
        >
          {children}
          <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/72 px-4 py-3 text-[10px] leading-5 text-white/40">
            StockGPT is an educational research tool. Demo values are illustrative and
            are not financial advice or buy/sell signals.
          </div>
        </div>
      </div>

      <nav className="absolute inset-x-0 bottom-0 z-30 flex h-[64px] border-t border-[#ddb159]/20 bg-[#04180f] shadow-[0_-10px_24px_rgba(0,0,0,0.28)] lg:hidden">
        {[
          ["dashboard", "dashboard", "Home"],
          ["rankings", "rankings", "Rankings"],
          ["portfolio", "portfolio", "Portfolio"],
          ["alerts", "alerts", "Alerts"],
          ["news", "news", "News"],
        ].map(([id, icon, label]) => (
          <div
            key={id}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              active === id ? "text-[#ddb159]" : "text-white/55"
            }`}
          >
            <StockIcon name={icon as StockIconName} className="size-5" />
            <span>{label}</span>
            {active === id && (
              <span className="absolute inset-x-4 top-0 h-0.5 bg-[#ddb159]" />
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}
