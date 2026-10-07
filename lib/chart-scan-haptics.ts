import { nativeHaptic, type NativeHapticStyle } from "./ios-native.ts";

type ScannerAction = "tap" | "open" | "close" | "scan" | "complete" | "warning" | "error";

// Give each action a consistent feel. The native bridge respects device feedback
// settings; browsers without that bridge simply continue without vibration.
const feedback: Record<ScannerAction, NativeHapticStyle> = {
  tap: "light",
  open: "medium",
  close: "light",
  scan: "heavy",
  complete: "success",
  warning: "warning",
  error: "error",
};

export function scannerHaptic(action: ScannerAction = "tap") {
  try { return nativeHaptic(feedback[action]); } catch { return false; }
}
