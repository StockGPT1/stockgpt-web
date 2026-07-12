"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StockIcon } from "@/components/StockIcon";
import { useAppChrome } from "@/components/AppChromeProvider";

function pageTitle(pathname: string) {
  if (pathname.startsWith("/stock/")) {
    return decodeURIComponent(pathname.split("/")[2] ?? "Stock").toUpperCase();
  }
  if (pathname.startsWith("/compare")) return "Compare";
  if (pathname.startsWith("/rankings")) return "Rankings";
  if (pathname.startsWith("/portfolio")) return "Portfolio";
  if (pathname.startsWith("/notifications")) return "Alerts";
  if (pathname.startsWith("/world-news")) return "World News";
  if (pathname.startsWith("/watchlist")) return "Watchlist";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/ask")) return "Ask StockGPT";
  return "";
}

function routeKey(pathname: string) {
  if (pathname.startsWith("/stock/")) return "stock";
  if (pathname.startsWith("/compare")) return "compare";
  if (pathname.startsWith("/rankings")) return "rankings";
  if (pathname.startsWith("/portfolio")) return "portfolio";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/world-news")) return "world-news";
  if (pathname.startsWith("/watchlist")) return "watchlist";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/ask")) return "ask";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "other";
}

function HeaderButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: "search" | "dashboard";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
    >
      <StockIcon name={icon} className="size-5" />
    </button>
  );
}

export function MobileAppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { openSearch } = useAppChrome();
  const title = pageTitle(pathname);
  const isDashboard = pathname === "/dashboard";
  const isDetailPage = pathname.startsWith("/stock/") || pathname.startsWith("/compare");
  const isSettings = pathname.startsWith("/settings");

  useEffect(() => {
    document.body.dataset.sgPath = routeKey(pathname);
    return () => {
      delete document.body.dataset.sgPath;
    };
  }, [pathname]);

  if (isDashboard) {
    return (
      <header className="sg-mobile-app-header relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-[#ddb159]/14 bg-[#04180f] pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] lg:hidden">
        <Link href="/dashboard" aria-label="StockGPT home" className="relative h-10 w-[118px] shrink-0">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-left"
            sizes="118px"
          />
        </Link>

        <span className="min-w-0 flex-1" />

        <HeaderButton label="Search StockGPT" onClick={openSearch} icon="search" />

        <Link
          href="/settings"
          prefetch={false}
          aria-label="Account settings"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/28 text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
        >
          <StockIcon name="settings" className="size-5" />
        </Link>
      </header>
    );
  }

  return (
    <header className="sg-mobile-app-header relative z-40 grid h-14 shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-[#ddb159]/14 bg-[#04180f] pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] lg:hidden">
      {isDetailPage ? (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="grid size-11 place-items-center rounded-full text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
        >
          <span aria-hidden="true" className="text-[22px] leading-none">←</span>
        </button>
      ) : (
        <HeaderButton label="Search StockGPT" onClick={openSearch} icon="search" />
      )}

      <p className="min-w-0 truncate px-2 text-center font-sans text-[21px] font-extrabold leading-none tracking-[-0.025em] text-[#faf6f0]">
        {title}
      </p>

      {isDetailPage ? (
        <HeaderButton label="Search StockGPT" onClick={openSearch} icon="search" />
      ) : isSettings ? (
        <Link
          href="/dashboard"
          prefetch={false}
          aria-label="Go to dashboard"
          className="grid size-11 place-items-center rounded-full text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
        >
          <StockIcon name="dashboard" className="size-5" />
        </Link>
      ) : (
        <Link
          href="/settings"
          prefetch={false}
          aria-label="Account settings"
          className="grid size-11 place-items-center rounded-full border border-[#ddb159]/28 text-[#ddb159] transition-colors hover:bg-[#ddb159]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
        >
          <StockIcon name="settings" className="size-5" />
        </Link>
      )}
    </header>
  );
}
