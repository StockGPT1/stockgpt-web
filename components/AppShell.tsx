import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SearchBar } from "@/components/SearchBar";
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

export async function AppShell({
  children,
  activePath,
}: {
  children: ReactNode;
  activePath: string;
}) {
  // ✦ Fetch unread count for the badge (no-op for logged-out users)
  const unreadCount = await getUnreadNotificationCount();
  const hasCritical = unreadCount > 0; // The page itself shows severity breakdown

  return (
    <div className="h-screen overflow-hidden bg-[#072116] text-[#faf6f0]">
      <header className="flex h-[68px] items-center border-b border-[#ddb159]/18 bg-[#04180f] px-5">
        <Link href="/" className="relative h-[54px] w-[210px] shrink-0">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-left"
            sizes="210px"
          />
        </Link>

        <SearchBar />

        {/* Notification bell in header */}
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative ml-3 grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159] text-[#ddb159] transition hover:bg-[#ddb159]/10"
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
          className="ml-2 grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159] text-[#ddb159] transition hover:bg-[#ddb159]/10"
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

      <div className="grid h-[calc(100vh-68px)] grid-cols-[190px_minmax(0,1fr)] overflow-hidden">
        <aside className="h-full border-r border-[#ddb159]/16 bg-[#061b12] px-4 py-5">
          <nav className="space-y-2.5">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              const isAlerts = item.href === "/notifications";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "relative flex h-11 items-center gap-3 rounded-xl border px-3 text-[13px] transition",
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]"
                      : "border-transparent text-[#faf6f0]/82 hover:border-[#ddb159]/40 hover:bg-[#ddb159]/8",
                  ].join(" ")}
                >
                  <span className="w-5 text-center text-lg text-[#ddb159]">
                    {item.icon}
                  </span>
                  <span className="luxury-nav truncate">{item.label}</span>
                  {/* ✦ Badge in sidebar for unread alerts */}
                  {isAlerts && unreadCount > 0 && (
                    <span
                      className={`ml-auto grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-black ${hasCritical ? "bg-red-500 text-white" : "bg-[#ddb159] text-[#072116]"}`}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-h-0 overflow-hidden bg-[#072116] p-4">
          {children}
        </section>
      </div>
    </div>
  );
}
