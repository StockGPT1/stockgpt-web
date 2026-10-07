import { OFFER_PRICE, STANDARD_MONTHLY_PRICE } from "@/lib/limited-offer";

export function LimitedTimePriceOffer() {
  return (
    <span data-limited-offer-price="true">
      <span className="sr-only">{OFFER_PRICE}, standard monthly price {STANDARD_MONTHLY_PRICE}.</span>
      <span className="sg-limited-offer-original" aria-hidden="true">{STANDARD_MONTHLY_PRICE}</span>
      <span className="sg-limited-offer-current" aria-hidden="true">{OFFER_PRICE}</span>
    </span>
  );
}
