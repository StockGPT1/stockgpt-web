// Match the existing portfolio action engine's tolerance for end-of-day and
// weekend data. Model or news updates must not refresh an older quote.
const MAX_ALERT_DATA_AGE_MS = 72 * 60 * 60 * 1000;

export function isAlertDataFresh(updatedAt: string | null | undefined, nowMs = Date.now()) {
  if (!updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  const age = nowMs - timestamp;
  return Number.isFinite(timestamp) && age <= MAX_ALERT_DATA_AGE_MS;
}

export function hasUsableAlertQuote(price: number, updatedAt: string | null | undefined, nowMs = Date.now()) {
  return Number.isFinite(price) && price > 0 && isAlertDataFresh(updatedAt, nowMs);
}
