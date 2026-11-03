---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
# Codebase Structure

**Analysis Date:** 2026-11-03

## Directory Layout

```
nonogram_revisited/
├── .github/
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci.yml                      # pnpm typecheck + build + test on push/PR
│       └── pages.yml                   # build + deploy to Cloudflare Pages on main
├── docs/
│   ├── LICENSE-AUDIT.md
│   └── PORT-PLAN.md                    # status and roadmap
├── packages/
│   ├── core/                           # pure engine (TypeScript, no DOM/Node)
│   │   ├── package.json                # @nonogram/core, workspace package
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts                # barrel export
│   │   │   ├── types.ts                # domain types + 9 technique metadata
│   │   │   ├── board.ts                # NonogramBoard model + serialization
│   │   │   ├── lineSolver.ts           # solveLineDP + completed-clue detection
│   │   │   ├── stepFinder.ts           # 9 human-style techniques
│   │   │   ├── solver.ts               # analyze/verify/count
│   │   │   └── generator.ts            # seeded + daily generator
│   │   └── test/
│   │       ├── core.test.ts
│   │       └── stepFinder.test.ts
│   ├── app/                            # PWA (React 19 + Vite 8)
│   │   ├── package.json                # @nonogram/app
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts              # base '/play/', jsdom test env
│   │   ├── index.html
│   │   ├── public/                     # icons, manifest.json, sw.js, og-image
│   │   ├── scripts/make-png-icons.py
│   │   └── src/
│   │       ├── main.tsx                # PWA entry
│   │       ├── App.tsx                 # root component, single state owner
│   │       ├── index.css
│   │       ├── game.ts                 # pure game state
│   │       ├── coach.ts                # Coach/Prover helpers
│   │       ├── store.ts                # localStorage helpers
│   │       ├── types.ts                # UI types + settings
│   │       ├── sound.ts                # WebAudio cues
│   │       ├── protocol.ts             # worker message shapes
│   │       ├── solverClient.ts         # worker promise facade
│   │       ├── solverApi.ts            # pure message router
│   │       ├── worker.ts               # worker entry
│   │       ├── components/
│   │       │   ├── Board.tsx           # grid + clues + drag painting
│   │       │   ├── TopBar.tsx          # brand, mode, settings popover
│   │       │   ├── ToolPad.tsx         # tools, solve/hint/undo/reset
│   │       │   ├── SidePanel.tsx       # game list + settings
│   │       │   ├── HintPanel.tsx       # staged hint / proof display
│   │       │   ├── SolvedModal.tsx     # win modal + daily stats
│   │       │   ├── ImportModal.tsx     # puzzle import
│   │       │   └── AnalyzePanel.tsx    # step-by-step analysis view
│   │       └── monetization/
│   │           ├── monetization.ts     # MonetizationManager singleton
│   │           ├── useMonetization.ts  # React hook
│   │           └── AdBanner.tsx        # ad placement component
│   └── website/                        # static site generator (plain .mjs)
│       ├── package.json                # @nonogram/website, no runtime deps
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── build.mjs               # orchestrator + page shell + consent/gate
│       │   ├── techniques.mjs          # technique guide pages
│       │   ├── diagrams.mjs            # inline SVG line-deduction diagrams
│       │   ├── learn.mjs               # Learn pages
│       │   └── manual.mjs              # app manual
│       └── test/
│           ├── site.test.mjs
│           └── website.test.mjs
├── .gitignore
├── AGENTS.md                           # agent conventions (read first)
├── CNAME
├── LICENSE                             # GPL-3.0-or-later
├── README.md
├── package.json                        # root scripts (test, typecheck)
├── pnpm-lock.yaml
├── pnpm-workspace.yaml                 # packages/* workspace
└── tsconfig.base.json                  # shared strict TS config
```

## Directory Purposes

**`packages/core`:**
- Purpose: the deterministic engine; pure TypeScript with no DOM/Node APIs.
- Contains: board model, line DP solver, step finder, solver, generator.
- Key files: `C:\dev\nonogram_revisited\packages\core\src\index.ts` (barrel), `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts` (836 lines, the techniques), `C:\dev\nonogram_revisited\packages\core\src\board.ts` (404 lines, serialization).

