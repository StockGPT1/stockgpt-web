# StockGPT Web

StockGPT is a Next.js web app for stock research workflows: AI-assisted rankings, stock research pages, portfolio tools, market news context, subscriptions and affiliate acquisition.

This repository contains the public marketing experience and authenticated app shell for `stockgpt.pro`.

## Tech stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase for authentication and app data
- Stripe for subscriptions
- Vercel Analytics

## Getting started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Then add the required Supabase and Stripe values.

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev      # Start the local development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
```

## Environment variables

The app expects environment variables for Supabase, Stripe and any server-side market data integrations. Keep secrets out of source control and use Vercel project settings for deployed environments.

Typical variables include:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRICE_ID=
```

Check the implementation before adding or renaming variables, because some routes may require additional provider keys.

## App areas

Key product areas include:

- Landing page and conversion flow
- Login and signup
- Dashboard
- Rankings
- Individual stock research pages
- Portfolio tooling
- World news and ticker impact context
- Pricing and subscription flow
- Affiliate application flow
- Legal pages and compliance footer links

## Product and compliance guardrails

StockGPT must be presented as an informational research tool, not as a financial adviser or trading signal service.

When changing copy or UI, keep these rules in mind:

- Do not imply guaranteed returns, investment advice, or personalised financial recommendations.
- Keep disclaimers visible near high-risk surfaces such as Rankings, Portfolio Alerts and Ask StockGPT.
- Use consumer-friendly wording while staying clear that users are responsible for their own decisions.
- Preserve the dark green and gold visual system unless a task explicitly calls for a redesign.
- Prioritise mobile readability, accessible focus states and clear tap targets.

## Development notes

- The landing page pulls live-ish ticker data and public ranking metrics, so failures should degrade gracefully.
- Authenticated routes should protect premium or account-only functionality server-side, not only through hidden UI.
- Avoid committing generated build output, secrets, exports or local data files.
- Keep deployment checks lightweight for now: lint and build warnings should be addressed, but avoid adding strict blockers without a product reason.

## Deployment

The app is intended to deploy on Vercel. Configure production environment variables in Vercel, then run a production build locally when making structural changes:

```bash
npm run build
```

Use preview deployments for larger UI or subscription-flow changes before merging to `main`.
