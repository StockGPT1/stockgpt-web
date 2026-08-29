export type PortfolioTransactionChronology = {
  id: string;
  occurredAt: string | null;
  recordedAt: string;
};

function timestampMs(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function portfolioTransactionActivityAt(
  transaction: PortfolioTransactionChronology,
) {
  return timestampMs(transaction.occurredAt) > Number.NEGATIVE_INFINITY
    ? transaction.occurredAt!
    : transaction.recordedAt;
}

export function comparePortfolioTransactionActivityDesc(
  left: PortfolioTransactionChronology,
  right: PortfolioTransactionChronology,
) {
  const activityDifference =
    timestampMs(portfolioTransactionActivityAt(right)) -
    timestampMs(portfolioTransactionActivityAt(left));
  if (activityDifference !== 0) return activityDifference;

  const recordedDifference = timestampMs(right.recordedAt) - timestampMs(left.recordedAt);
  if (recordedDifference !== 0) return recordedDifference;

  return right.id.localeCompare(left.id);
}
