import type { CapacitorConfig } from "@capacitor/cli";

/* iOS app shell: a native WKWebView that renders StockGPT, so the app keeps
   the same product, auth and ranking data as the web app. Release builds use
   the live site. For Xcode development, CAPACITOR_SERVER_URL can point the
   shell at a local or preview deployment without editing this file. */
const productionServerUrl = "https://stockgpt.pro/dashboard";
const configuredServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const serverUrl = configuredServerUrl || productionServerUrl;
const isCleartextDevelopmentServer = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "pro.stockgpt.app",
  appName: "StockGPT",
  webDir: "capacitor-fallback",
  server: {
    /* Signed-out users are redirected to /login by the product. A debug URL
       can be supplied when running `npx cap sync ios`; production remains the
       default when the environment variable is absent. */
    url: serverUrl,
    errorPath: "error.html",
    cleartext: isCleartextDevelopmentServer,
    allowNavigation: ["stockgpt.pro", "www.stockgpt.pro", "*.supabase.co"],
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
