import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SearchBar } from "@/components/SearchBar";
import { TickerTape } from "@/components/TickerTape";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { PremiumInteractionEffects } from "@/components/PremiumInteractionEffects";
import { NavigationWarmup } from "@/components/NavigationWarmup";
import { getUnreadNotificationCountFast } from "@/lib/notification-summary";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/utils/supabase/server";
import { AppLegalDisclaimer } from "@/components/AppLegalDisclaimer";
import { StockIcon, type StockIconName } from "@/components/StockIcon";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/watchlist", label: "Watchlist", icon: "watchlist" },
  { href: "/notifications", label: "Alerts", icon: "alerts" },
  { href: "/world-news", label: "World News", icon: "news" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

const mobileBottomNav = [
  { href: "/dashboard", label: "Home", icon: "dashboard" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/notifications", label: "Alerts", icon: "alerts" },
  { href: "/world-news", label: "News", icon: "news" },
] as const;

function PageBackdrop({ activePath }: { activePath: string }) {
  if (activePath === "/dashboard") return null;

  const variant =
    activePath === "/rankings"
      ? "rankings"
      : activePath === "/portfolio"
        ? "portfolio"
        : activePath === "/watchlist"
          ? "watchlist"
          : activePath === "/notifications"
            ? "alerts"
            : activePath === "/world-news"
              ? "news"
              : activePath === "/settings"
                ? "settings"
                : "default";

  return (
    <div className="sg-page-backdrop pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(221,177,89,0.065),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(250,246,240,0.035),transparent_26%)]" />

      {variant === "rankings" && (
        <>
          <div className="absolute right-[-8%] top-[8%] h-[320px] w-[620px] rounded-full border border-[#ddb159]/10 bg-[linear-gradient(135deg,rgba(221,177,89,0.08),transparent_55%)] blur-[1px]" />
          <svg
            className="absolute right-[4%] top-[10%] h-[230px] w-[520px] opacity-[0.13]"
            viewBox="0 0 520 230"
            fill="none"
          >
            <path
              d="M8 190 C70 150 105 166 155 118 C215 60 245 98 305 72 C372 43 415 58 512 18"
              stroke="#ddb159"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M8 190 C70 150 105 166 155 118 C215 60 245 98 305 72 C372 43 415 58 512 18"
              stroke="#faf6f0"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
        </>
      )}

      {variant === "portfolio" && (
        <>
          <div className="absolute bottom-[-18%] right-[3%] h-[420px] w-[420px] rounded-full border border-[#ddb159]/10 bg-[#ddb159]/[0.045] blur-[2px]" />
          <div className="absolute right-[9%] top-[16%] grid h-[180px] w-[230px] grid-cols-5 items-end gap-3 opacity-[0.09]">
            <span className="h-[42%] rounded-t bg-[#ddb159]" />
            <span className="h-[62%] rounded-t bg-[#ddb159]" />
            <span className="h-[35%] rounded-t bg-[#ddb159]" />
            <span className="h-[78%] rounded-t bg-[#ddb159]" />
            <span className="h-full rounded-t bg-[#ddb159]" />
          </div>
        </>
      )}

      {variant === "watchlist" && (
        <>
          <div className="absolute right-[8%] top-[12%] h-[300px] w-[300px] rounded-full border border-[#ddb159]/12" />
          <div className="absolute right-[15%] top-[21%] text-[#ddb159]/[0.055]">
            <StockIcon name="watchlist" className="size-[190px]" />
          </div>
        </>
      )}

      {variant === "alerts" && (
        <>
          <div className="absolute right-[8%] top-[10%] h-[260px] w-[460px] rounded-full bg-red-500/[0.035] blur-2xl" />
          <div className="absolute right-[13%] top-[14%] h-[160px] w-[300px] rounded-[999px] border border-[#ddb159]/10" />
          <div className="absolute right-[18%] top-[24%] h-[10px] w-[10px] rounded-full bg-[#ddb159]/20" />
          <div className="absolute right-[28%] top-[36%] h-[7px] w-[7px] rounded-full bg-[#ddb159]/20" />
        </>
      )}

      {variant === "news" && (
        <>
          <div className="absolute right-[7%] top-[6%] h-[300px] w-[620px] rounded-full bg-[#ddb159]/[0.035] blur-3xl" />
          <div className="absolute left-[20%] top-[14%] h-px w-[62%] bg-gradient-to-r from-transparent via-[#ddb159]/12 to-transparent" />
          <svg
            className="absolute right-[6%] top-[9%] h-[170px] w-[520px] opacity-[0.07]"
            viewBox="0 0 520 170"
            fill="none"
          >
            <path
              d="M4 122 C44 112 70 130 112 104 C150 80 174 90 218 64 C264 36 298 54 344 42 C404 26 448 36 516 12"
              stroke="#ddb159"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M4 146 C60 128 104 140 160 112 C216 84 248 98 304 72 C360 46 406 58 516 34"
              stroke="#faf6f0"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
          <div className="absolute right-[10%] top-[28%] h-[1px] w-[420px] bg-gradient-to-r from-transparent via-[#faf6f0]/8 to-transparent" />
        </>
      )}

      {variant === "settings" && (
        <>
          <div className="absolute right-[10%] top-[13%] h-[260px] w-[260px] rounded-full border border-[#ddb159]/10" />
          <div className="absolute right-[15%] top-[20%] h-[160px] w-[160px] rounded-full border border-[#ddb159]/10" />
          <div className="absolute right-[20%] top-[27%] h-[70px] w-[70px] rounded-full bg-[#ddb159]/[0.055]" />
        </>
      )}

      {variant === "default" && (
        <svg
          className="absolute right-[5%] top-[12%] h-[220px] w-[500px] opacity-[0.1]"
          viewBox="0 0 500 220"
          fill="none"
        >
          <path
            d="M5 185 C86 140 130 172 202 96 C262 34 315 100 374 58 C410 32 448 28 496 16"
            stroke="#ddb159"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

export async function AppShell({
  children,
  activePath,
}: {
  children: ReactNode;
  activePath: string;
}) {
  const supabase = await createClient();

  const [
    unreadCount,
    {
      data: { user },
    },
  ] = await Promise.all([getUnreadNotificationCountFast(), supabase.auth.getUser()]);

  let canUseAskStockGPT = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    canUseAskStockGPT = hasActiveSubscription(profile?.subscription_status);
  }

  return (
    <div className="sg-app-shell flex h-[100dvh] flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <PremiumInteractionEffects />
      <NavigationWarmup />

      <header className="sg-app-header relative z-40 flex h-[64px] shrink-0 items-center gap-2 border-b border-[#ddb159]/18 bg-[#04180f] px-3 shadow-[0_8px_28px_rgba(0,0,0,0.24)] sm:px-5">
        <Link
          href="/dashboard"
          prefetch={false}
          className="sg-no-premium absolute left-1/2 top-1/2 h-[46px] w-[155px] -translate-x-1/2 -translate-y-1/2 transition duration-300 hover:scale-[1.015] md:relative md:left-auto md:top-auto md:h-[52px] md:w-[205px] md:translate-x-0 md:translate-y-0"
        >
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            priority
            className="object-contain object-center drop-shadow-[0_6px_14px_rgba(221,177,89,0.12)] md:object-left"
            sizes="(max-width: 768px) 155px, 205px"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 md:flex">
          <SearchBar showRankingData={!!user} />
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          <AskStockGPTButton
            canUseAskStockGPT={canUseAskStockGPT}
            isAuthenticated={!!user}
          />

          <Link
            href="/notifications"
            prefetch={false}
            aria-label="Notifications"
            className="sg-icon-button relative grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-[#f2d27a] hover:bg-[#ddb159]/10 hover:shadow-[0_0_24px_rgba(221,177,89,0.14)]"
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
            prefetch={false}
            aria-label="Account settings"
            className="sg-icon-button grid size-10 shrink-0 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-[#f2d27a] hover:bg-[#ddb159]/10 hover:shadow-[0_0_24px_rgba(221,177,89,0.14)]"
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
          prefetch={false}
          aria-label="Account settings"
          className="sg-icon-button absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-[#ddb159]/80 text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:bg-[#ddb159]/10 md:hidden"
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

      <div className="sg-mobile-search-row flex shrink-0 items-center gap-2 border-b border-[#ddb159]/18 bg-[#04180f] px-3 py-2 md:hidden">
        <div className="min-w-0 flex-1">
          <SearchBar showRankingData={!!user} />
        </div>

        <div className="shrink-0 [&_button]:h-10 [&_button]:px-3 [&_button]:text-[11px] max-[370px]:[&_button_span:last-child]:hidden max-[370px]:[&_button]:w-10 max-[370px]:[&_button]:justify-center max-[370px]:[&_button]:px-0">
          <AskStockGPTButton
            canUseAskStockGPT={canUseAskStockGPT}
            isAuthenticated={!!user}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="sg-sidebar hidden h-full w-[178px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] px-3 py-4 lg:block">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              const isAlerts = item.href === "/notifications";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  data-active={isActive ? "true" : "false"}
                  className={[
                    "sg-side-nav-link group relative flex h-10 items-center gap-2.5 overflow-hidden rounded-xl border px-3 text-[12px] font-bold transition duration-300",
                    isActive
                      ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0] shadow-[0_0_22px_rgba(221,177,89,0.08)]"
                      : "border-transparent text-[#faf6f0]/78 hover:-translate-y-0.5 hover:border-[#ddb159]/45 hover:bg-[#ddb159]/8 hover:text-[#faf6f0]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-[#ddb159] transition",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70",
                    ].join(" ")}
                  />

                  <span className="w-5 text-center text-base text-[#ddb159] transition duration-300 group-hover:scale-110">
                    <StockIcon name={item.icon as StockIconName} className="size-[18px]" />
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

        <section className="sg-app-content sg-candle-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#072116,#051a11)] p-3 pb-[calc(108px+env(safe-area-inset-bottom))] sm:p-3 lg:overflow-hidden lg:pb-3">
          <PageBackdrop activePath={activePath} />
          <div className="relative z-10 min-h-full lg:h-full lg:min-h-0">
            {children}
            <AppLegalDisclaimer />
          </div>
        </section>
      </div>

      <nav
        aria-label="Primary mobile navigation"
        className="sg-bottom-nav fixed left-3 right-3 z-30 mx-auto flex h-[64px] max-w-[430px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#ddb159]/20 bg-[#04180f]/88 px-2 shadow-[0_18px_55px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(250,246,240,0.06)] backdrop-blur-xl lg:hidden"
        style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {mobileBottomNav.map((item) => {
          const isActive = activePath === item.href;
          const isAlerts = item.href === "/notifications";

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-label={item.label}
              data-active={isActive ? "true" : "false"}
              className={[
                "sg-mobile-nav-link relative flex h-12 min-w-0 items-center justify-center rounded-full text-[#faf6f0]/62 motion-safe:transition-all motion-safe:duration-300",
                isActive
                  ? "flex-[1.35] gap-2 bg-[#ddb159] px-3 text-[#061b12] shadow-[0_10px_24px_rgba(221,177,89,0.26)]"
                  : "w-11 flex-none hover:bg-[#faf6f0]/7 hover:text-[#faf6f0] max-[340px]:w-10",
              ].join(" ")}
            >
              <StockIcon
                name={item.icon as StockIconName}
                className={isActive ? "size-[18px]" : "size-5"}
              />
              <span
                className={
                  isActive
                    ? "max-w-[76px] truncate text-[11px] font-black"
                    : "sr-only"
                }
              >
                {item.label}
              </span>

              {isAlerts && unreadCount > 0 && (
                <span className="absolute -right-0.5 top-0 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-[#04180f]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
