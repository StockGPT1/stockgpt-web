import type { CapacitorConfig } from "@capacitor/cli";

/* iOS app shell: a native WKWebView that renders the live site, so the
   app is always pixel-identical to stockgpt.pro and picks up every web
   deploy instantly — no App Store re-submission needed for UI changes.
   Navigation to hosts outside allowNavigation (e.g. Stripe checkout)
   opens in the system browser instead of inside the shell. */
const config: CapacitorConfig = {
  appId: "pro.stockgpt.app",
  appName: "StockGPT",
  webDir: "capacitor-fallback",
  server: {
    /* open straight into the product (middleware redirects signed-out
       users to /login) — app users never need the marketing landing */
    url: "https://stockgpt.pro/dashboard",
    errorPath: "error.html",
    cleartext: false,
    allowNavigation: ["www.stockgpt.pro", "*.supabase.co"],
  },
  ios: {
    /* the site handles notches itself via viewport-fit=cover + env() */
    contentInset: "never",
    backgroundColor: "#04180f",
    /* lets the site detect it is running inside the app shell */
    appendUserAgent: "StockGPTApp/1.0",
  },
};

export default config;
