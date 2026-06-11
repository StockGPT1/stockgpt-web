import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

source = source.replace(
  'import { useMemo, useState, useTransition } from "react";',
  'import { useEffect, useMemo, useState, useTransition } from "react";',
);

const marker = "const [liveChartData, setLiveChartData] = useState";
if (!source.includes(marker)) {
  source = source.replace(
    `  const summary = buildPortfolioHealthSummary({
    id: portfolioMeta.id,
    name: portfolioMeta.name,
    currency,
    riskTolerance: portfolioMeta.riskTolerance,
    holdings,
    transactions,
    cashBalance: portfolioMeta.cashBalance,
    cashDepositedTotal: portfolioMeta.cashDepositedTotal,
  });`,
    `  const summary = buildPortfolioHealthSummary({
    id: portfolioMeta.id,
    name: portfolioMeta.name,
    currency,
    riskTolerance: portfolioMeta.riskTolerance,
    holdings,
    transactions,
    cashBalance: portfolioMeta.cashBalance,
    cashDepositedTotal: portfolioMeta.cashDepositedTotal,
  });
  const [liveChartData, setLiveChartData] = useState<Partial<Record<TimeRange, ChartPoint[]>>>(chartData);

  useEffect(() => {
    let mounted = true;
    let retryTimer: ReturnType<typeof window.setTimeout> | null = null;
    setLiveChartData(chartData);

    const loadChart = (attempt = 0) => {
      fetch(\`/api/portfolio-chart?portfolioId=\${encodeURIComponent(portfolioId)}\`, {
        cache: "no-store",
      })
        .then((response) => (response.status === 202 || response.ok ? response.json() : null))
        .then((payload) => {
          if (!mounted || !payload) return;
          if (payload.chartData) {
            setLiveChartData(payload.chartData as Partial<Record<TimeRange, ChartPoint[]>>);
          }
          if (payload.pending && attempt < 4) {
            retryTimer = window.setTimeout(() => loadChart(attempt + 1), 2500 + attempt * 2500);
          }
        })
        .catch(() => {
          // Keep the initial fallback chart if live chart generation fails.
        });
    };

    loadChart();

    return () => {
      mounted = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [portfolioId, chartData]);`,
  );
}

source = source.replace("chartData={chartData}", "chartData={liveChartData}");

fs.writeFileSync(file, source);
