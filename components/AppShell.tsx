import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/rankings", label: "Rankings", icon: "♛" },
  { href: "/watchlist", label: "Watchlist", icon: "☆" },
  { href: "/world-news", label: "World News", icon: "✦" },
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/account", label: "Account", icon: "◎" },
] as const;

export function AppShell({
  children,
  activePath,
}: {
  children: ReactNode;
  activePath: string;
}) {
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

        <form
          action="/rankings"
          method="get"
          className="mx-auto flex h-10 w-full max-w-[520px] items-center rounded-full border border-[#ddb159]/30 bg-[#072116] px-5"
        >
          <input
            name="search"
            type="search"
            placeholder="Search stocks..."
            className="h-full flex-1 bg-transparent text-sm text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/50"
          />

          <button
            type="submit"
            aria-label="Search stocks"
            className="ml-3 grid size-8 place-items-center rounded-full text-[#ddb159] transition hover:bg-[#ddb159]/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>

        <Link
          href="/account"
          aria-label="Account"
          className="ml-5 grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159] text-[#ddb159] transition hover:bg-[#ddb159]/10"
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex h-11 items-center gap-3 rounded-xl border px-3 text-[13px] font-bold transition",
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]"
                      : "border-transparent text-[#faf6f0]/82 hover:border-[#ddb159]/40 hover:bg-[#ddb159]/8",
                  ].join(" ")}
                >
                  <span className="w-5 text-center text-lg text-[#ddb159]">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
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