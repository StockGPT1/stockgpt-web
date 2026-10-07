import { nativeHaptic } from "./ios-native.ts";

export type ScannerHapticMode = "strong" | "light" | "off";
type ScannerAction = "tap" | "open" | "close" | "scan" | "complete" | "warning" | "error";
const key = "stockgpt.scanner.haptics";
let memoryMode: ScannerHapticMode | null = null;
const subscribers = new Set<() => void>();
export const scannerHapticServerSnapshot = (): ScannerHapticMode => "strong";
export function scannerHapticMode(): ScannerHapticMode {
  if (typeof window === "undefined") return "strong";
  if (memoryMode) return memoryMode;
  try {
    const saved = window.localStorage.getItem(key);
    return saved === "off" || saved === "light" ? saved : "strong";
  } catch { return "strong"; }
}
export function subscribeScannerHaptics(callback: () => void) {
  subscribers.add(callback);
  const onStorage = (event: StorageEvent) => { if (event.key === key) { memoryMode = null; callback(); } };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => { subscribers.delete(callback); if (typeof window !== "undefined") window.removeEventListener("storage", onStorage); };
}
export function setScannerHaptics(mode: ScannerHapticMode) {
  memoryMode = mode;
  try { window.localStorage.setItem(key, mode); } catch { /* Private browsing still retains the session preference. */ }
  subscribers.forEach(callback => callback());
  scannerHaptic("tap");
}
export function scannerHaptic(action: ScannerAction = "tap") {
  const mode = scannerHapticMode();
  if (mode === "off") return false;
  const style = action === "complete" ? "success" : action === "warning" ? "warning" : action === "error" ? "error"
    : action === "open" || action === "scan" ? mode === "strong" ? "heavy" : "medium"
      : mode === "strong" ? action === "close" ? "medium" : "heavy" : "light";
  try { return nativeHaptic(style); } catch { return false; }
}
