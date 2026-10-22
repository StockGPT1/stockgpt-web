// CSV-specific budgets retain Next's default 1 MiB Server Action body limit.
// Encoded text has a separate bound to leave room for action/argument framing.
export const TRADING212_CSV_MAX_BYTES = 750 * 1024;
export const TRADING212_CSV_MAX_ENCODED_BYTES = 900 * 1024;
export const TRADING212_CSV_UPLOAD_LIMIT_MESSAGE =
  "CSV upload limit: 750 KiB of UTF-8 text and 900 KiB after request encoding. Do not remove required transaction history to fit; use manual holdings entry if your complete export exceeds the limit.";

export function trading212CsvUploadError(csvText: string): string | null {
  if (typeof csvText !== "string" || !csvText.trim()) {
    return "Choose a non-empty Trading 212 CSV export.";
  }
  const encoder = new TextEncoder();
  if (
    encoder.encode(csvText).byteLength > TRADING212_CSV_MAX_BYTES ||
    encoder.encode(JSON.stringify(csvText)).byteLength > TRADING212_CSV_MAX_ENCODED_BYTES
  ) {
    return TRADING212_CSV_UPLOAD_LIMIT_MESSAGE;
  }
  return null;
}
