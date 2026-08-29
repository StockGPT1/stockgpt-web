import {
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentPortfolioIntelligenceFacts,
} from "@/lib/current-portfolio-intelligence";
import type {
  AssessmentReason,
  PortfolioStatus,
  ReasonCode,
} from "@/lib/portfolio-intelligence";
import {
  buildPortfolioIntelligenceView,
  type IntelligenceReasonView,
} from "@/lib/portfolio-intelligence-presentation";

export type NotificationKind = "canonical_review" | "saved_reference";
export type NotificationStatus = Extract<
  PortfolioStatus,
  "review" | "urgent_review"
>;

export type Notification = {
  key: string;
  kind: NotificationKind;
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  company: string | null;
  status: NotificationStatus | null;
  statusLabel: "Review" | "Urgent review" | null;
  reasonCodes: ReasonCode[];
  reasons: IntelligenceReasonView[];
  title: string;
  message: string;
  createdAt: string | null;
};

export type NotificationCandidate = Notification & {
  dismissalKeys: string[];
};

export type CanonicalNotificationPortfolio = {
  portfolioName: string;
  facts: CurrentPortfolioIntelligenceFacts;
  companiesByTicker: Record<string, string | null>;
};

function tickerKey(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function weekBucket(asOf: string): string {
  const date = new Date(asOf);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Canonical notification asOf must be a valid timestamp.");
  }
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function buildCanonicalNotificationKey({
  portfolioId,
  instrumentKey,
  status,
  reasonCodes,
  asOf,
}: {
  portfolioId: string;
  instrumentKey: string;
  status: NotificationStatus;
  reasonCodes: ReasonCode[];
  asOf: string;
}) {
  const reasons = [...new Set(reasonCodes)].sort((left, right) =>
    left.localeCompare(right),
  );
  return [
    "canonical_review",
    portfolioId,
    tickerKey(instrumentKey) || instrumentKey,
    status,
    reasons.join(","),
    weekBucket(asOf),
  ].join(":");
}

function buildSavedTargetReferenceKey({
  portfolioId,
  ticker,
  level,
}: {
  portfolioId: string;
  ticker: string;
  level: number;
}) {
  return `${portfolioId}:${ticker}:saved_target_reference:${level.toFixed(2)}`;
}

function latestEvidenceTimestamp(reasons: AssessmentReason[]): string | null {
  const timestamps = reasons
    .flatMap((reason) => reason.evidence)
    .map((evidence) => evidence.observedAt)
    .filter((value): value is string => {
      if (!value) return false;
      return Number.isFinite(new Date(value).getTime());
    })
    .sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime(),
    );
  return timestamps[0] ?? null;
}

function reviewReasonViews({
  reasons,
  views,
}: {
  reasons: AssessmentReason[];
  views: IntelligenceReasonView[];
}) {
  const reviewReasons = reasons.filter((reason) => reason.level === "review");
  const reviewCodes = new Set(reviewReasons.map((reason) => reason.code));
  return {
    reviewReasons,
    reasonViews: views.filter((reason) => reviewCodes.has(reason.code)),
  };
}

function reasonMessage(reasons: IntelligenceReasonView[]) {
  const titles = reasons.map((reason) => reason.title);
  return titles.length > 0
    ? `Current reasons: ${titles.join("; ")}.`
    : "Current covered portfolio evidence warrants a closer look.";
}

