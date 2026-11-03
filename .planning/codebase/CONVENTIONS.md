---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
# Coding Conventions

**Analysis Date:** 2026-11-03

## Naming Patterns

**Files:**
- Lowercase camelCase for pure-logic and helper modules: `game.ts`, `coach.ts`, `store.ts`, `solverApi.ts`, `solverClient.ts`, `lineSolver.ts`, `stepFinder.ts`.
- PascalCase for React components: `App.tsx`, `Board.tsx`, `ToolPad.tsx`, `HintPanel.tsx`, `SidePanel.tsx`, `TopBar.tsx`, `AnalyzePanel.tsx`, `ImportModal.tsx`, `SolvedModal.tsx`, `AdBanner.tsx`.
- Test files are co-located next to the module under test as `*.test.ts` / `*.test.tsx` in `packages/app/src`, and in a `test/` directory for `packages/core` and `packages/website`.
- Website modules use `.mjs`: `build.mjs`, `diagrams.mjs`, `techniques.mjs`, `learn.mjs`, `manual.mjs`.

**Functions:**
- camelCase: `createGame`, `setCell`, `toggleCell`, `computeCluesFromLine`, `findMistakes`, `handleRequest`, `coachText`, `lineCells`.
- Verb-first for mutating actions; noun/question for queries: `isSolved`, `unknownCount`, `completedLines`, `countSolutions`.
- Boolean predicates prefixed with `is` / `has` / `can`: `isInteresting`, `isSolved`, `hasGame`, `canUndo`.
- Factory helpers use `create`/`from`: `createGame`, `NonogramBoard.fromBitmap`.

**Variables:**
- camelCase. Short loop indices `r`, `c`, `i` for row/column/index. Flat cell index is `r * width + c`; variables named `cell` hold flat indices.
- Constants are SCREAMING_SNAKE_CASE: `SETTINGS_KEY`, `GAMES_KEY`, `LIBRARY_KEY`, `MODE_KEY`, `DAILY_KEY`, `DEFAULT_SETTINGS`, `COACH_STAGES`, `LEVEL_NAMES`, `TECHNIQUES_META`, `TECHNIQUE_BY_TYPE`, `SITE_URL`.

**Types:**
- `interface` for object shapes: `GameState`, `AppSettings`, `StoredGame`, `PuzzleDefinition`, `SolutionStep`, `StepMarks`.
- `type` for unions and aliases: `CellState`, `GameMode`, `TechniqueType`, `DifficultyLevel`, `Hint`, `Tool`, `PaintMode`, `WorkerMessage`, `WorkerReply`.
- Narrow literal unions rather than `string`/`number` where the domain is finite: `CellState = -1 | 0 | 1`, `LineAxis = 'row' | 'col'`, `GameMode = 'play' | 'train' | 'analyze'`, `DifficultyLevel = 1 | 2 | 3 | 4 | 5`.
- Discriminated unions for message/state shapes: `WorkerMessage`, `WorkerReply`, `Hint` (each member carries a `type`/`kind` tag).
- Props interfaces are named `<Component>Props`: `ToolPadProps`.

## Code Style

**Formatting:**
- No Prettier/ESLint config at repo root — style is enforced by hand and convention (documented in `AGENTS.md`).
- 2-space indent, single quotes, semicolons. Trailing commas in multi-line object/array/argument literals.
- Max line width not enforced; long string literals and long function signatures are wrapped with each argument on its own line (see `ToolPadProps` in `packages/app/src/components/ToolPad.tsx`).

