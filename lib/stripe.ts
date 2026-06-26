import Stripe from "stripe";

/**
 * Shared Stripe client singleton.
 *
 * Instantiating Stripe inside a route handler creates a new HTTP agent on
 * every request. Using a module-level singleton reuses the agent across
 * warm invocations on the same serverless instance.
 *
 * The client is created lazily on first use so that the build can complete
 * without STRIPE_SECRET_KEY set (e.g. in CI). At runtime, any attempt to
 * use Stripe without the key will throw immediately with a clear message.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. " +
        "Add it to your .env.local or Vercel project settings.",
    );
  }

  _stripe = new Stripe(key);
  return _stripe;
}

/**
 * Convenience export — use this in route handlers.
 * It's a getter so it initialises lazily on first property access.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
