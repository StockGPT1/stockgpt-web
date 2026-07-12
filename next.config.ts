import type { NextConfig } from "next";

/** Static security headers. Per-request CSP headers are set in middleware.ts. */
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

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/portfolio",
          destination: "/portfolio/modern",
        },
      ],
    };
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
      { source: "/affiliate-terms", destination: "/legal#affiliate-terms", permanent: true },
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
