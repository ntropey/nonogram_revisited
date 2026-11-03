---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
# Technology Stack

**Analysis Date:** 2026-11-03

## Languages

**Primary:**
- TypeScript 5.6.3 — every package (`packages/core`, `packages/app`) and all tests
- JavaScript (ESM) — the service worker (`packages/app/public/sw.js`) and the website generator (`packages/website/src/*.mjs`), both deliberately plain/dependency-free

**Secondary:**
- HTML/CSS — generated as string literals by the website generator (`packages/website/src/build.mjs`); app styles in `packages/app/src/index.css`
- JSON — `manifest.json`, `tsconfig*.json`, `package.json` manifests

## Runtime

**Environment:**
- Node >= 20 for local development (declared in root `package.json` `engines`)
- Node 22 in CI and for the site build (pinned via `actions/setup-node@v7` `node-version: 22`)
- Browser for the shipped PWA (React app runs in the client; no server runtime)

**Package Manager:**
- pnpm (workspace)
- Version: pnpm 10 in CI (`pnpm/action-setup@v6` `version: 10`)
- Lockfile: `pnpm-lock.yaml` (present; CI uses `pnpm install --frozen-lockfile`)
- Workspace layout defined in `pnpm-workspace.yaml` (`packages/*`)

## Frameworks

**Core:**
- React 19.3.1 — app UI (`packages/app`)
- react-dom 19.3.1 — React renderer
- Vite 8.3.4 — app dev server and build (`packages/app/vite.config.ts`)
- @vitejs/plugin-react 4.7.0 — React JSX transform for Vite

**Testing:**
- Vitest 5.0.5 — unit tests in every package
- jsdom 26.1.0 — DOM environment for app tests (configured in `packages/app/vite.config.ts`)

**Build/Dev:**
- TypeScript 5.6.3 — type checking (`tsc --noEmit`) across packages
- esbuild 0.28.2 — root dev tool (allowed build in `pnpm-workspace.yaml` `allowBuilds`)
- No bundler for `packages/core` (consumed as TypeScript source via `workspace:*`); no bundler for `packages/website` (plain `.mjs` run by Node)

## Key Dependencies

**Critical:**
- `@nonogram/core` (workspace) — the solving engine, imported by the app (`packages/app/package.json` `"@nonogram/core": "workspace:*"`); the single runtime dependency the app ships besides React

**Infrastructure:**
- `@types/node` 22.9.0 — Node type stubs for core tests
- `@types/react` 19.3.0 / `@types/react-dom` 19.3.0 — React type stubs

**Notable omissions:**
- No database client, no HTTP client, no state-management library, no UI component library, no CSS framework, no bundler beyond Vite/esbuild, no router. The app state is plain React + localStorage; the site generator is deliberately dependency-free.

## Configuration

**Environment:**
- `SITE_URL` — canonical base URL for the website build; set to `https://nonogramrevisited.com/` in CI; defaulted in `packages/website/src/build.mjs` (`process.env.SITE_URL || 'https://nonogramrevisited.com'`). Drives `sitemap.xml`, `robots.txt`, canonical links, Open Graph image, and JSON-LD.
- `SITE_PASSWORD` — optional repository secret for a temporary password gate (workflow-dispatch `gate` input in `.github/workflows/pages.yml`).
- `CLOUDFLARE_API_TOKEN` — Cloudflare Pages deploy credential (`secrets.CLOUDFLARE_API_TOKEN`).
- `import.meta.env.PROD` / `import.meta.env.BASE_URL` — Vite build-time flags used for service-worker registration (`packages/app/src/main.tsx`).
- No `.env` or `.env.*` files are present in the repository.

**Build:**
- `tsconfig.base.json` — shared compiler config: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `isolatedModules`, `esModuleInterop`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `skipLibCheck`, `noUncheckedIndexedAccess: false`.
- `packages/app/vite.config.ts` — `base: '/play/'`, output to `packages/app/dist`, `test.environment: 'jsdom'`, dev port 5173.
- `packages/core/vitest.config.ts` — includes `test/**/*.test.ts`, 120s timeouts.
- `packages/website/vitest.config.ts` — includes `test/**/*.test.mjs`, `fileParallelism: false` (each test rebuilds `dist`).
- `packages/website/package.json` `typecheck` script runs `node --check` over each `.mjs` file (no tsc).

## Platform Requirements

**Development:**
- Node >= 20 (Node 22 recommended to match CI), pnpm 10, git
- Windows/macOS/Linux; all commands run from the repo root

**Production:**
- Static hosting on Cloudflare Pages (project `nonogram-revisited`, account `6c9d1596276c79e822640d0a8d429c60`), custom domain `nonogramrevisited.com` (`CNAME`)
- Client-side only: no server, no database, no backend process

---

*Stack analysis: 2026-11-03*
