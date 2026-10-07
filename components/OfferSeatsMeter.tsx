import { OFFER_PRICE, STANDARD_MONTHLY_PRICE } from "@/lib/limited-offer";

export function OfferSeatsMeter() {
  return (
    <div className="mx-auto mt-3 w-full max-w-md rounded-2xl border border-[#ddb159]/30 bg-[#ddb159]/8 px-4 py-3 text-left">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
        Founding offer — {OFFER_PRICE}/month
      </p>
      <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-[#faf6f0]/62">
        Full Core access at the founding monthly rate. Standard monthly pricing is {STANDARD_MONTHLY_PRICE}.
        Review the billing summary before continuing to Stripe.
      </p>
    </div>
  );
}
