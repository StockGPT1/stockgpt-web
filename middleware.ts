import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const redirects: Record<string, string> = {
  "/home": "/",
  "/index": "/",
  "/contact": "/legal",
  "/terms": "/legal#terms",
  "/privacy": "/legal#privacy",
  "/cookies": "/legal#cookies",
  "/disclaimer": "/legal#disclaimer",
  "/subscription-terms": "/legal#subscription",
  "/subscriptions": "/pricing",
  "/subscribe": "/pricing",
  "/checkout": "/pricing",
  "/payment": "/pricing",
  "/plans": "/pricing",
  "/learn": "/about",
  "/methodology": "/about",
  "/features": "/about",
  "/alerts": "/notifications",
  "/news": "/world-news",
  "/account": "/settings",
  "/profile": "/settings",
  "/cdn-cgi/l/email-protection": "/legal",
};

const sessionRoutePrefixes = [
  "/ask-stockgpt",
  "/dashboard",
  "/notifications",
  "/portfolio",
  "/pricing",
  "/rankings",
  "/settings",
  "/stock",
  "/watchlist",
  "/world-news",
];

const exactSessionRoutes = new Set([
  "/auth/callback",
  "/update-password",
]);

function needsSessionRefresh(pathname: string) {
  if (exactSessionRoutes.has(pathname)) return true;
  return sessionRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isRouterPrefetch(request: NextRequest) {
  const purpose = request.headers.get("purpose") ?? request.headers.get("sec-purpose") ?? "";
  return (
    request.headers.get("next-router-prefetch") === "1" ||
    purpose.toLowerCase().includes("prefetch") ||
    request.nextUrl.searchParams.has("_rsc")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/stocks/")) {
    const ticker = pathname.replace("/stocks/", "");
    const url = request.nextUrl.clone();
    url.pathname = `/stock/${ticker}`;
    return NextResponse.redirect(url, 301);
  }

  if (pathname.startsWith("/stock/") && isRouterPrefetch(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "X-StockGPT-Prefetch": "blocked",
      },
    });
  }

  const destination = redirects[pathname];
  if (destination) {
    const url = request.nextUrl.clone();
    const [path, hash] = destination.split("#");
    url.pathname = path;
    url.hash = hash ? `#${hash}` : "";
    return NextResponse.redirect(url, pathname === "/account" || pathname === "/profile" ? 302 : 301);
  }

  if (!needsSessionRefresh(pathname)) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
