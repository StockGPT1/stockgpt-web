import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.stripe.com https://openrouter.ai https://api.resend.com",
      "frame-src https://*.stripe.com https://stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.stripe.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [
      { source: "/stocks/:ticker", destination: "/stock/:ticker", permanent: true },
      { source: "/cdn-cgi/l/email-protection", destination: "/legal", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/index", destination: "/", permanent: true },
      { source: "/contact", destination: "/legal", permanent: true },
      { source: "/terms", destination: "/legal#terms", permanent: true },
      { source: "/privacy", destination: "/legal#privacy", permanent: true },
      { source: "/cookies", destination: "/legal#cookies", permanent: true },
      { source: "/disclaimer", destination: "/legal#disclaimer", permanent: true },
      { source: "/subscription-terms", destination: "/legal#subscription", permanent: true },
      { source: "/subscriptions", destination: "/pricing", permanent: true },
      { source: "/subscribe", destination: "/pricing", permanent: true },
      { source: "/checkout", destination: "/pricing", permanent: true },
      { source: "/payment", destination: "/pricing", permanent: true },
      { source: "/plans", destination: "/pricing", permanent: true },
      { source: "/learn", destination: "/about", permanent: true },
      { source: "/methodology", destination: "/about", permanent: true },
      { source: "/features", destination: "/about", permanent: true },
      { source: "/alerts", destination: "/notifications", permanent: true },
      { source: "/news", destination: "/world-news", permanent: true },
      { source: "/account", destination: "/settings", permanent: false },
      { source: "/profile", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
