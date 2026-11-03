---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
<!-- refreshed: 2026-11-03 -->
# Architecture

**Analysis Date:** 2026-11-03

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        packages/website (static site)                     │
│   build.mjs ──► techniques.mjs / learn.mjs / manual.mjs / diagrams.mjs    │
│   emits nonogramrevisited.com pages + copies app build to /play/          │
└──────────────────────────────────────────────────────────────────────────┘
         │ (copies built app verbatim)
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     packages/app (PWA, React 19 + Vite 8)                 │
│  main.tsx ──► App.tsx (single state owner)                                │
│   ├─ components/  (Board, TopBar, ToolPad, SidePanel, HintPanel, ...)     │
│   ├─ game.ts / coach.ts / store.ts / types.ts / sound.ts                  │
│   ├─ monetization/ (AdBanner, MonetizationManager, useMonetization)       │
│   └─ solverClient.ts ──postMessage──► worker.ts ──► solverApi.ts          │
└───────────────────────────────────────┬──────────────────────────────────┘
                                        │ WorkerMessage / WorkerReply (protocol.ts)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    packages/core (pure engine, no DOM/Node)               │
│   types.ts → board.ts → lineSolver.ts → stepFinder.ts → solver.ts         │
│                                          └──────────────► generator.ts    │
│   index.ts (barrel export)                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `NonogramBoard` | Grid model, clue normalization/extraction, text/URL/JSON/`.non` serialization | `C:\dev\nonogram_revisited\packages\core\src\board.ts` |
| `solveLineDP` | Exact O(m·L) DP line solver + block range analyzer | `C:\dev\nonogram_revisited\packages\core\src\lineSolver.ts` |
| `NonogramStepFinder` | The 9 human-style techniques, ascending difficulty | `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts` |
| `analyzePuzzle` / `checkUniqueness` / `countSolutions` | Full human-step solve, uniqueness, solution count | `C:\dev\nonogram_revisited\packages\core\src\solver.ts` |
| `generatePuzzle` / `dailyPuzzle` | Seeded generator + date-seeded daily | `C:\dev\nonogram_revisited\packages\core\src\generator.ts` |
| `SolverClient` | Promise wrapper over the Web Worker channel | `C:\dev\nonogram_revisited\packages\app\src\solverClient.ts` |
| `worker.ts` | Web Worker entry; delegates to `solverApi` | `C:\dev\nonogram_revisited\packages\app\src\worker.ts` |
| `solverApi.handleRequest` | Pure message router (no DOM/Node); wraps core | `C:\dev\nonogram_revisited\packages\app\src\solverApi.ts` |
| `protocol.ts` | `WorkerMessage` / `WorkerReply` shapes shared by the three above | `C:\dev\nonogram_revisited\packages\app\src\protocol.ts` |
| `game.ts` | Pure game state: moves, win check, drag lines, mistakes | `C:\dev\nonogram_revisited\packages\app\src\game.ts` |
| `coach.ts` | Socratic Coach staging + Prover + board marks | `C:\dev\nonogram_revisited\packages\app\src\coach.ts` |
| `store.ts` | localStorage helpers (keys are a contract) | `C:\dev\nonogram_revisited\packages\app\src\store.ts` |
| `App.tsx` | Root component; single React state owner; wires everything | `C:\dev\nonogram_revisited\packages\app\src\App.tsx` |
| `build.mjs` | Dependency-free static site generator | `C:\dev\nonogram_revisited\packages\website\src\build.mjs` |
| `MonetizationManager` | Google Play Digital Goods billing + localStorage entitlement | `C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts` |

## Pattern Overview

**Overall:** pnpm monorepo with three packages (`core`, `app`, `website`) split along a strict purity boundary.

