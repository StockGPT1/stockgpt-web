"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StockIcon } from "@/components/StockIcon";
import { useAppChrome } from "@/components/AppChromeProvider";

function pageTitle(pathname: string) {
  if (pathname.startsWith("/stock/")) return decodeURIComponent(pathname.split("/")[2] ?? "Stock").toUpperCase();
  if (pathname.startsWith("/rankings")) return "Rankings";
  if (pathname.startsWith("/portfolio")) return "Portfolio";
  if (pathname.startsWith("/notifications")) return "Alerts";
  if (pathname.startsWith("/world-news")) return "News";
  if (pathname.startsWith("/watchlist")) return "Watchlist";
  if (pathname.startsWith("/settings")) return "Settings";
  return "";
}

export function MobileAppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { openSearch } = useAppChrome();
  const title = pageTitle(pathname);
  const isDashboard = pathname === "/dashboard";
  const canGoBack = pathname.startsWith("/stock/") || pathname.startsWith("/compare");

  return (
    <header className="sg-mobile-app-header relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-[#ddb159]/14 bg-[#04180f] px-3 lg:hidden">
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="grid size-11 shrink-0 place-items-center rounded-full text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
        >
          <span aria-hidden="true" className="text-xl">&larr;</span>
        </button>
      ) : (
        <Link href="/dashboard" aria-label="StockGPT home" className="relative h-10 w-[118px] shrink-0">
          <Image src="/logo.png" alt="StockGPT" fill priority className="object-contain object-left" sizes="118px" />
        </Link>
      )}

      {!isDashboard && title && (
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-black tracking-[-0.02em] text-[#faf6f0]">
          {title}
        </p>
      )}
      {isDashboard && <span className="flex-1" />}

      <button
        type="button"
        onClick={openSearch}
        aria-label="Search StockGPT"
        className="grid size-11 shrink-0 place-items-center rounded-full text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
      >
        <StockIcon name="search" className="size-5" />
      </button>
      <Link
        href="/settings"
        prefetch={false}
        aria-label="Account settings"
        className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/28 text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
      >
        <StockIcon name="settings" className="size-5" />
      </Link>
    </header>
  );
}
