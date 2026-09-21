# StockGPT iPhone app

StockGPT for iPhone is a **Capacitor 8 iOS app shell** around the same authenticated StockGPT product used on the web. The shell is native iOS/WKWebView, while rankings, portfolio state, Supabase data and account state remain shared with `stockgpt.pro`.

That architecture is deliberate: the iPhone app does not contain a second ranking engine. `stockgpt-ranking` continues to calculate/update model data, and the app consumes the same product and data as the web experience.

## Native iPhone behaviour

The app shell now adds iPhone-specific behaviour instead of behaving like a plain embedded website:

- Safe-area-aware translucent top chrome and a full-edge iOS-style tab bar.
- Haptic feedback on taps and stronger feedback on important actions.
- Native iOS Share Sheet from stock/detail screens.
- Pull to refresh.
- WKWebView swipe-back navigation.
- Dark native status-bar/launch treatment with no white launch flash.
- Optional Face ID / Touch ID app lock from **Settings**. When enabled, the app locks on launch and after 30 seconds in the background.
- Home-screen long-press shortcuts for Search, Rankings, Portfolio and Alerts.
- APNs registration, Lock Screen/banner handling and notification deep links.
- App-only portfolio/rankings layouts that remain separate from normal mobile Safari.

The web product detects the `StockGPTApp/1.0` user-agent marker and adds `<html data-app-shell="true">`, which enables app-only presentation.

## Important files

| Path | Purpose |
| --- | --- |
| `capacitor.config.ts` | App identity, production URL and optional development-server override |
| `ios/App/App/SceneDelegate.swift` | Native bridge, haptics, share, Face ID, pull-to-refresh, shortcuts and WebView behaviour |
| `ios/App/App/AppDelegate.swift` | APNs registration and notification handling |
| `ios/App/App/Info.plist` | Face ID description, launch configuration and app-icon shortcuts |
| `components/IOSNativeEnhancements.tsx` | App-wide haptics, pull-to-refresh and native event handling |
| `components/IOSAppLock.tsx` | Face ID/Touch ID app lock |
| `components/IOSPushSetupCard.tsx` | In-app notification permission/setup UI |
| `lib/ios-native.ts` | JavaScript → native bridge helpers |
| `app/ios-app.css` | Styles applied only inside the iOS shell |
| `supabase/migrations/20260917_ios_push_devices.sql` | Registered APNs devices |
| `supabase/migrations/20260917_ios_push_delivery.sql` | APNs environment + delivery dedupe |
| `app/api/cron/ios-push/route.ts` | Scheduled StockGPT portfolio-alert delivery |

## Run it in Xcode

On a Mac:

```bash
npm install
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select the **App** scheme.
2. Open **App → Signing & Capabilities** and select the paid StockGPT Apple Developer Team.
3. Keep **Automatically manage signing** enabled.
4. Choose an iPhone Simulator or the connected iPhone.
5. Press **Run** (`⌘R`).

With no server override, the shell opens `https://stockgpt.pro/dashboard` and therefore displays the currently deployed web product.

## Test branch UI before production deploy

`capacitor.config.ts` supports `CAPACITOR_SERVER_URL`. Without an override, native Swift changes appear after an Xcode rebuild, but **undeployed React/CSS changes will not appear** because the WebView still loads production.

