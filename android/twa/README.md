# StockGPT Android TWA build

This folder contains the GitHub Actions setup for producing a signed Android App Bundle (`.aab`) for StockGPT using a Trusted Web Activity wrapper around `https://stockgpt.pro`.

Package name: `pro.stockgpt.app`

Required repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Run the workflow named **Build Android AAB** from GitHub Actions. It will create a signed `.aab` artifact that can be uploaded to Google Play Console.

After the first upload to Google Play, copy the Google Play **App signing key certificate SHA-256** into `public/.well-known/assetlinks.json` so the Trusted Web Activity is verified for `stockgpt.pro`.
