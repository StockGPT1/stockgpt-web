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
    setLiveChartData(chartData);

    fetch(\`/api/portfolio-chart?portfolioId=\${encodeURIComponent(portfolioId)}\`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.chartData) return;
        setLiveChartData(payload.chartData as Partial<Record<TimeRange, ChartPoint[]>>);
      })
      .catch(() => {
        // Keep the initial fallback chart if live chart generation fails.
      });

    return () => {
      mounted = false;
    };
  }, [portfolioId, chartData]);`,
  );
}

source = source.replace("chartData={chartData}", "chartData={liveChartData}");

fs.writeFileSync(file, source);