**`packages/app/src`:**
- Purpose: the PWA UI and game orchestration.
- Contains: React components, pure game/coach logic, worker bridge, storage, monetization.
- Key files: `C:\dev\nonogram_revisited\packages\app\src\App.tsx` (557 lines, state owner), `C:\dev\nonogram_revisited\packages\app\src\components\Board.tsx` (312 lines), `C:\dev\nonogram_revisited\packages\app\src\game.ts` (172 lines).

**`packages/app/src/components`:**
- Purpose: presentational React components; each receives props/callbacks from `App.tsx`.
- Contains: `Board`, `TopBar`, `ToolPad`, `SidePanel`, `HintPanel`, `SolvedModal`, `ImportModal`, `AnalyzePanel`.
- Key files: `C:\dev\nonogram_revisited\packages\app\src\components\Board.tsx`.

**`packages/app/src/monetization`:**
- Purpose: ad-free entitlement and Google Play billing.
- Contains: `MonetizationManager` (singleton), `useMonetization` hook, `AdBanner`.
- Key files: `C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts`.

**`packages/app/public`:**
- Purpose: static web assets and the service worker.
- Contains: `manifest.json`, PWA icons, `og-image.png`, `sw.js` (plain JS), `sw.d.ts`.
- Key files: `C:\dev\nonogram_revisited\packages\app\public\sw.js`.

**`packages/website/src`:**
- Purpose: generate the marketing/learn site and host the app build.
- Contains: `build.mjs` + content modules.
- Key files: `C:\dev\nonogram_revisited\packages\website\src\build.mjs` (339 lines).

**`docs`:**
- Purpose: project status and license audit.
- Key files: `C:\dev\nonogram_revisited\docs\PORT-PLAN.md`, `C:\dev\nonogram_revisited\docs\LICENSE-AUDIT.md`.

**`.github/workflows`:**
- Purpose: CI (`ci.yml`) and deploy (`pages.yml`).
- Key files: `C:\dev\nonogram_revisited\.github\workflows\pages.yml`.

## Key File Locations

**Entry Points:**
- `C:\dev\nonogram_revisited\packages\app\src\main.tsx`: PWA entry.
- `C:\dev\nonogram_revisited\packages\app\src\worker.ts`: Web Worker entry.
- `C:\dev\nonogram_revisited\packages\core\src\index.ts`: engine barrel export.
- `C:\dev\nonogram_revisited\packages\website\src\build.mjs`: static site entry.

**Configuration:**
- `C:\dev\nonogram_revisited\tsconfig.base.json`: shared strict TS settings.
- `C:\dev\nonogram_revisited\pnpm-workspace.yaml`: workspace globs (`packages/*`).
- `C:\dev\nonogram_revisited\packages\app\vite.config.ts`: Vite build (`base: '/play/'`) + vitest jsdom config.
- `C:\dev\nonogram_revisited\packages\core\vitest.config.ts` and `C:\dev\nonogram_revisited\packages\website\vitest.config.ts`: per-package test configs.

**Core Logic:**
- `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts`: the 9 solving techniques.
- `C:\dev\nonogram_revisited\packages\core\src\lineSolver.ts`: the DP line solver.
- `C:\dev\nonogram_revisited\packages\core\src\generator.ts`: seeded generation + daily.

**App Logic:**
- `C:\dev\nonogram_revisited\packages\app\src\App.tsx`: orchestration and state.
- `C:\dev\nonogram_revisited\packages\app\src\game.ts`: pure game rules.
- `C:\dev\nonogram_revisited\packages\app\src\coach.ts`: Coach/Prover.

**Testing:**
- `C:\dev\nonogram_revisited\packages\core\test\core.test.ts`, `stepFinder.test.ts`.
- `C:\dev\nonogram_revisited\packages\app\src\game.test.ts`, `coach.test.ts`, `solverClient.test.ts`, `features.test.ts` (co-located with source).
- `C:\dev\nonogram_revisited\packages\website\test\site.test.mjs`, `website.test.mjs`.

## Naming Conventions

