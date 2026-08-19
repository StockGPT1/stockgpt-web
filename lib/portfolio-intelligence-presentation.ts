import type {
  AssessmentReason,
  HoldingAssessment,
  PortfolioIntelligenceResult,
  PortfolioStatus,
  ReasonCode,
  ReasonLevel,
} from "@/lib/portfolio-intelligence";

export type PortfolioIntelligenceAvailability = "ready" | "limited";
export type PortfolioIntelligenceTone =
  | "positive"
  | "caution"
  | "warning"
  | "risk"
  | "neutral";

export type IntelligenceReasonView = {
  code: ReasonCode;
  level: ReasonLevel;
  title: string;
  detail: string;
  affectedInstrumentKeys: string[];
};

export type HoldingIntelligenceView = {
  instrumentKey: string;
  ticker: string | null;
  status: PortfolioStatus | null;
  statusLabel: string;
  tone: PortfolioIntelligenceTone;
  attentionRank: number;
  reasonCodes: ReasonCode[];
  reasons: IntelligenceReasonView[];
};

export type PortfolioIntelligenceView = {
  availability: PortfolioIntelligenceAvailability;
  status: PortfolioStatus | null;
  statusLabel: string;
  tone: PortfolioIntelligenceTone;
  summary: string;
  holdingAssessments: Record<string, HoldingIntelligenceView>;
  countsByStatus: Record<PortfolioStatus, number>;
  attentionOrder: string[];
  reasons: IntelligenceReasonView[];
};

const STATUS_PRESENTATION: Record<
  PortfolioStatus,
  { label: string; tone: PortfolioIntelligenceTone; summary: string }
> = {
  on_track: {
    label: "On track",
    tone: "positive",
    summary:
      "No material review signal is present in the currently covered portfolio data.",
  },
  monitor: {
    label: "Monitor",
    tone: "caution",
    summary: "Some signals or data coverage are worth monitoring.",
  },
  review: {
    label: "Review",
    tone: "warning",
    summary: "One or more material signals warrant a closer look.",
  },
  urgent_review: {
    label: "Urgent review",
    tone: "risk",
    summary: "Several independent signals warrant prompt investigation.",
  },
};

const EMPTY_COUNTS: Record<PortfolioStatus, number> = {
  on_track: 0,
  monitor: 0,
  review: 0,
  urgent_review: 0,
};

const REASON_PRESENTATION: Record<
  ReasonCode,
  { title: string; detail: string }
> = {
  portfolio_empty: {
    title: "Portfolio empty",
    detail: "This portfolio does not currently contain any holdings.",
  },
  position_concentration: {
    title: "Position concentration",
    detail:
      "This position represents a large share of the portfolio under the selected risk setting.",
  },
  ranking_deterioration: {
    title: "Ranking deterioration",
    detail:
      "The current StockGPT rank or score has weakened materially compared with the saved entry context.",
  },
  diagnostic_deterioration: {
    title: "Diagnostic deterioration",
    detail:
      "Current diagnostic evidence has weakened compared with its previous reading.",
  },
  event_risk: {
    title: "Event risk",
    detail: "A current structured event signal warrants attention.",
  },
  saved_risk_level_breached: {
    title: "Saved risk level reached",
    detail:
      "The current price has reached or moved below a saved risk reference level.",
  },
  data_stale: {
    title: "Data freshness",
    detail:
      "Some required market or ranking data is older than the current freshness window.",
  },
  data_missing: {
    title: "Data unavailable",
    detail: "Some required market or ranking data is unavailable.",
  },
  instrument_coverage_limited: {
    title: "Limited instrument coverage",
    detail:
      "StockGPT can identify this holding, but full ranking coverage is not currently available.",
  },
};

