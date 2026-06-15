import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pro.stockgpt.app',
  appName: 'StockGPT',
  webDir: 'capacitor-fallback',
  server: {
    url: 'https://stockgpt.pro/dashboard',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#072116',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#072116',
      showSpinner: false,
    },
  },
};

export default config;