**Files:**
- Camel-case TS modules: `lineSolver.ts`, `stepFinder.ts`, `solverClient.ts`, `solverApi.ts`, `useMonetization.ts`.
- React components are PascalCase `.tsx`: `Board.tsx`, `TopBar.tsx`, `HintPanel.tsx`.
- Test files co-located as `*.test.ts` / `*.test.tsx` (app) or in a `test/` dir with `*.test.ts` / `*.test.mjs` (core, website).
- Website content modules are lowercase `.mjs`: `techniques.mjs`, `learn.mjs`, `manual.mjs`, `diagrams.mjs`.

**Directories:**
- Lowercase package dirs: `core`, `app`, `website`.
- `components/` and `monetization/` under `app/src`; `test/` under `core` and `website`.

**Types vs. values:**
- `types.ts` files re-export/define shared types and are imported with `import type` where possible.

## Where to Add New Code

**New engine capability (new solving technique, new generator behavior):**
- Add logic to `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts` (techniques) or `C:\dev\nonogram_revisited\packages\core\src\generator.ts` (generation).
- Add/update domain types in `C:\dev\nonogram_revisited\packages\core\src\types.ts`.
- Re-export from `C:\dev\nonogram_revisited\packages\core\src\index.ts` if it must be public.
- Tests: `C:\dev\nonogram_revisited\packages\core\test\` (e.g. `stepFinder.test.ts`).

**New app feature or screen:**
- Add a presentational component in `C:\dev\nonogram_revisited\packages\app\src\components\` (PascalCase `.tsx`), wired via props from `C:\dev\nonogram_revisited\packages\app\src\App.tsx`.
- Pure game rules go in `C:\dev\nonogram_revisited\packages\app\src\game.ts`; Coach/Prover text and marks go in `C:\dev\nonogram_revisited\packages\app\src\coach.ts`.
- Shared UI types go in `C:\dev\nonogram_revisited\packages\app\src\types.ts`.
- Tests: co-located `*.test.ts`/`*.test.tsx` next to the source file.

**New worker message (new solver operation):**
- Add the message/reply union in `C:\dev\nonogram_revisited\packages\app\src\protocol.ts`.
- Handle it in `C:\dev\nonogram_revisited\packages\app\src\solverApi.ts` (`handleMessage`).
- Expose it on `SolverClient` in `C:\dev\nonogram_revisited\packages\app\src\solverClient.ts`.
- Keep all three in sync; test via `C:\dev\nonogram_revisited\packages\app\src\solverClient.test.ts`.

**New persistent setting or stored value:**
- Add the field to `AppSettings`/`StoredGame` in `C:\dev\nonogram_revisited\packages\app\src\types.ts` and `DEFAULT_SETTINGS` (in both `types.ts` and `store.ts`).
- Add read/write helpers in `C:\dev\nonogram_revisited\packages\app\src\store.ts` — do not rename existing keys (`nonogram.*`) without a migration.

**New website page:**
- Add a content module under `C:\dev\nonogram_revisited\packages\website\src\` (mirror `learn.mjs`/`techniques.mjs`), then register its page(s) in `C:\dev\nonogram_revisited\packages\website\src\build.mjs` (the `pages` array).
- Keep the manual (`C:\dev\nonogram_revisited\packages\website\src\manual.mjs`) in step with any app behavior change; the website tests assert keyboard shortcuts and technique diagrams against `App.tsx` and the engine.

**New billing provider:**
- Extend `C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts` (`MonetizationManager`), keeping the `DigitalGoodsService` interface; update `useMonetization.ts` only if new state must surface.

## Special Directories

**`packages/app/public`:**
- Purpose: static PWA assets copied verbatim into the build.
- Generated: `scripts/make-png-icons.py` regenerates PNG icons from `icon.svg`.
- Committed: yes.

**`packages/app/dist` / `packages/website/dist`:**
- Purpose: build outputs (Vite build for app, generated site for website).
- Generated: yes.
- Committed: no (git-ignored); the website `dist` is the deploy artifact for Cloudflare Pages.

**`.planning/`:**
- Purpose: GSD planning artifacts (including this codebase map).
- Generated: yes.
- Committed: yes (tracked by the workflow).

---

*Structure analysis: 2026-11-03*