function reasonView(
  reason: AssessmentReason,
  fallbackInstrumentKey?: string,
): IntelligenceReasonView {
  const copy = REASON_PRESENTATION[reason.code];
  const affectedInstrumentKeys = [
    ...new Set(
      reason.evidence
        .map((evidence) => evidence.instrumentKey)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((left, right) => left.localeCompare(right));
  if (affectedInstrumentKeys.length === 0 && fallbackInstrumentKey) {
    affectedInstrumentKeys.push(fallbackInstrumentKey);
  }
  return {
    code: reason.code,
    level: reason.level,
    title: copy.title,
    detail: copy.detail,
    affectedInstrumentKeys,
  };
}

function tickerKey(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function limitedHoldingView(
  assessment: HoldingAssessment,
  attentionRank: number,
): HoldingIntelligenceView {
  return {
    instrumentKey: assessment.instrumentKey,
    ticker: assessment.ticker,
    status: null,
    statusLabel: "Analysis limited",
    tone: "neutral",
    attentionRank,
    reasonCodes: [],
    reasons: [],
  };
}

export function buildPortfolioIntelligenceView({
  result,
  adapterLimitations,
}: {
  result: PortfolioIntelligenceResult;
  adapterLimitations: string[];
}): PortfolioIntelligenceView {
  const currencyLimitation = adapterLimitations.find((limitation) =>
    limitation.startsWith("portfolio_currency_basis_unresolved:"),
  );
  const availability: PortfolioIntelligenceAvailability = currencyLimitation
    ? "limited"
    : "ready";
  const orderedAssessments =
    availability === "limited"
      ? [...result.portfolio.holdingAssessments].sort((left, right) =>
          left.instrumentKey.localeCompare(right.instrumentKey),
        )
      : result.portfolio.holdingAssessments;
  const holdingAssessments: Record<string, HoldingIntelligenceView> = {};

  for (const [index, assessment] of orderedAssessments.entries()) {
    const key = tickerKey(assessment.ticker) || assessment.instrumentKey;
    const presentation = STATUS_PRESENTATION[assessment.status];
    holdingAssessments[key] =
      availability === "limited"
        ? limitedHoldingView(assessment, index + 1)
        : {
            instrumentKey: assessment.instrumentKey,
            ticker: assessment.ticker,
            status: assessment.status,
            statusLabel: presentation.label,
            tone: presentation.tone,
            attentionRank: assessment.attentionRank,
            reasonCodes: assessment.reasons.map((reason) => reason.code),
            reasons: assessment.reasons.map((reason) =>
              reasonView(reason, assessment.instrumentKey),
            ),
          };
  }

  if (availability === "limited") {
    return {
      availability,
      status: null,
      statusLabel: "Analysis limited",
      tone: "neutral",
      summary:
        "Analysis is limited because this portfolio's stored currency basis cannot yet be reconciled with the market-price feed.",
      holdingAssessments,
      countsByStatus: { ...EMPTY_COUNTS },
      attentionOrder: orderedAssessments.map(
        (assessment) => assessment.instrumentKey,
      ),
      reasons: [],
    };
  }

  const presentation = STATUS_PRESENTATION[result.portfolio.status];
  return {
    availability,
    status: result.portfolio.status,
    statusLabel: presentation.label,
    tone: presentation.tone,
    summary: presentation.summary,
    holdingAssessments,
    countsByStatus: { ...result.portfolio.countsByStatus },
    attentionOrder: [...result.portfolio.attentionOrder],
    reasons: result.portfolio.reasons.map((reason) => reasonView(reason)),
  };
}

export function holdingIntelligenceForTicker(
  view: PortfolioIntelligenceView,
  ticker: string,
): HoldingIntelligenceView {
  return (
    view.holdingAssessments[tickerKey(ticker)] ?? {
      instrumentKey: tickerKey(ticker) || "unknown",
      ticker: tickerKey(ticker) || null,
      status: null,
      statusLabel: "Analysis limited",
      tone: "neutral",
      attentionRank: Number.MAX_SAFE_INTEGER,
      reasonCodes: [],
      reasons: [],
    }
  );
}
