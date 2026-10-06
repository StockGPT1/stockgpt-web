"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StockIcon, type StockIconName } from "@/components/StockIcon";
import { useAppChrome } from "@/components/AppChromeProvider";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: "dashboard" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/notifications", label: "Alerts", icon: "alerts" },
] as const;

const moreItems = [
  {
    href: "/watchlist",
    label: "Watchlist",
    description: "Stocks you're tracking",
    icon: "watchlist",
  },
  {
    href: "/world-news",
    label: "World News",
    description: "Market-moving stories and ticker impact",
    icon: "news",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Account, preferences and subscription",
    icon: "settings",
  },
] as const;

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeDestination(pathname: string) {
  if (pathname.startsWith("/stock/") || pathname.startsWith("/compare")) return "";

  const primary = primaryItems.find((item) => isPathActive(pathname, item.href));
  if (primary) return primary.href;

  if (moreItems.some((item) => isPathActive(pathname, item.href))) return "more";
  return "";
}

function MoreIcon({ className = "size-[19px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function MobileBottomNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { focusedFlowCount, keyboardOpen } = useAppChrome();
  const [moreOpen, setMoreOpen] = useState(false);
  const focusedPath =
    pathname.startsWith("/ask-stockgpt") ||
    pathname.startsWith("/compare") ||
    pathname.includes("/fullscreen");
  const hidden = focusedPath || focusedFlowCount > 0 || keyboardOpen;
  const current = activeDestination(pathname);
  const [visualCurrent, setVisualCurrent] = useState(current);
  const visualDestination = moreOpen ? "more" : visualCurrent;
  const primaryBubbleIndex = primaryItems.findIndex(
    (item) => item.href === visualDestination,
  );
  const bubbleIndex =
    visualDestination === "more" ? 4 : primaryBubbleIndex >= 0 ? primaryBubbleIndex : -1;

  useEffect(() => {
    setVisualCurrent(current);
    setMoreOpen(false);
  }, [current, pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const item of [...primaryItems, ...moreItems]) {
        if (!isPathActive(pathname, item.href)) router.prefetch(item.href);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    if (!hidden) return;
    setMoreOpen(false);
    setVisualCurrent(current);
  }, [current, hidden]);

  function closeMore() {
    setMoreOpen(false);
    setVisualCurrent(current);
  }

  function toggleMore() {
    if (moreOpen) {
      closeMore();
      return;
    }
    setVisualCurrent("more");
    setMoreOpen(true);
  }

  useEffect(() => {
    if (!moreOpen) return;

    const appContent = document.querySelector<HTMLElement>(".sg-app-content");
    const previousOverflow = appContent?.style.overflow ?? "";

    if (appContent) appContent.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      setVisualCurrent(current);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (appContent) appContent.style.overflow = previousOverflow;
    };
  }, [current, moreOpen]);

  return (
    <>
      {moreOpen && !hidden && (
        <div className="fixed inset-0 z-[45] lg:hidden" role="dialog" aria-modal="true" aria-label="More StockGPT sections">
          <button
            type="button"
            aria-label="Close more menu"
            onClick={closeMore}
            className="absolute inset-0 bg-[#010604]/65 backdrop-blur-[2px]"
          />

          <section className="sg-mobile-more-sheet absolute inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] mx-auto max-w-[430px] overflow-hidden rounded-[28px] border p-2 shadow-[0_28px_80px_rgba(0,0,0,0.54)] backdrop-blur-2xl">
            <div className="mx-auto mb-1 mt-1 h-1 w-10 rounded-full bg-[#faf6f0]/18" />
            <div className="flex items-center justify-between px-3 pb-2 pt-1">
              <div>
                <p className="text-[17px] font-black tracking-[-0.02em] text-[#faf6f0]">More</p>
                <p className="mt-0.5 text-[11px] text-[#faf6f0]/48">Everything else from StockGPT</p>
              </div>
              <button
                type="button"
                onClick={closeMore}
                aria-label="Close more menu"
                className="grid size-11 place-items-center rounded-full bg-[#faf6f0]/6 text-[#faf6f0]/72 transition active:scale-95"
              >
                <StockIcon name="close" className="size-5" />
              </button>
            </div>

            <div className="space-y-1 pb-1">
              {moreItems.map((item) => {
                const active = isPathActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onPointerDown={() => setVisualCurrent("more")}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex min-h-[62px] items-center gap-3 rounded-[20px] px-3 transition active:scale-[0.985]",
                      active
                        ? "bg-[#ddb159]/14 text-[#ddb159]"
                        : "text-[#faf6f0] hover:bg-[#faf6f0]/6",
                    ].join(" ")}
                  >
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#faf6f0]/6 text-[#ddb159]">
                      <StockIcon name={item.icon as StockIconName} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[10.5px] font-medium text-[#faf6f0]/48">
                        {item.description}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-[18px] text-[#ddb159]/70">›</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        aria-label="Primary mobile navigation"
        aria-hidden={hidden}
        data-hidden={hidden ? "true" : "false"}
        className="sg-bottom-nav fixed left-1/2 z-30 h-[66px] w-[calc(100%_-_42px)] max-w-[380px] -translate-x-1/2 rounded-full border p-1.5 backdrop-blur-xl transition duration-200 data-[hidden=true]:pointer-events-none data-[hidden=true]:translate-y-[calc(100%+32px)] data-[hidden=true]:opacity-0 lg:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        <div className="relative grid h-full w-full grid-cols-5 items-center">
          <span
            aria-hidden="true"
            data-visible={bubbleIndex >= 0 ? "true" : "false"}
            className="sg-mobile-nav-bubble pointer-events-none absolute inset-y-0 left-0 z-0 w-1/5 rounded-full"
            style={{
              transform: `translateX(${Math.max(0, bubbleIndex) * 100}%)`,
            }}
          />
          {primaryItems.map((item) => {
          const isActive = current === item.href;
          const isVisualActive = visualDestination === item.href;
          const isAlerts = item.href === "/notifications";

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              tabIndex={hidden ? -1 : undefined}
              data-active={isVisualActive ? "true" : "false"}
              onPointerDown={() => setVisualCurrent(item.href)}
              className={[
                "sg-mobile-nav-link relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-full px-1 text-[#fffaf2]/66 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f2c35f]",
                isVisualActive
                  ? "text-[#fffaf2]"
                  : "hover:text-[#fffaf2]",
              ].join(" ")}
            >
              <span className="relative">
                <StockIcon name={item.icon as StockIconName} className="sg-mobile-nav-icon size-[19px] shrink-0" />
                {isAlerts && unreadCount > 0 && (
                  <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#b9504d] px-1 text-[8px] font-black text-white ring-2 ring-[#04180f]">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="sg-mobile-nav-label max-w-full truncate text-[9.5px] font-extrabold leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onPointerDown={() => setVisualCurrent("more")}
          onClick={toggleMore}
          aria-label="More"
          aria-expanded={moreOpen}
          tabIndex={hidden ? -1 : undefined}
          data-active={visualDestination === "more" ? "true" : "false"}
          className={[
            "sg-mobile-nav-link relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-full px-1 text-[#fffaf2]/66 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f2c35f]",
            visualDestination === "more"
              ? "text-[#fffaf2]"
              : "hover:text-[#fffaf2]",
          ].join(" ")}
        >
          <MoreIcon />
          <span className="sg-mobile-nav-label text-[9.5px] font-extrabold leading-none">More</span>

        </button>
        </div>
      </nav>
    </>
  );
}
