import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
