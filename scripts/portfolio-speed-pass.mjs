import fs from "node:fs";

function patchFile(file, patcher) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8");
  const after = patcher(before);
  if (after !== before) fs.writeFileSync(file, after);
}

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

patchFile("app/portfolio/page.tsx", (source) => {
  source = replaceAll(source, ".order(\"created_at\", { ascending: true })\n      .limit(1000),", ".order(\"created_at\", { ascending: true })\n      .limit(500),");
  source = replaceAll(source, ".order(\"published_at\", { ascending: false })\n      .limit(180),", ".order(\"published_at\", { ascending: false })\n      .limit(90),");
  source = replaceAll(source, "  const portfolioNews = ((newsData ?? []) as BaseNewsArticle[])\n    .map((article) => ({\n      raw: article,\n      enriched: enrichArticleWithStockInsights(article, stockUniverse, 10),\n    }))\n    .filter(({ raw, enriched }) => {\n      const directTickers = parseAffectedTickers(raw.affected_tickers);\n      if (directTickers.some((ticker) => portfolioTickerSet.has(ticker))) return true;\n      return enriched.affectedStocks.some((stock) => portfolioTickerSet.has(stock.ticker));\n    })", "  const portfolioNews = ((newsData ?? []) as BaseNewsArticle[])\n    .map((article) => {\n      const directTickers = parseAffectedTickers(article.affected_tickers);\n      const hasDirectPortfolioMatch = directTickers.some((ticker) => portfolioTickerSet.has(ticker));\n      const enriched = hasDirectPortfolioMatch\n        ? enrichArticleWithStockInsights(article, stockUniverse, 4)\n        : enrichArticleWithStockInsights(article, stockUniverse, 8);\n      return { raw: article, enriched, hasDirectPortfolioMatch };\n    })\n    .filter(({ enriched, hasDirectPortfolioMatch }) => {\n      if (hasDirectPortfolioMatch) return true;\n      return enriched.affectedStocks.some((stock) => portfolioTickerSet.has(stock.ticker));\n    })");
  return source;
});

patchFile("lib/portfolio-alerts.ts", (source) => {
  source = replaceAll(source, "const NEWS_WINDOW_DAYS = 14;", "const NEWS_WINDOW_DAYS = 14;\nconst PORTFOLIO_TECHNICAL_HISTORY_LIMIT = Number(process.env.PORTFOLIO_TECHNICAL_HISTORY_LIMIT ?? 12);");
  source = replaceAll(source, "  const { data: factorDiagnosticsData } = await supabase\n    .from(\"stock_factor_diagnostics\")\n    .select(\n      \"ticker,updated_at,previous_score,current_score,smoothed_score,factor_coverage,quality_change,growth_change,value_change,momentum_change,risk_change,income_change,top_negative_factors,top_positive_factors,diagnosis\",\n    );", "  const { data: factorDiagnosticsData } = await supabase\n    .from(\"stock_factor_diagnostics\")\n    .select(\n      \"ticker,updated_at,previous_score,current_score,smoothed_score,factor_coverage,quality_change,growth_change,value_change,momentum_change,risk_change,income_change,top_negative_factors,top_positive_factors,diagnosis\",\n    )\n    .in(\"ticker\", tickers);");
  source = replaceAll(source, "  return await Promise.all(\n    holdings.map(async (holding) => {", "  return await Promise.all(\n    holdings.map(async (holding, index) => {");
  source = replaceAll(source, "      const technical = await getTechnicalLevels(ticker, currentPrice);", "      const technical = index < PORTFOLIO_TECHNICAL_HISTORY_LIMIT\n        ? await getTechnicalLevels(ticker, currentPrice)\n        : fallbackTechnicalLevels(currentPrice);");
  source = replaceAll(source, "async function getTechnicalLevels(\n  ticker: string,\n  currentPrice: number,\n): Promise<TechnicalLevels> {", "function fallbackTechnicalLevels(currentPrice: number): TechnicalLevels {\n  return {\n    stopLoss: currentPrice > 0 ? currentPrice * 0.92 : null,\n    takeProfit: currentPrice > 0 ? currentPrice * 1.14 : null,\n    support: null,\n    resistance: null,\n    ma50: null,\n    volatilityPct: currentPrice > 0 ? 4 : null,\n    source: \"fallback\",\n  };\n}\n\nasync function getTechnicalLevels(\n  ticker: string,\n  currentPrice: number,\n): Promise<TechnicalLevels> {");
  source = replaceAll(source, "    return {\n      stopLoss: currentPrice * 0.92,\n      takeProfit: currentPrice * 1.14,\n      support: null,\n      resistance: null,\n      ma50: null,\n      volatilityPct: 4,\n      source: \"fallback\",\n    };", "    return fallbackTechnicalLevels(currentPrice);");
  source = replaceAll(source, "      return {\n        stopLoss: currentPrice * 0.92,\n        takeProfit: currentPrice * 1.14,\n        support: null,\n        resistance: null,\n        ma50: null,\n        volatilityPct: 4,\n        source: \"fallback\",\n      };", "      return fallbackTechnicalLevels(currentPrice);");
  source = replaceAll(source, "    return {\n      stopLoss: currentPrice * 0.92,\n      takeProfit: currentPrice * 1.14,\n      support: null,\n      resistance: null,\n      ma50: null,\n      volatilityPct: 4,\n      source: \"fallback\",\n    };", "    return fallbackTechnicalLevels(currentPrice);");
  return source;
});

patchFile("lib/portfolio-page-chart.ts", (source) => {
  source = replaceAll(source, "const EPSILON = 0.000001;", "const EPSILON = 0.000001;\nconst PORTFOLIO_CHART_TICKER_LIMIT = Number(process.env.PORTFOLIO_CHART_TICKER_LIMIT ?? 18);");
  source = replaceAll(source, "  const tickers = Array.from(new Set([...enriched.map((holding) => holding.ticker), ...transactions.map((transaction) => cleanTicker(transaction.ticker)).filter(Boolean)])).slice(0, 50);", "  const tickers = Array.from(new Set([...enriched.map((holding) => holding.ticker), ...transactions.map((transaction) => cleanTicker(transaction.ticker)).filter(Boolean)])).slice(0, PORTFOLIO_CHART_TICKER_LIMIT);");
  return source;
});
