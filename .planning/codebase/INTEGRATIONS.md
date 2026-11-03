---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
# External Integrations

**Analysis Date:** 2026-11-03

Nonogram Revisited is a fully client-side, static application. There is **no backend, no API server, no database, and no server-side runtime**. All persistence is browser `localStorage`, and the only outbound network requests in the shipped app are the service worker fetching the app's own assets. Integrations are limited to build/deploy infrastructure and two dormant third-party hooks (ads + in-app billing).

## APIs & External Services

**Advertising:**
- Google AdSense — declared via a `<meta name="google-adsense-account" content="ca-pub-6409516653999633" />` tag in the site head (`packages/website/src/build.mjs:153`). **No ad script is loaded**; the repository contains no `adsbygoogle` / gtag / AdSense JavaScript. The consent banner states "no analytics or advertising cookies right now" (`packages/website/src/build.mjs:30`).

**In-App Billing:**
- Google Play Billing / Digital Goods API — used for a one-time "Remove Ads" purchase ($2.99 USD). Implemented via the browser `PaymentRequest` API with `supportedMethods: 'https://play.google.com/billing'` and `window.getDigitalGoodsService(...)` for entitlement sync (`packages/app/src/monetization/monetization.ts`). Only active when running inside a Trusted Web Activity / Android Chrome where `getDigitalGoodsService` exists; otherwise `canPurchase` is `false`.

**No other external APIs.** No analytics, no error tracking, no telemetry, no maps, no social login, no third-party SDK imports anywhere in the app or website source.

## Data Storage

**Databases:**
- None. No database client, no ORM, no connection strings.

**Client-side persistence (browser `localStorage` only):**
- Settings, saved games, library, game mode, daily stats — `packages/app/src/store.ts` (keys `nonogram.settings`, `nonogram.games`, `nonogram.library`, `nonogram.mode`, `nonogram.daily`). Documented as a contract: keys must not be renamed without migration.
- Consent flag — `nonogram.consent` (`packages/website/src/build.mjs:21`).
- Ad-free entitlement flag — `revisited_ad_free_v1` (`packages/app/src/monetization/monetization.ts:16`).
- Service worker caches — `nonogram-assets-v1` and `nonogram-pages-v1` (`packages/app/public/sw.js:6-7`), using the Cache Storage API.

**File Storage:**
- None (no uploads, no external object store). Generated site assets are emitted to `packages/website/dist` and `packages/app/dist`.

**Caching:**
- Browser service worker only (`packages/app/public/sw.js`): network-first for navigations, cache-first for hashed assets.

## Authentication & Identity

**Auth Provider:**
- None. No login, no accounts, no sessions, no OAuth. Identity is a device-local `localStorage` entitlement flag (`revisited_ad_free_v1`); no user data leaves the browser.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry/Bugsnag/analytics SDK.

**Logs:**
- Console only — `console.error` / `console.warn` in monetization code (`packages/app/src/monetization/monetization.ts`, `packages/app/src/monetization/useMonetization.ts`). No server-side logging.

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages — deployed via `cloudflare/wrangler-action@v3` in `.github/workflows/pages.yml` (`pages deploy packages/website/dist --project-name=nonogram-revisited --branch=main`). Account ID `6c9d1596276c79e822640d0a8d429c60`. Custom domain `nonogramrevisited.com` (see `CNAME`).

**CI Pipeline:**
- GitHub Actions
  - `.github/workflows/ci.yml` — runs on push and pull request: `pnpm install --frozen-lockfile`, `pnpm typecheck`, app build, `pnpm test`, website build and test (Node 22, pnpm 10).
  - `.github/workflows/pages.yml` — runs on push to `main` and manual dispatch; builds the app + website, runs website tests, then deploys to Cloudflare Pages. Optional `gate` input applies a temporary password gate using the `SITE_PASSWORD` secret.
- `main` is protected and deploys on push (`AGENTS.md`).

## Environment Configuration

**Required env vars (CI only; no local `.env` files present):**
- `SITE_URL` — `https://nonogramrevisited.com/` (set in `.github/workflows/pages.yml`; defaulted in `packages/website/src/build.mjs`).
- `CLOUDFLARE_API_TOKEN` — GitHub Actions secret for Cloudflare Pages deploy.
- `SITE_PASSWORD` — optional GitHub Actions secret for the temporary site gate.

**Secrets location:**
- GitHub Actions repository secrets (`CLOUDFLARE_API_TOKEN`, `SITE_PASSWORD`). No secrets are stored in the repository; no `.env`, `credentials.*`, or key files exist in the tree.

## Webhooks & Callbacks

**Incoming:**
- None. No webhook endpoints; the app has no server to receive requests.

**Outgoing:**
- None in runtime code. The only network fetches are the service worker (`packages/app/public/sw.js`) requesting the app's own same-origin assets, plus the `PaymentRequest`/Digital Goods calls triggered by user purchase on supported Android TWA environments.

## External Links (non-API references)

- Brand / sister sites linked from the site footer (`packages/website/src/build.mjs:192-196`): `https://revisitedlabs.com`, `https://hodokurevisited.com`, `https://logisimrevisited.com`, `https://kakurorevisited.com`, `https://dolcecolore.com`.
- Support: `mailto:support@revisitedlabs.com`; issues at `https://github.com/ntropey/nonogram_revisited/issues`.
- Structured data: `https://schema.org` JSON-LD (`Organization`, `WebSite`, `WebPage`) emitted per page.

---

*Integration audit: 2026-11-03*
