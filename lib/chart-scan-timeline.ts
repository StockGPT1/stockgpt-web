export type ScanTimeline = {
  entry: string;
  target: string;
  reassess: string;
  basis: string;
  quality: "estimated" | "illustrative";
};

function positiveBars(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 500 ? value : null;
}

export function chartTimeframeMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^(D|daily|1D)$/i.test(text)) return 1440;
  if (/^(W|weekly|1W)$/i.test(text)) return 10080;
  if (/^(M|monthly|\d+M)$/.test(text)) return null; // Calendar months vary; never interpret M as minutes.
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(m|min(?:ute)?s?|h|hours?|d|days?|w|weeks?)$/i);
  if (!match) return null;
  const count = Number(match[1]), unit = match[2].toLowerCase();
  return count > 0 && count <= 10080 ? count * (unit.startsWith("w") ? 10080 : unit.startsWith("d") ? 1440 : unit.startsWith("h") ? 60 : 1) : null;
}

function duration(bars: number, minutes: number) {
  const total = bars * minutes;
  return total >= 10080 && total % 10080 === 0 ? `${total / 10080}w`
    : total >= 1440 && total % 1440 === 0 ? `${total / 1440}d`
      : total >= 60 ? `${Number((total / 60).toFixed(1))}h` : `${total}m`;
}

export function buildScanTimeline(value: unknown, timeframe: unknown, confirmed: boolean, illustrative: boolean): ScanTimeline {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const e1 = positiveBars(raw.entry_min_bars), e2 = positiveBars(raw.entry_max_bars);
  const t1 = positiveBars(raw.target_min_bars), t2 = positiveBars(raw.target_max_bars);
  const expiry = positiveBars(raw.reassess_bars);
  const valid = e1 !== null && e2 !== null && e1 <= e2 && t1 !== null && t2 !== null && t1 <= t2 && expiry !== null;
  const minutes = chartTimeframeMinutes(timeframe);
  const window = (a: number, b: number) => `${a === b ? a : `${a}–${b}`} candles${minutes !== null ? ` · ${a === b ? duration(a, minutes) : `${duration(a, minutes)}–${duration(b, minutes)}`} of chart time` : ""}`;
  const entryMin = valid ? e1 : 1, entryMax = valid ? e2 : 3;
  const targetMin = valid ? t1 : 6, targetMax = valid ? t2 : 12;
  const reassess = valid ? expiry : 6;
  return {
    entry: confirmed ? "Trigger already visible · recheck before entry" : `Next ${window(entryMin, entryMax)} · only if the trigger appears`,
    target: `About ${window(targetMin, targetMax)} after entry`,
    reassess: `Review again after ${window(reassess, reassess)}${confirmed ? " if price stalls" : " if the entry has not triggered"}`,
    basis: valid && typeof raw.basis === "string" && raw.basis.trim() ? raw.basis.trim().slice(0, 260)
      : "Illustrative monitoring windows; the image did not support a specific timing estimate.",
    quality: valid && !illustrative ? "estimated" : "illustrative",
  };
}
