# StockGPT iPhone app

StockGPT for iPhone is a **Capacitor 8 app shell** around the same StockGPT product used on the web. The shell is native iOS/WKWebView, while the authenticated product, Supabase data and ranking output remain shared with `stockgpt.pro`.

That architecture is deliberate: the iPhone app does not contain a second copy of the ranking engine. `stockgpt-ranking` continues to calculate/update the data used by the web product, and the app consumes that same product/data. There is one source of truth for rankings, portfolios, alerts and account state.

Inside the iOS shell the site switches to app-specific chrome: iPhone safe areas, compact top bars, a native-style bottom tab bar, and a **More** sheet for Alerts, World News and Settings. Mobile Safari keeps the normal mobile-web treatment.

## What's in the repo

| Path | Purpose |
| --- | --- |
| `capacitor.config.ts` | App identity, production URL and optional development-server override |
| `ios/` | Xcode project (Capacitor 8 + Swift Package Manager; no CocoaPods) |
| `capacitor-fallback/` | Branded loading/offline/error assets bundled with the app |
| `components/AppShellMode.tsx` | Tags `<html data-app-shell>` when the site runs inside the app |
| `components/MobileAppHeader.tsx` | iPhone top navigation |
| `components/MobileBottomNav.tsx` | iPhone tab bar + More sheet |
| `app/ios-app.css` | Styles that apply only inside the iOS app shell |
| `ios/.../AppIcon.appiconset` | 1024×1024 App Store icon |

The shell appends `StockGPTApp/1.0` to the WebView user agent. The web app uses that marker to enable app-only presentation and to keep web-only purchase/marketing chrome out of the shell where required.

## Run it in Xcode now

You **do not need the paid Apple Developer Program to start building or testing**.

- The iPhone Simulator works without a paid developer membership.
- A real iPhone can be run from Xcode using a normal Apple Account/Personal Team for development signing.
- The paid Apple Developer Program is needed later for TestFlight and App Store distribution (and some production capabilities).

On a Mac:

```bash
npm install
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select the **App** scheme.
2. Choose an iPhone Simulator and press **Run** (`⌘R`).
3. For a plugged-in iPhone, open **Signing & Capabilities** and select your Personal Team/Apple Account.

With no extra configuration, the app opens `https://stockgpt.pro/dashboard` and therefore uses the live product.

## Test web/app changes before deploying

`capacitor.config.ts` supports `CAPACITOR_SERVER_URL`. This is important because the production shell normally points at the live website; without an override, an undeployed branch cannot appear in Xcode.

### iPhone Simulator + local Next.js

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
CAPACITOR_SERVER_URL=http://localhost:3000/dashboard npx cap sync ios
npx cap open ios
```

Run the simulator from Xcode. The Capacitor user-agent marker is still present, so you are testing the actual **app-shell layout**, not ordinary mobile Safari.

When you want the Xcode project to point back to production, sync again without the override:

```bash
npx cap sync ios
```

### Real iPhone + preview deployment

For a physical phone, the cleanest branch-testing workflow is an HTTPS preview deployment (for example your normal preview environment):

```bash
CAPACITOR_SERVER_URL=https://YOUR-PREVIEW-HOST/dashboard npx cap sync ios
npx cap open ios
```

Using HTTPS avoids local-network and App Transport Security differences between Macs, routers and devices. Never commit a temporary preview URL into `capacitor.config.ts`; keep it in the one-shot environment variable.

## What gets copied from the web product

Because the app loads the real authenticated StockGPT product, the feature set stays shared rather than being reimplemented separately:

- Dashboard and market overview
- AI stock rankings and stock-detail research
- Portfolio tools and portfolio analysis
- Watchlist
- Alerts/notifications
- World News and ticker impact context
- Search and compare flows
- Account/settings flows

The iPhone navigation is intentionally adapted rather than literally duplicating the desktop sidebar: Home, Rankings, Portfolio and Watchlist are tabs; Alerts, World News and Settings live in **More**. Detail/compare/focused flows can temporarily hide the tab bar so the content gets the whole screen.

## Ship to TestFlight / the App Store

When the product is ready for external beta testing:

1. Join the Apple Developer Program.
2. In Xcode, select the **App** target → **Signing & Capabilities** → your paid Team.
3. Use **Product → Archive**, then **Distribute App → App Store Connect**.
4. In App Store Connect create **StockGPT** using bundle ID `pro.stockgpt.app`, add screenshots, description, privacy-policy details and App Privacy answers.
5. Distribute through TestFlight before public review.

## App Review items to finish before public submission

Two areas need a deliberate product decision before App Store review:

- **Minimum native value.** The current shell has native packaging/presentation, but push notifications for existing price/portfolio alerts are the strongest next native capability and make the app materially more useful on iPhone.
- **Subscriptions / purchases.** Do not casually expose the existing Stripe purchase flow inside an App Store build. Choose an App-Store-compliant subscription approach before submission (for example Apple IAP, or an eligible reader-style/external-link approach where permitted). Stripe hosts stay outside `allowNavigation`, so checkout is not silently embedded in the WKWebView.

Treat these as release work, not blockers for simulator/device development.

## Day-to-day changes

- **Normal product/UI changes:** deploy the web app and the production iPhone shell gets them on next load.
- **Testing undeployed changes:** use `CAPACITOR_SERVER_URL` and re-run `npx cap sync ios`.
- **Native-shell changes** (Capacitor settings, icons, Swift/native plugins): run `npx cap sync ios`, rebuild in Xcode, and eventually ship a new binary.
- **Ranking logic:** stays in `stockgpt-ranking`; do not fork or duplicate it into the iOS client.
