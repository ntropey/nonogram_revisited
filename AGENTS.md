# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. Read this before making
changes.

## What this is

Nonogram Revisited is a modern TypeScript Nonogram (Picross / Griddlers) solver, generator, trainer,
and analyzer inspired by classic open-source Java tools (**FreeNono** and **NonogramSolver**). It
combines a 100% deterministic human-step solving engine with a responsive Progressive Web App, a
4-stage Socratic AI Coach, and a "Why not fill / Why not cross out?" Contradiction Prover.
Licensed **GPL-3.0-or-later**.

## Repository layout

pnpm workspace, Node >= 20 (CI and the site build use Node 22), TypeScript, ESM throughout.

- `packages/core` — the engine. Pure TypeScript: **no DOM, no Node APIs.** Nonogram board model,
  line solver, human-style technique step finder, uniqueness verifier, difficulty rater, and
  date-seeded generator.
- `packages/app` — the PWA (React 19 + Vite 8). The app UI; runs the solver/generator in a Web Worker.
  `src/components/` holds the UI pieces (top bar, board, tool pad, hint panel, side panel), `game.ts`
  the pure game state, `coach.ts` the Coach/Prover logic, `store.ts` the localStorage helpers,
  `types.ts` settings and shared types, `public/sw.js` the service worker (plain JavaScript).
- `packages/website` — a dependency-free static site generator (plain `.mjs`). Pages: home, the
  technique guides (`techniques.mjs`, with inline SVG diagrams from `diagrams.mjs`), the Learn pages
  (`learn.mjs`), the manual (`manual.mjs`), about/privacy, and the app copied to `/play/`.
- `docs/` — `PORT-PLAN.md` (status and roadmap), `LICENSE-AUDIT.md`.

## Common commands

Run from the repository root:

```sh
pnpm install
pnpm typecheck                                    # tsc across packages; node --check for the website
pnpm test                                         # every package
pnpm --filter @nonogram/core test
pnpm --filter @nonogram/app test
pnpm --filter @nonogram/app dev                   # dev server
pnpm --filter @nonogram/app build                 # tsc + vite build -> packages/app/dist
pnpm --filter @nonogram/website build             # site, including the app -> packages/website/dist
pnpm --filter @nonogram/website test              # builds the site, then asserts on the output
```

`SITE_URL=https://nonogramrevisited.com/` is set in CI for the website build (it writes `sitemap.xml`
and `robots.txt`).

Before finishing a change, run `pnpm typecheck` and `pnpm test`, and the affected package's `build`.

## Architecture notes

- **Deterministic human-step solver.** `packages/core` implements 9 human-style solving techniques in
  strict order of difficulty, verifying unique solutions without guessing when possible and rating
  every puzzle deterministically.
- **App/worker split.** The app talks to the solver through `packages/app/src/solverClient.ts` →
  `worker.ts` → `solverApi.ts`. Keep `solverApi.ts` pure and testable; keep the message shapes in
  `protocol.ts` in sync across all three.
- **Game logic is pure.** `packages/app/src/game.ts` is pure and unit-tested; keep UI concerns out of
  it.
- **The website is generated.** `packages/website/src/build.mjs` writes every page from string
  literals and emits no separate JS assets (the consent and gate scripts are string constants in `build.mjs`, inlined into each page).
  `/play/` is the app's own Vite build copied verbatim.
- **The manual documents the app.** `packages/website/src/manual.mjs` must be kept in step with the
  app's behavior. A website test checks its keyboard shortcuts against `App.tsx`, and that every
  technique diagram shows a deduction the engine really makes.
- **Stored values are a contract.** Settings, saved games, the library and the game mode live in the
  browser's localStorage. Do not rename stored keys without migration.
- **The service worker** (`packages/app/public/sw.js`) fetches pages network-first and hashed assets
  cache-first, so a deploy shows on the next visit and the app works offline.
- **Ads load only after consent.** The consent script in `build.mjs` adds the consent banner and Google Consent Mode v2
  loader to every site page.

## Coding conventions

- TypeScript `strict` (see `tsconfig.base.json`). Prefer named exports.
- Style: **2-space indent, single quotes, semicolons.** Match the surrounding code, and keep comments
  purposeful.
- No new runtime dependencies without a clear reason; the website is deliberately dependency-free.
- UI text is in **American spelling** (color, practicing, behavior, center, labeled). A website test
  fails if British spellings appear in the app, website, docs or README.

## Git and pull requests

- **`main` deploys and is protected.** Every push to `main` runs `.github/workflows/pages.yml` and
  publishes to https://nonogramrevisited.com/. Do not commit or push to `main` directly; changes go
  through a pull request with a passing `test` check.
- Commit subjects read `Area: summary`, lowercase after the colon (e.g. `Core: …`, `App: …`,
  `Website: …`, `Docs: …`).
- Keep the committer email a GitHub no-reply address; do not commit work or private addresses.
