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

The web application uses Node 24. Select it through `.nvmrc`, then install the
locked dependency tree:

```bash
nvm use
npm ci
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Use `.env.example` as the source of truth. Add only local, test or staging
values needed for the feature you are exercising. Never commit secrets or use
the production Supabase service-role credential for ordinary development.

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

The local quality gate is:

```bash
npm run lint
npx next typegen
npx tsc --noEmit
npm run test:portfolio
npm run build
```

Compilation and production builds must not require production credentials.
Runtime integrations still require their corresponding safe local/test values.

## Environment variables

See `.env.example` for the factual current variable inventory, public/server
boundaries, optional providers and tuning controls. Keep secrets out of source
control and use environment-scoped Vercel settings for deployed environments.

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
- Run the complete local quality gate before proposing structural changes.

## Deployment

The app is intended to deploy on Vercel. Configure production environment variables in Vercel, then run a production build locally when making structural changes:

```bash
npm run build
```

Use preview deployments for larger UI or subscription-flow changes before merging to `main`.