**Key Characteristics:**
- **Strict layering by purity.** `core` is pure TypeScript with no DOM/Node APIs. `app` mixes pure logic (`game.ts`, `coach.ts`, `solverApi.ts`) with React UI. `website` is a plain-`.mjs` string-literal generator.
- **Worker isolation.** All solver/generator work runs off the UI thread in a Web Worker; the app talks to it through a typed request/response protocol.
- **Single state owner.** `App.tsx` holds all app state via React hooks (no state library, no context). Children receive props/callbacks (prop drilling).
- **Deterministic engine.** 9 techniques in fixed difficulty order; seeded (`mulberry32`) generation; no randomness beyond the seed.

## Layers

**`packages/core` (engine):**
- Purpose: the entire Nonogram model and solving/generation logic.
- Location: `C:\dev\nonogram_revisited\packages\core\src\`
- Contains: `types.ts` (domain types + 9 technique metadata), `board.ts`, `lineSolver.ts`, `stepFinder.ts`, `solver.ts`, `generator.ts`, `index.ts` (barrel).
- Depends on: nothing but itself; no Node/DOM.
- Used by: `@nonogram/app` (via `@nonogram/core` workspace dependency) and, transitively, the website's manual/test checks.

**`packages/app` (PWA):**
- Purpose: React UI, game orchestration, and the worker bridge.
- Location: `C:\dev\nonogram_revisited\packages\app\src\`
- Contains: `main.tsx`, `App.tsx`, `components/`, `game.ts`, `coach.ts`, `store.ts`, `types.ts`, `sound.ts`, `protocol.ts`, `solverClient.ts`, `worker.ts`, `solverApi.ts`, `monetization/`.
- Depends on: `@nonogram/core` (engine), React, React DOM. The pure files (`game.ts`, `coach.ts`, `solverApi.ts`) import only types/functions from core.
- Used by: the browser; built to `dist/`, then copied to `/play/` by the website.

**`packages/website` (static site):**
- Purpose: generate nonogramrevisited.com pages and host the app.
- Location: `C:\dev\nonogram_revisited\packages\website\src\`
- Contains: `build.mjs` (orchestrator + page shell + inlined consent/gate scripts), `techniques.mjs`, `learn.mjs`, `manual.mjs`, `diagrams.mjs`.
- Depends on: Node built-ins only (`node:fs/promises`, `node:path`). No npm runtime deps.
- Used by: the build step (`node src/build.mjs`), and its output is deployed to Cloudflare Pages.

## Data Flow

### Primary Request Path (solve / hint / generate)

1. UI triggers an action in `App.tsx` (e.g. `handleHint`, `handleGenerate`, `handleSolve`) at `C:\dev\nonogram_revisited\packages\app\src\App.tsx`.
2. `App.tsx` calls a typed method on `SolverClient` (e.g. `solver().nextStep(...)`), which assigns a monotonically increasing `id` and posts `{ id, message }` to the worker — `C:\dev\nonogram_revisited\packages\app\src\solverClient.ts:48`.
3. `worker.ts` receives the message and forwards it to `handleRequest` — `C:\dev\nonogram_revisited\packages\app\src\worker.ts:9`.
4. `solverApi.handleRequest` routes on `message.type`, deserializes the `PuzzleDefinition` into a `NonogramBoard`, calls a core function (`analyzePuzzle`, `findNextStep`, `generatePuzzle`, `dailyPuzzle`, `countSolutions`, `traceHypothesis`), and returns a typed reply; solver exceptions become `ERROR` replies — `C:\dev\nonogram_revisited\packages\app\src\solverApi.ts:72`.
5. `SolverClient.request` resolves/rejects the pending promise by matching the reply `id` — `C:\dev\nonogram_revisited\packages\app\src\solverClient.ts:32`.
6. `App.tsx` updates React state, which `store.ts` persists to localStorage via effects.

### Secondary Flow (puzzle import / deep link)

1. `ImportModal` parses user text via `deserializePuzzle` / `parseNonogramText` (supports compact URL, JSON, `.non`, ASCII bitmap) — `C:\dev\nonogram_revisited\packages\app\src\components\ImportModal.tsx` and `C:\dev\nonogram_revisited\packages\core\src\board.ts:287`.
2. `App.handleImportBoard` solves it for a rating, stores a `StoredGame`, and sets it active — `C:\dev\nonogram_revisited\packages\app\src\App.tsx:135`.
3. Deep links `?daily=1` and `?p=...` are consumed on mount — `C:\dev\nonogram_revisited\packages\app\src\App.tsx:169`.

**State Management:**
- App state lives entirely in `App.tsx` `useState`/`useRef` (settings, games list, active game, hint, history for undo). No Redux/Zustand/context.
- Persistence is manual: `useEffect` writes `settings`, `games`, `dailyStats` through `store.ts`; undo history is kept in-memory per game (`history` record).
- The solver worker holds no persistent state — it is stateless per request.

## Key Abstractions

**`NonogramBoard`:**
- Purpose: canonical grid model with immutable-style helpers and multi-format (de)serialization.
- Examples: `C:\dev\nonogram_revisited\packages\core\src\board.ts`
- Pattern: class with readonly fields, `clone()`, `fromBitmap()`, `toDefinition()`, plus standalone serializers (`serializePuzzle`, `deserializePuzzle`, `parseNonogramText`, `exportNonogramText`).

**`solveLineDP` (line solver):**
- Purpose: single-line exact DP computing forced fills/crosses and per-block `[minStart, maxStart]` ranges. The foundation every technique builds on.
- Examples: `C:\dev\nonogram_revisited\packages\core\src\lineSolver.ts`
- Pattern: pure function returning a `LineDPResult` (validity, forced cells, covering blocks).

**`NonogramStepFinder` (techniques):**
- Purpose: `findNextStep` (lowest-difficulty step) and `findAllSteps`; plus `findLineSteps` (techniques 1–7), `findEdgeLookaheadSteps` (8), `findContradictionSteps` (9).
- Examples: `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts`
- Pattern: `findNextStep` scans every row/col, sorts by technique `score`, falls back to lookahead then contradiction.

**`SolverClient` (worker channel):**
- Purpose: promise-based typed facade over the Web Worker; `WorkerLike` interface lets tests inject a fake.
- Examples: `C:\dev\nonogram_revisited\packages\app\src\solverClient.ts`
- Pattern: request/response correlation by `id` string; `protocol.ts` defines the union types.

**`MonetizationManager` (billing):**
- Purpose: one-time `$2.99` lifetime ad removal via Google Play Digital Goods API, with a localStorage entitlement fallback.
- Examples: `C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts`
- Pattern: singleton `monetization`, listener/subscribe store, `init()` shared promise, `useMonetization` React hook.

## Entry Points

**PWA entry:**
- Location: `C:\dev\nonogram_revisited\packages\app\src\main.tsx`
- Triggers: browser load of `/play/`.
- Responsibilities: register service worker (`sw.js`) in production, mount `<App/>` into `#root`.

