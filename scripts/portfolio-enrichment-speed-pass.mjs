import fs from "node:fs";

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

const file = "lib/portfolio-alerts.ts";
let source = fs.readFileSync(file, "utf8");

const currentQuery = `  const { data: currentData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score, price")
    .in("ticker", tickers);`;

const newsDate = `  const fourteenDaysAgo = new Date(
    Date.now() - NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();`;

if (source.includes(currentQuery) && !source.includes("const [currentResult, newsResult, diagnosticsResult, sectorData]")) {
  const start = source.indexOf(currentQuery);
  const endMarker = "  const currentMap = new Map(";
  const end = source.indexOf(endMarker, start);

  if (start !== -1 && end !== -1) {
    const replacement = `${newsDate}

  const [currentResult, newsResult, diagnosticsResult, sectorData] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("ticker, company, sector, rank, score, price")
      .in("ticker", tickers),
    supabase
      .from("news_articles")
      .select("title, impact, affected_tickers, published_at")
      .gte("published_at", fourteenDaysAgo)
      .limit(300),
    supabase
      .from("stock_factor_diagnostics")
      .select("ticker,updated_at,previous_score,current_score,smoothed_score,factor_coverage,quality_change,growth_change,value_change,momentum_change,risk_change,income_change,top_negative_factors,top_positive_factors,diagnosis")
      .in("ticker", tickers),
    getSectorData(),
  ]);

  const currentData = currentResult.data;
  const recentNews = newsResult.data;
  const factorDiagnosticsData = diagnosticsResult.data;
  const { momentum, bullishPct, maxScore, totalStocks } = sectorData;

`;

    source = source.slice(0, start) + replacement + source.slice(end);
  }
}

fs.writeFileSync(file, source);
