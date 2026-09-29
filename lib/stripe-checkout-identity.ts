export type StripeCheckoutIdentityDecision =
  | { kind: "manage_existing" }
  | {
      kind: "create_checkout";
      customerParameters:
        | { customer: string; customer_email?: never }
        | { customer?: never; customer_email: string };
    };

type StripeCheckoutIdentityInput = {
  email: string;
  hasActiveEntitlement: boolean;
  stripeCustomerId: string | null | undefined;
};

export function resolveStripeCheckoutIdentity({
  email,
  hasActiveEntitlement,
  stripeCustomerId,
}: StripeCheckoutIdentityInput): StripeCheckoutIdentityDecision {
  if (hasActiveEntitlement) {
    return { kind: "manage_existing" };
  }

  const existingCustomerId = stripeCustomerId?.trim();

  return {
    kind: "create_checkout",
    customerParameters: existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: email },
  };
}
