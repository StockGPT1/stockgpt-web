/* Founding-member offer: £4.99/mo for the next 500 members.
   Seats count down deterministically from the UTC day — 134 at the top
   of a batch, minus 20 per day, resetting to a fresh batch after the
   low point — so server and client render the same number with no
   storage or cron involved. */

export const OFFER_TOTAL = 500;
export const OFFER_PRICE = "£4.99";

const START_SEATS = 134;
const DROP_PER_DAY = 20;
const CYCLE_DAYS = 7; // 134, 114, 94, 74, 54, 34, 14 → new batch

export function offerSeatsLeft(now: Date = new Date()): number {
  const day = Math.floor(now.getTime() / 86_400_000);
  return START_SEATS - DROP_PER_DAY * (day % CYCLE_DAYS);
}

export function offerSeatsClaimed(now: Date = new Date()): number {
  return OFFER_TOTAL - offerSeatsLeft(now);
}

export function offerClaimedPercent(now: Date = new Date()): number {
  return Math.round((offerSeatsClaimed(now) / OFFER_TOTAL) * 100);
}
