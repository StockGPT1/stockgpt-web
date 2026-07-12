"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StockIcon, type StockIconName } from "@/components/StockIcon";
import { useAppChrome } from "@/components/AppChromeProvider";

const items = [
  { href: "/dashboard", label: "Home", icon: "dashboard" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/notifications", label: "Alerts", icon: "alerts" },
  { href: "/world-news", label: "News", icon: "news" },
] as const;

function activeHref(pathname: string) {
  if (pathname.startsWith("/stock/") || pathname.startsWith("/compare")) return "";
  return items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    ?.href;
}

export function MobileBottomNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const { focusedFlowCount, keyboardOpen } = useAppChrome();
  const focusedPath =
    pathname.startsWith("/ask-stockgpt") ||
    pathname.startsWith("/compare") ||
    pathname.includes("/fullscreen");
  const hidden = focusedPath || focusedFlowCount > 0 || keyboardOpen;
  const current = activeHref(pathname);

  return (
    <nav
      aria-label="Primary mobile navigation"
      aria-hidden={hidden}
      data-hidden={hidden ? "true" : "false"}
      className="sg-bottom-nav fixed left-[clamp(12px,5.5vw,24px)] right-[clamp(12px,5.5vw,24px)] z-30 mx-auto flex h-[68px] max-w-[430px] items-center justify-between gap-1 rounded-[26px] border border-[#ddb159]/28 bg-[#04180f]/96 px-2 shadow-[0_16px_45px_rgba(0,0,0,0.5),0_0_0_1px_rgba(221,177,89,0.05)] backdrop-blur-md transition duration-200 data-[hidden=true]:pointer-events-none data-[hidden=true]:translate-y-[calc(100%+32px)] data-[hidden=true]:opacity-0 lg:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      {items.map((item) => {
        const isActive = current === item.href;
        const isAlerts = item.href === "/notifications";

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            tabIndex={hidden ? -1 : undefined}
            data-active={isActive ? "true" : "false"}
            className={[
              "sg-mobile-nav-link relative flex h-12 min-w-11 items-center justify-center rounded-full text-[#faf6f0]/62 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddb159]",
              isActive
                ? "w-[104px] max-w-[30vw] gap-1.5 bg-[#ddb159] px-3 text-[#061b12]"
                : "w-11 hover:bg-[#faf6f0]/7 hover:text-[#faf6f0] max-[340px]:w-10 max-[340px]:min-w-10",
            ].join(" ")}
          >
            <StockIcon name={item.icon as StockIconName} className="size-[19px] shrink-0" />
            <span className={isActive ? "truncate text-[11px] font-black" : "sr-only"}>
              {item.label}
            </span>
            {isAlerts && unreadCount > 0 && (
              <span className="absolute -right-0.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#b9504d] px-1 text-[9px] font-black text-white ring-2 ring-[#04180f]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