**Linting:**
- No linter configured. Correctness is enforced by TypeScript `strict` and the typecheck script instead.
- TypeScript version pinned `~5.6.3`. Compiler options in `tsconfig.base.json`: `strict: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `isolatedModules: true`, `forceConsistentCasingInFileNames: true`, target `ES2022`, module `ESNext`, moduleResolution `Bundler`.
- `noUncheckedIndexedAccess` is `false` (indexed access is not treated as possibly-undefined).

**Comments:**
- Every source file opens with a license banner:
  ```ts
  /*
   * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
   * <one-line purpose of the file>
   */
  ```
- `/** ... */` JSDoc on exported functions/interfaces explaining intent and edge cases, e.g. `paintCells` documents "Returns the same game when nothing changed", `computeCluesFromLine` documents the empty-line-`[0]` rule.
- Comments stay purposeful — explain *why*, not *what*. See inline comments in `packages/core/src/stepFinder.ts` and `packages/app/src/game.ts`.

## Import Organization

**Order:**
1. External/bare-specifier imports first (`react`, `@nonogram/core`, `@vitejs/plugin-react`).
2. Node built-ins next, `node:`-prefixed: `node:path`, `node:fs/promises`.
3. Relative imports last (`./game`, `../src/index`, `../../core/src/index`).

**Path Aliases:**
- No path aliases. Cross-package imports use the workspace package name `@nonogram/core` (declared in `packages/app/package.json` as `"@nonogram/core": "workspace:*"`).
- Within a package, imports are relative: `./game`, `./types`, `../game` from components.

**Type-only imports:**
- `import type { ... }` is used consistently for types, separated from value imports. Example in `packages/app/src/types.ts` and `packages/app/src/solverApi.ts`.

**Barrel re-exports:**
- `packages/core/src/index.ts` re-exports every core module: `export * from './types'; export * from './board'; ...`. Consumers import the public surface from `@nonogram/core` only.
- `packages/app/src/types.ts` re-exports `StoredGame`, `StoredSettings` from `store.ts` to consolidate the public type surface.

## Module Design

**Exports:**
- Prefer **named exports**. No default exports in source modules (the `defineConfig` default export appears only in `vite.config.ts` / `vitest.config.ts` config files).
- Pure functions exported individually rather than bundled into a namespace object.

**Classes:**
- Used only where state + methods is the natural model: `NonogramBoard` (`packages/core/src/board.ts`), `NonogramStepFinder` (`packages/core/src/stepFinder.ts`), `SolverClient` (`packages/app/src/solverClient.ts`).
- Classes use `readonly` fields, defensive copies on construction (`[...def.cells]`), and a `clone()` returning a new instance. `NonogramBoard.setCell`/`setLineCell` are the only in-place mutators; the app's `game.ts` layer is fully immutable (returns new `GameState`).

**Purity split:**
- `packages/core` is pure TypeScript — no DOM, no Node APIs. Documented in `AGENTS.md` and enforced by the `lib: ["ES2022"]` tsconfig (no DOM lib).
- `packages/app/src/game.ts`, `coach.ts`, `solverApi.ts` are pure and unit-tested; UI and storage concerns live in `components/` and `store.ts` respectively.

## Error Handling

**Patterns:**
- Throw `Error` with descriptive messages for programmer/invariant errors: `NonogramBoard` constructor throws `Invalid board dimensions` and `Clue count mismatch`.
- Return `null` for "no result" conditions rather than throwing: `deserializePuzzle` returns `NonogramBoard | null`, `NonogramStepFinder.findNextStep` returns `SolutionStep | null`, `traceHypothesis` returns `ContradictionTrace | null`, `parseCellName` returns `{...} | null`.
- Wrap untrusted parsing and storage access in `try/catch` with silent fallback to a safe default: `loadSettings`, `loadGames`, `loadMode`, `loadDailyStats` all catch and return defaults (`packages/app/src/store.ts`). Comments note the fallback reason (e.g. "Quota exceeded or private mode").
- Worker request handling converts thrown errors to an `ERROR` reply envelope: `handleRequest` in `packages/app/src/solverApi.ts` catches and returns `{ type: 'ERROR', payload: { message } }`; `SolverClient` rejects the pending promise with that error.

## Logging

**Framework:** `console` only (no logging library).

**Patterns:**
- `console.warn` / `console.error` for non-critical background failures, prefixed with the source module in brackets: `[useMonetization] Background sync error:`, `[Monetization] Listener error:`.
- `console.log` for build-tool output only: `Built N pages to ...` in `packages/website/src/build.mjs`.
- No logging in `packages/core` (pure engine). Errors surface as return values (`null`, `valid: false`) or thrown exceptions.

## Function Design

**Size:** Small, single-purpose. Core solver helpers are short; `findLineSteps` / `analyzePuzzle` orchestrate many small helpers. Long functions are the exception (parsing in `board.ts`, site generation in `build.mjs`).

**Parameters:**
- Prefer positional args for 1-3 params; objects for 4+ or optional params. Options objects are typed interfaces (`GenerateOptions`, board constructor `def` object).
- Optional parameters use default values or `?`; trailing defaults like `title = ''`, `limit = 2`.

**Return Values:**
- Prefer typed returns and explicit `return` over fallthrough. Discriminated union results where a state carries a tag (`WorkerReply`, `Hint`).
- Return the same object identity when nothing changed (immutability short-circuit): `paintCells` returns `game` unchanged; `autoCrossCompleted` returns `game` unchanged.

## React Conventions

**Components:**
- Function components only (no class components), named exports: `export function ToolPad(...)`.
- Props typed via an `interface <Name>Props`. Destructure props in the signature. Callbacks named `on<Event>`: `onGenerate`, `onSolve`, `onHint`, `onUndo`, `onReset`, `onSetSettings`, `onSetTool`.
- `useState` for local component state. No global state library — settings/games flow through props from `App.tsx`.

**Accessibility:**
- Buttons carry `title` (tooltip) and `aria-pressed`/`aria-label`/`role` where relevant. Segmented controls use `role="group"` with an `aria-label`.

**Styling:**
- Class names in `kebab-case` (`toolpad`, `toolpad-group`, `segmented`), plain CSS in `index.css` (no CSS-in-JS, no Tailwind).

## Git and Commit Conventions

- Commit subjects read `Area: summary`, lowercase after colon (`Core: …`, `App: …`, `Website: …`, `Docs: …`). Documented in `AGENTS.md`.
- `main` is protected and deploys; changes go through PRs with a passing `test` check (`.github/workflows/ci.yml`).
- Committer email must be a GitHub no-reply address.

---

*Convention analysis: 2026-11-03*
