import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SearchBar } from "@/components/SearchBar";
import { MobileNav } from "@/components/MobileNav";
import { TickerTape } from "@/components/TickerTape";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { getUnreadNotificationCount } from "@/lib/notifications";

const navItems = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/rankings", label: "Rankings", icon: "♛" },
  { href: "/portfolio", label: "Portfolio", icon: "✦" },
  { href: "/watchlist", label: "Watchlist", icon: "☆" },
  { href: "/notifications", label: "Alerts", icon: "◐" },
  { href: "/world-news", label: "World News", icon: "◈" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

const mobileBottomNav = [
  { href: "/", label: "Home", icon: "▦" },
  { href: "/rankings", label: "Rankings", icon: "♛" },
  { href: "/portfolio", label: "Portfolio", icon: "✦" },
  { href: "/notifications", label: "Alerts", icon: "◐" },
  { href: "/world-news", label: "News", icon: "◈" },
] as const;

export async function AppShell({
  children,
  activePath,
}: {
  children: ReactNode;
  activePath: string;
}) {
  const unreadCount = await getUnreadNotificationCount();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <header className="relative z-40 flex h-[64px] shrink-0 items-center gap-2 border-b border-[#ddb159]/18 bg-[#04180f] px-3 shadow-[0_8px_28px_rgba(0,0,0,0.24)] sm:px-5">
        <div className="relative lg:hidden">
          <MobileNav
            navItems={navItems}
            activePath={activePath}
            unreadCount={unreadCount}
          />
        </div>

        <Link
          href="/"
          className="relative h-[46px] w-[150px] shrink-0 transition duration-300 hover:scale-[1.015] sm:h-[52px] sm:w-[205px]"
        >
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-left drop-shadow-[0_6px_14px_rgba(221,177,89,0.12)]"
            sizes="(max-width: 640px) 150px, 205px"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 sm:flex">
          <SearchBar />
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          <AskStockGPTButton />

          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-[#f2d27a] hover:bg-[#ddb159]/10 hover:shadow-[0_0_24px_rgba(221,177,89,0.14)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21h4" />
            </svg>

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-[#04180f]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          <Link
            href="/settings"
            aria-label="Account settings"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-[#f2d27a] hover:bg-[#ddb159]/10 hover:shadow-[0_0_24px_rgba(221,177,89,0.14)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </Link>
        </div>

        <Link
          href="/settings"
          aria-label="Account settings"
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:bg-[#ddb159]/10 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </Link>
      </header>

      <TickerTape />

      <div className="shrink-0 border-b border-[#ddb159]/18 bg-[#04180f] px-3 py-2 sm:hidden">
        <SearchBar />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[178px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] px-3 py-4 lg:block">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              const isAlerts = item.href === "/notifications";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group relative flex h-10 items-center gap-2.5 overflow-hidden rounded-xl border px-3 text-[12px] font-bold transition duration-300",
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0] shadow-[0_0_22px_rgba(221,177,89,0.08)]"
                      : "border-transparent text-[#faf6f0]/78 hover:-translate-y-0.5 hover:border-[#ddb159]/45 hover:bg-[#ddb159]/8 hover:text-[#faf6f0]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-[#ddb159] transition",
                      isActive
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-70",
                    ].join(" ")}
                  />

                  <span className="w-5 text-center text-base text-[#ddb159] transition duration-300 group-hover:scale-110">
                    {item.icon}
                  </span>

                  <span className="truncate">{item.label}</span>

                  {isAlerts && unreadCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(221,177,89,0.08),transparent_28%),linear-gradient(180deg,#072116,#051a11)] p-3 pb-[72px] sm:p-3 lg:pb-3">
          {children}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[64px] shrink-0 items-stretch border-t border-[#ddb159]/20 bg-[#04180f] shadow-[0_-10px_24px_rgba(0,0,0,0.28)] lg:hidden">
        {mobileBottomNav.map((item) => {
          const isActive = activePath === item.href;
          const isAlerts = item.href === "/notifications";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
                isActive ? "text-[#ddb159]" : "text-[#faf6f0]/55"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-bold">{item.label}</span>

              {isAlerts && unreadCount > 0 && (
                <span className="absolute right-2 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}

              {isActive && (
                <span className="absolute inset-x-4 top-0 h-[2px] bg-[#ddb159]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
