export type NativeHapticStyle =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

type StockGPTNativeAction =
  | { type: "haptic"; style?: NativeHapticStyle }
  | { type: "share"; title?: string; text?: string; url?: string }
  | { type: "enablePush" }
  | { type: "authenticate"; reason?: string };

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        stockgptNative?: {
          postMessage: (message: StockGPTNativeAction) => void;
        };
      };
    };
  }
}

export function isStockGPTIOSApp() {
  if (typeof window === "undefined") return false;
  return /StockGPTApp/i.test(window.navigator.userAgent);
}

function postNative(message: StockGPTNativeAction) {
  if (typeof window === "undefined") return false;
  const handler = window.webkit?.messageHandlers?.stockgptNative;
  if (!handler) return false;
  handler.postMessage(message);
  return true;
}

export function nativeHaptic(style: NativeHapticStyle = "light") {
  return postNative({ type: "haptic", style });
}

export async function nativeShare({
  title,
  text,
  url,
}: {
  title?: string;
  text?: string;
  url?: string;
}) {
  if (postNative({ type: "share", title, text, url })) return true;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }

  if (url && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function requestNativePushPermission() {
  return postNative({ type: "enablePush" });
}

export function requestNativeAuthentication(
  reason = "Unlock StockGPT to view your portfolio and account.",
) {
  return postNative({ type: "authenticate", reason });
}