function buildPortfolioCandidates({
  portfolioName,
  facts,
  companiesByTicker,
  asOf,
}: CanonicalNotificationPortfolio & { asOf: string }): NotificationCandidate[] {
  const current = assessCurrentPortfolioIntelligenceFacts(facts, asOf);
  const view = buildPortfolioIntelligenceView({
    result: current.assessment,
    adapterLimitations: current.adapterLimitations,
  });

  if (view.availability !== "ready") return [];

  const candidates: NotificationCandidate[] = [];
  const assessmentByKey = new Map(
    current.assessment.portfolio.holdingAssessments.map((assessment) => [
      assessment.instrumentKey,
      assessment,
    ]),
  );

  for (const instrumentKey of view.attentionOrder) {
    const assessment = assessmentByKey.get(instrumentKey);
    if (
      !assessment ||
      (assessment.status !== "review" && assessment.status !== "urgent_review")
    ) {
      continue;
    }
    const ticker = tickerKey(assessment.ticker) || assessment.instrumentKey;
    const holdingView = view.holdingAssessments[ticker];
    const { reviewReasons, reasonViews } = reviewReasonViews({
      reasons: assessment.reasons,
      views: holdingView?.reasons ?? [],
    });
    const reasonCodes = reviewReasons.map((reason) => reason.code);
    const key = buildCanonicalNotificationKey({
      portfolioId: facts.portfolio.id,
      instrumentKey: assessment.instrumentKey,
      status: assessment.status,
      reasonCodes,
      asOf,
    });
    const statusLabel =
      assessment.status === "urgent_review" ? "Urgent review" : "Review";

    candidates.push({
      key,
      dismissalKeys: [key],
      kind: "canonical_review",
      portfolioId: facts.portfolio.id,
      portfolioName,
      ticker,
      company: companiesByTicker[ticker] ?? null,
      status: assessment.status,
      statusLabel,
      reasonCodes,
      reasons: reasonViews,
      title: `${ticker} · ${statusLabel}`,
      message: reasonMessage(reasonViews),
      createdAt: latestEvidenceTimestamp(reviewReasons),
    });
  }

  const inputByTicker = new Map(
    current.input.holdings.map((holding) => [tickerKey(holding.ticker), holding]),
  );
  if (facts.portfolio.currency.trim().toUpperCase() === "USD") {
    for (const holding of facts.holdings) {
      const ticker = tickerKey(holding.ticker);
      const target = finitePositive(holding.target_level_at_entry);
      const input = inputByTicker.get(ticker);
      const currentPrice = finitePositive(input?.market.currentPrice);
      if (!ticker || target === null || currentPrice === null || currentPrice < target) {
        continue;
      }
      const key = buildSavedTargetReferenceKey({
        portfolioId: facts.portfolio.id,
        ticker,
        level: target,
      });
      candidates.push({
        key,
        dismissalKeys: [key],
        kind: "saved_reference",
        portfolioId: facts.portfolio.id,
        portfolioName,
        ticker,
        company: companiesByTicker[ticker] ?? null,
        status: null,
        statusLabel: null,
        reasonCodes: [],
        reasons: [],
        title: `${ticker} · Saved target reference reached`,
        message: `Current price is $${currentPrice.toFixed(2)}, at or above the stored target reference of $${target.toFixed(2)}.`,
        createdAt: input?.market.priceAsOf ?? null,
      });
    }
  }

  return candidates;
}

export function buildCanonicalNotificationCandidates({
  portfolios,
  asOf,
}: {
  portfolios: CanonicalNotificationPortfolio[];
  asOf: string;
}): NotificationCandidate[] {
  const candidates = portfolios.flatMap((portfolio) =>
    buildPortfolioCandidates({ ...portfolio, asOf }),
  );
  const statusOrder: Record<NotificationStatus, number> = {
    urgent_review: 0,
    review: 1,
  };
  return candidates.sort((left, right) => {
    const leftOrder = left.status ? statusOrder[left.status] : 2;
    const rightOrder = right.status ? statusOrder[right.status] : 2;
    return (
      leftOrder - rightOrder ||
      left.portfolioName.localeCompare(right.portfolioName) ||
      left.ticker.localeCompare(right.ticker) ||
      left.key.localeCompare(right.key)
    );
  });
}

export function stripNotificationDismissalKeys(
  candidate: NotificationCandidate,
): Notification {
  const { dismissalKeys, ...notification } = candidate;
  void dismissalKeys;
  return notification;
}
