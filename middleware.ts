import { NextResponse, NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Redirects are defined once in next.config.ts (redirects()).
// Do not add redirect logic here — next.config.ts is processed first
// and handles all path redirects including hash-fragment destinations.

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

/**
 * Generate a cryptographically random nonce for use in the Content-Security-Policy
 * script-src directive. This replaces the previous 'unsafe-inline' + 'unsafe-eval'
 * flags, which defeated XSS protection entirely.
 *
 * The nonce is forwarded via the x-nonce response header so server components
 * can read it via headers() and apply it to any inline <script> tags.
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/stocks/")) {
    const ticker = pathname.replace("/stocks/", "");
    const url = request.nextUrl.clone();
    url.pathname = `/stock/${ticker}`;
    return NextResponse.redirect(url, 301);
  }

  // Previously we blocked all /stock/* prefetches to avoid triggering
  // session refresh on every hover. Now that /stock/[ticker]/loading.tsx
  // exists, prefetches are safe — Next.js will show the skeleton instantly
  // while the page renders, so we let them through.

  const nonce = generateNonce();

  // Forward nonce to server components via request header.
  // We clone the request with the extra header so updateSession
  // receives a proper NextRequest (not a plain Request).
  const requestWithNonce = new NextRequest(request, {
    headers: { ...Object.fromEntries(request.headers), "x-nonce": nonce },
  });

  if (!needsSessionRefresh(pathname)) {
    const response = NextResponse.next({ request: { headers: requestWithNonce.headers } });
    response.headers.set("x-nonce", nonce);
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    if (csp) response.headers.set("Content-Security-Policy", csp.replace("NONCE_PLACEHOLDER", nonce));
    return response;
  }

  const response = await updateSession(requestWithNonce);

  // Patch the nonce into the CSP header on the session-refreshed response
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  if (csp) {
    response.headers.set("Content-Security-Policy", csp.replace("NONCE_PLACEHOLDER", nonce));
  }
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