**Web Worker entry:**
- Location: `C:\dev\nonogram_revisited\packages\app\src\worker.ts`
- Triggers: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` from `SolverClient`.
- Responsibilities: bind `self.onmessage` to `handleRequest`.

**Engine barrel:**
- Location: `C:\dev\nonogram_revisited\packages\core\src\index.ts`
- Triggers: any `import ... from '@nonogram/core'`.
- Responsibilities: re-export `types`, `board`, `lineSolver`, `stepFinder`, `solver`, `generator`.

**Static site entry:**
- Location: `C:\dev\nonogram_revisited\packages\website\src\build.mjs`
- Triggers: `pnpm --filter @nonogram/website build`.
- Responsibilities: compose pages from `techniques.mjs`/`learn.mjs`/`manual.mjs`, copy `packages/app/dist` to `/play/`, write `sitemap.xml`/`robots.txt` when `SITE_URL` set.

## Architectural Constraints

- **Threading:** the solver/generator run in a dedicated Web Worker so the UI thread stays free; all pure engine functions are synchronous and run to completion inside the worker. `generatePuzzle` can be CPU-heavy and honors a `maxTimeMs` wall-clock budget.
- **Global state:** two module-level singletons exist: `monetization` (`C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts:325`) and the `ctx` AudioContext in `C:\dev\nonogram_revisited\packages\app\src\sound.ts:5`. All other state is component-local in `App.tsx`.
- **Circular imports:** none detected. `core` dependencies flow one way (`board` ← `lineSolver` ← `stepFinder` ← `solver`/`generator`). `app` imports `core` and its own modules with no cycles.
- **No backend / no server:** the entire product is a static site + client-side PWA. No API server, no database. Persistence is localStorage only.
- **Stored keys are a contract:** `store.ts` keys (`nonogram.settings`, `nonogram.games`, `nonogram.library`, `nonogram.mode`, `nonogram.daily`) must not be renamed without migration.

## Anti-Patterns

### Intentional logic duplication between `core` and `app`

**What happens:** `computeCluesFromLine`, `cluesEqual`, and line-slicing are reimplemented in `C:\dev\nonogram_revisited\packages\app\src\game.ts:78` even though `C:\dev\nonogram_revisited\packages\core\src\board.ts` has equivalents.
**Why it's wrong here:** it creates two sources of truth for the same rule; a bug fix in one does not propagate to the other.
**Do this instead:** keep `game.ts` self-contained (it deliberately avoids importing the full board model to stay a lightweight pure game state), but when changing clue/win logic, update both `game.ts` and `board.ts`, and rely on the shared tests to catch divergence.

### Deserialization split across two layers

**What happens:** `solverApi.ts` has its own private `deserializeBoard` (`C:\dev\nonogram_revisited\packages\app\src\solverApi.ts:83`) separate from `deserializePuzzle`/`parseNonogramText` in `C:\dev\nonogram_revisited\packages\core\src\board.ts:287`.
**Why it's wrong here:** puzzle text parsing (rich format handling) and puzzle-object reconstruction (thin constructor wrapper) are two different concerns, but the naming overlap invites misuse of the wrong one.
**Do this instead:** use `deserializePuzzle` for user-facing text/URL/JSON import; use the `NonogramBoard` constructor (or `solverApi`'s helper) for already-structured `PuzzleDefinition` objects passed across the worker.

### Large `App.tsx` with deep prop drilling

**What happens:** `App.tsx` is ~557 lines and owns ~15 state slices plus ~20 handlers; every child (`Board`, `ToolPad`, `TopBar`, `SidePanel`, …) receives a long prop list.
**Why it's wrong here:** changes to shared state ripple through many component signatures; no context/selector indirection.
**Do this instead:** keep `App.tsx` as the single state owner per the existing convention, but consider extracting cohesive slices (settings, daily stats, games) into smaller custom hooks when adding features rather than widening the prop surface further.

## Error Handling

**Strategy:** fail fast inside the engine, degrade gracefully at the UI/worker boundary.

**Patterns:**
- `NonogramBoard` throws `Error` for invalid dimensions or clue-count mismatch (`C:\dev\nonogram_revisited\packages\core\src\board.ts:101`).
- `solverApi.handleRequest` wraps `handleMessage` in try/catch and converts any throw to an `{ type: 'ERROR', payload: { message } }` reply (`C:\dev\nonogram_revisited\packages\app\src\solverApi.ts:72`).
- `store.ts` wraps every `localStorage` read/write in try/catch and returns safe defaults (`[]`, `{ ...DEFAULT_SETTINGS_EXPORT }`) on failure.
- `App.tsx` surfaces worker errors via an `error` state banner (`.notice` role=alert) and a `setError(null)` dismiss.

## Cross-Cutting Concerns

**Logging:** minimal; `console.warn`/`console.error` only in monetization paths (`C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts:127`, `useMonetization.ts:19`). No structured logger.
**Validation:** board input validation in `NonogramBoard` constructor; puzzle text validation in `deserializePuzzle`/`parseNonogramText` (dimension caps of 30×30 for text formats).
**Authentication:** none. Static site with no accounts; consent and gate are client-side scripts inlined by `build.mjs`.
**Offline:** service worker `C:\dev\nonogram_revisited\packages\app\public\sw.js` (network-first pages, cache-first hashed assets).

---

*Architecture analysis: 2026-11-03*
