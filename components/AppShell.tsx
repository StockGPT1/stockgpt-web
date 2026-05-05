import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SearchBar } from "@/components/SearchBar";
import { MobileNav } from "@/components/MobileNav";
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

// Bottom nav on mobile — show 5 most important
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
      {/* HEADER */}
      <header className="flex h-[64px] shrink-0 items-center gap-2 border-b border-[#ddb159]/18 bg-[#04180f] px-3 sm:h-[68px] sm:px-5">
        {/* Mobile menu button */}
        <div className="relative lg:hidden">
          <MobileNav navItems={navItems} activePath={activePath} unreadCount={unreadCount} />
        </div>

        <Link href="/" className="relative h-[44px] w-[150px] shrink-0 sm:h-[54px] sm:w-[210px]">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-left"
            sizes="(max-width: 640px) 150px, 210px"
          />
        </Link>

        {/* Search — hidden on tiny screens, full on tablet+ */}
        <div className="hidden flex-1 sm:flex">
          <SearchBar />
        </div>

        {/* Notification bell — desktop only (mobile has it in bottom nav) */}
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative ml-auto hidden size-10 shrink-0 place-items-center rounded-full border border-[#ddb159] text-[#ddb159] transition hover:bg-[#ddb159]/10 sm:grid sm:size-11"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159] text-[#ddb159] transition hover:bg-[#ddb159]/10 sm:ml-2 sm:size-11"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </Link>
      </header>

      {/* Mobile-only search bar (when header search is hidden) */}
      <div className="shrink-0 border-b border-[#ddb159]/18 bg-[#04180f] px-3 py-2 sm:hidden">
        <SearchBar />
      </div>

      {/* MAIN BODY */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden h-full w-[190px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] px-4 py-5 lg:block">
          <nav className="space-y-2.5">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              const isAlerts = item.href === "/notifications";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "relative flex h-11 items-center gap-3 rounded-xl border px-3 text-[13px] font-bold transition",
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]"
                      : "border-transparent text-[#faf6f0]/82 hover:border-[#ddb159]/40 hover:bg-[#ddb159]/8",
                  ].join(" ")}
                >
                  <span className="w-5 text-center text-lg text-[#ddb159]">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {isAlerts && unreadCount > 0 && (
                    <span
                      className={`ml-auto grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-black ${
                        unreadCount > 0 ? "bg-red-500 text-white" : "bg-[#ddb159] text-[#072116]"
                      }`}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <section className="min-h-0 flex-1 overflow-hidden bg-[#072116] p-3 pb-[72px] sm:p-4 lg:pb-4">
          {children}
        </section>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[64px] shrink-0 items-stretch border-t border-[#ddb159]/20 bg-[#04180f] lg:hidden">
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