### Simulator + local Next.js

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
CAPACITOR_SERVER_URL=http://localhost:3000/dashboard npx cap sync ios
npx cap open ios
```

### Real iPhone + HTTPS preview

A physical iPhone should normally use an HTTPS preview deployment:

```bash
CAPACITOR_SERVER_URL=https://YOUR-PREVIEW-HOST/dashboard npx cap sync ios
npx cap open ios
```

To return the Xcode project to production later:

```bash
npx cap sync ios
```

Never commit a temporary preview URL into `capacitor.config.ts`.

## Enable real iPhone push alerts

The code for APNs device registration and scheduled delivery is in the repo, but the Apple capability, database migrations and APNs provider credentials must exist in the deployed environment.

### 1. Enable the Xcode capability

In Xcode open:

**App target → Signing & Capabilities → + Capability → Push Notifications**

Use the paid Apple Developer Team and automatic signing. Xcode should update the App ID/provisioning profile for `pro.stockgpt.app`. The repository also contains `App/App.entitlements`; if Xcode creates or selects an entitlements file, make sure the target is using the one containing `aps-environment`.

### 2. Apply the Supabase migrations

Apply:

- `supabase/migrations/20260917_ios_push_devices.sql`
- `supabase/migrations/20260917_ios_push_delivery.sql`

Using the normal StockGPT migration/deployment workflow. If using the Supabase CLI for the linked production project, review the pending migrations before running the project’s normal `db push` flow.

### 3. Create an APNs provider key

In the Apple Developer portal create a key that can use Apple Push Notification service (APNs), then configure the production server with:

```text
APNS_TEAM_ID=YOUR_APPLE_TEAM_ID
APNS_KEY_ID=YOUR_APNS_KEY_ID
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APNS_BUNDLE_ID=pro.stockgpt.app
```

`CRON_SECRET` should also remain configured for manual secured cron calls. Vercel Cron can use the repository's existing cron-auth path in production.

The app initially stores debug/Xcode tokens as sandbox devices. The push worker retries the opposite APNs environment on `BadDeviceToken` and remembers the successful environment, so TestFlight/App Store production tokens can self-correct after a build transition.

### 4. Deploy the web/server branch

`vercel.json` schedules `/api/cron/ios-push` every 15 minutes. The worker:

- reads enabled iPhone devices,
- evaluates the same portfolio trim/risk/target conditions used by StockGPT Alerts,
- skips alerts the user has already resolved,
- deduplicates previously sent device/alert pairs,
- sends up to three new alerts per user per run,
- deep-links taps back into the relevant StockGPT portfolio or stock page,
- disables APNs tokens Apple reports as unregistered.

After the server pieces are deployed, open **Alerts** in the iPhone app and tap **Enable iPhone alerts**.

## Portfolio and Rankings on iPhone

The app-specific mobile pass deliberately changes information priority:

- Portfolio performance/chart is compact rather than taking most of the first screen.
- **Holdings now appear immediately after the compact portfolio summary**, instead of after several long analysis sections.
- Portfolio charts expose 1D / 5D / 1M / 6M / 1Y / All and sanitise invalid/duplicate timestamps before rendering. The existing server-side sparse-history timeline rebuild remains the source of real chart points; the client does not invent movement.
- Portfolio Pulse, exposure analysis and opportunity ideas remain available lower on the page.
- Rankings use compact stock cards with rank movement, AI score, 1D move, price and confidence visible without opening a desktop-style table.
- The long score-method explanation is hidden inside the app shell on small iPhones so the actual rankings arrive much sooner; it remains available on the web/desktop product.

## TestFlight / App Store

The paid Apple Developer membership is now the correct setup for:

- APNs Push Notifications
- TestFlight
- App Store Connect
- distribution signing and provisioning

For external beta testing:

1. Make sure the production bundle identifier is `pro.stockgpt.app`.
2. Select the paid Team and automatic signing.
3. **Product → Archive**.
4. **Distribute App → App Store Connect**.
5. Create/update StockGPT in App Store Connect, then distribute the build through TestFlight before public review.

## App Review / purchase note

Do not casually embed the existing Stripe checkout flow inside the App Store binary. Before public submission, use an App-Store-compliant purchase/subscription approach for any digital subscription sold from iOS. Stripe hosts remain outside the app's `allowNavigation` list.

## Widget note

A proper StockGPT Home Screen/Lock Screen widget requires a separate **WidgetKit extension target**, shared App Group data and its own signing/provisioning. That is intentionally not faked inside the WebView shell. Add the extension as a separate native target once the core app/alerts build is stable, then share a small snapshot (for example watchlist movers or top rankings) through an App Group.

## Day-to-day changes

- **Normal product/UI changes:** deploy the web app and the production iPhone shell receives them on next load.
- **Undeployed branch UI:** use `CAPACITOR_SERVER_URL` against local development or an HTTPS preview and re-run `npx cap sync ios`.
- **Native Swift/config changes:** rebuild the iOS binary in Xcode.
- **Ranking logic:** remains in `stockgpt-ranking`; do not fork or duplicate it into iOS.
