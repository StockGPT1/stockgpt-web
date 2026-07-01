export function normaliseInternalRedirect(
  value: unknown,
  fallback = "/dashboard",
) {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://stockgpt.local");

    if (parsed.origin !== "https://stockgpt.local") return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
