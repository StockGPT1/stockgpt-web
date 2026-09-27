export const ALL_INVESTMENTS_CONTEXT_ID = "all-investments";

export type PortfolioContextOption = {
  id: string;
  name: string;
  source: "manual" | "connected";
  createdAt: string;
};

export type PortfolioContextSelection =
  | { kind: "portfolio"; portfolioId: string }
  | { kind: "all_investments"; portfolioId: null };

export function resolvePortfolioContext({
  explicit,
  saved,
  portfolios,
}: {
  explicit?: string | null;
  saved?: PortfolioContextSelection | null;
  portfolios: PortfolioContextOption[];
}): PortfolioContextSelection | null {
  const ordered = [...portfolios].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (explicit === ALL_INVESTMENTS_CONTEXT_ID && ordered.length > 0) return { kind: "all_investments", portfolioId: null };
  if (explicit && ordered.some((portfolio) => portfolio.id === explicit)) return { kind: "portfolio", portfolioId: explicit };
  if (saved?.kind === "all_investments" && ordered.length > 0) return saved;
  if (saved?.kind === "portfolio" && ordered.some((portfolio) => portfolio.id === saved.portfolioId)) return saved;
  return ordered[0] ? { kind: "portfolio", portfolioId: ordered[0].id } : null;
}

export function contextQueryValue(selection: PortfolioContextSelection) {
  return selection.kind === "all_investments" ? ALL_INVESTMENTS_CONTEXT_ID : selection.portfolioId;
}
