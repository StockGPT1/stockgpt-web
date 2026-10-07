// Display copy for the monthly founding offer selected by the checkout route.
// Stripe remains the source of truth for the final amount and billing terms.
// Do not show remaining places without a purchase-backed count and enforced cap.
export const OFFER_PRICE = "£4.99";
export const STANDARD_MONTHLY_PRICE = "£18.99";
export const ANNUAL_PRICE = "£189.99";
export const MONTHLY_OFFER_NOTE = `Founding monthly rate. Full Core access. Normally ${STANDARD_MONTHLY_PRICE}/month.`;
export const ANNUAL_PLAN_NOTE = `Annual billing. The ${OFFER_PRICE} founding offer applies to monthly billing.`;
