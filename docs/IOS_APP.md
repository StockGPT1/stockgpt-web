# StockGPT iPhone app

The iOS app is a **Capacitor shell**: a native app whose entire screen is a
WKWebView rendering the live site (`https://stockgpt.pro/dashboard`). That is
what keeps it "very very similar" to the website — it *is* the website. Every
web deploy updates the app instantly, with no App Store re-submission for UI
changes.

## What's in the repo

| Path | Purpose |
| --- | --- |
| `capacitor.config.ts` | App identity (`pro.stockgpt.app`), start URL, WebView rules |
| `ios/` | The Xcode project (Capacitor 8, Swift Package Manager — no CocoaPods) |
| `capacitor-fallback/` | Branded loading page + offline/error page bundled in the app |
| `components/AppShellMode.tsx` | Tags `<html data-app-shell>` when the site runs inside the app |
| `ios/.../AppIcon.appiconset` | 1024×1024 App Store icon (gold flame, no alpha) |

The shell appends `StockGPTApp/1.0` to the WebView user agent. The site uses
that to hide web-only chrome in-app (currently: the £4.99 offer bar on the
landing page — see the App Review notes below).

## Build & run (requires a Mac)

1. **Prerequisites**: macOS with Xcode 16+, Node 20+, and an
   [Apple Developer Program](https://developer.apple.com/programs/) membership
   (£79/year) for TestFlight and the App Store.
2. Clone the repo and install dependencies:
   ```bash
   npm install
   npx cap sync ios
   npx cap open ios      # opens ios/App in Xcode
   ```
3. In Xcode, select the **App** target → *Signing & Capabilities* → choose your
   Team. Xcode will provision `pro.stockgpt.app` automatically.
4. Pick a simulator or your plugged-in iPhone and press **Run**. The app
   opens the live site; sign in and everything works exactly like Safari,
   minus the browser chrome.

## Ship to TestFlight / the App Store

1. In Xcode: *Product → Archive*, then *Distribute App → App Store Connect*.
2. In [App Store Connect](https://appstoreconnect.apple.com): create the app
   (bundle ID `pro.stockgpt.app`, name **StockGPT**), add screenshots
   (6.9" and 6.5" iPhone sizes), description, privacy policy URL
   (`https://stockgpt.pro/legal`), and the App Privacy questionnaire
   (accounts, email, purchase history via Stripe).
3. Add testers in TestFlight first — the shell deserves a week of real-phone
   testing before review.

## App Review — read before submitting

Two Apple guidelines matter for this app:

- **4.2 Minimum functionality.** Apple rejects apps that are "just a website".
  Before public submission, plan at least one native capability — push
  notifications for price/portfolio alerts is the natural one (Capacitor's
  `@capacitor/push-notifications` + your existing alerts system). TestFlight
  distribution is fine without it.
- **3.1.1 In-app purchase.** Subscriptions bought *inside* an app must use
  Apple's IAP (Apple takes 15–30%). Options, safest first:
  1. **Reader-style app** (Netflix/Spotify model): users subscribe on the
     website; the app never shows prices or checkout. The shell already hides
     the landing offer bar in-app; before submission also hide `/pricing`
     upsells when `data-app-shell` is set.
  2. **External purchase link** (US storefront only, needs the entitlement).
  3. **Apple IAP** alongside Stripe — most work, needed only if you want to
     *sell* inside the app.

  Stripe checkout currently opens in Safari (outside the WebView) because
  `stripe.com` is not in `allowNavigation` — keep it that way.

## Day-to-day changes

- **Website changes**: nothing to do — the app picks them up on next launch.
- **Shell changes** (start URL, icon, native plugins): edit
  `capacitor.config.ts` / `ios/`, run `npx cap sync ios`, rebuild in Xcode,
  and ship a new build via App Store Connect.
- The Android equivalent lives on the old `capacitor-android-app` branch and
  can be revived the same way (`npx cap add android`).
