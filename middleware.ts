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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/stocks/")) {
    const ticker = pathname.replace("/stocks/", "");
    const url = request.nextUrl.clone();
    url.pathname = `/stock/${ticker}`;
    return NextResponse.redirect(url, 301);
  }

  const destination = redirects[pathname];
  if (destination) {
    const url = request.nextUrl.clone();
    const [path, hash] = destination.split("#");
    url.pathname = path;
    url.hash = hash ? `#${hash}` : "";
    return NextResponse.redirect(url, pathname === "/account" || pathname === "/profile" ? 302 : 301);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
