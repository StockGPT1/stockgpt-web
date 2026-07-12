export type AskContextType =
  | "dashboard"
  | "rankings"
  | "stock"
  | "portfolio"
  | "holding";

export type AskContext = {
  contextType: AskContextType;
  portfolioId?: string;
  ticker?: string;
  holdingTicker?: string;
  activeFilters?: Record<string, string | number | boolean | null>;
  ownsStock?: boolean;
};

const CONTEXT_TYPES = new Set<AskContextType>([
  "dashboard",
  "rankings",
  "stock",
  "portfolio",
  "holding",
]);

function compactTicker(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
}

export function normaliseAskContext(value: unknown): AskContext | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const contextType = String(input.contextType ?? "") as AskContextType;
  if (!CONTEXT_TYPES.has(contextType)) return null;

  const portfolioId = String(input.portfolioId ?? "").trim().slice(0, 80);
  const ticker = compactTicker(input.ticker);
  const holdingTicker = compactTicker(input.holdingTicker);
  const activeFilters =
    input.activeFilters && typeof input.activeFilters === "object"
      ? Object.fromEntries(
          Object.entries(input.activeFilters as Record<string, unknown>)
            .slice(0, 12)
            .map(([key, item]) => [
              key.slice(0, 40),
              typeof item === "string"
                ? item.slice(0, 120)
                : typeof item === "number" || typeof item === "boolean" || item === null
                  ? item
                  : String(item).slice(0, 120),
            ]),
        )
      : undefined;

  return {
    contextType,
    ...(portfolioId ? { portfolioId } : {}),
    ...(ticker ? { ticker } : {}),
    ...(holdingTicker ? { holdingTicker } : {}),
    ...(activeFilters && Object.keys(activeFilters).length > 0 ? { activeFilters } : {}),
    ...(typeof input.ownsStock === "boolean" ? { ownsStock: input.ownsStock } : {}),
  };
}

export function buildAskHref(context?: AskContext | null) {
  if (!context) return "/ask-stockgpt";

  const safe = normaliseAskContext(context);
  if (!safe) return "/ask-stockgpt";

  const params = new URLSearchParams({ contextType: safe.contextType });
  if (safe.portfolioId) params.set("portfolioId", safe.portfolioId);
  if (safe.ticker) params.set("ticker", safe.ticker);
  if (safe.holdingTicker) params.set("holdingTicker", safe.holdingTicker);
  if (safe.activeFilters) params.set("filters", JSON.stringify(safe.activeFilters));
  if (typeof safe.ownsStock === "boolean") params.set("ownsStock", String(safe.ownsStock));

  return `/ask-stockgpt?${params.toString()}`;
}

export function askContextFromSearchParams(
  params: Record<string, string | string[] | undefined>,
) {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  let activeFilters: Record<string, unknown> | undefined;
  const filters = one(params.filters);
  if (filters) {
    try {
      const parsed = JSON.parse(filters);
      if (parsed && typeof parsed === "object") activeFilters = parsed;
    } catch {}
  }

  return normaliseAskContext({
    contextType: one(params.contextType),
    portfolioId: one(params.portfolioId),
    ticker: one(params.ticker),
    holdingTicker: one(params.holdingTicker),
    activeFilters,
    ownsStock: one(params.ownsStock) === "true",
  });
}
