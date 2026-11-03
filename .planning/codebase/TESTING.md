---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
# Testing Patterns

**Analysis Date:** 2026-11-03

## Test Framework

**Runner:**
- Vitest `^5.0.5` across all three packages.
- Core config: `packages/core/vitest.config.ts` (include `test/**/*.test.ts`, `testTimeout`/`hookTimeout` 120_000).
- App config: inline in `packages/app/vite.config.ts` (`environment: 'jsdom'`, include `src/**/*.test.ts` and `src/**/*.test.tsx`).
- Website config: `packages/website/vitest.config.ts` (include `test/**/*.test.mjs`, `fileParallelism: false` because each file rebuilds `dist`).

**Assertion Library:**
- Vitest's bundled `expect` (no separate library).

**Run Commands:**
```sh
pnpm test                                              # every package (-r)
pnpm --filter @nonogram/core test                      # vitest run
pnpm --filter @nonogram/app test                       # vitest run
pnpm --filter @nonogram/website test                   # builds site, then asserts output
pnpm typecheck                                         # tsc across packages; node --check for website
```
- Website `pretest` runs `pnpm --filter @nonogram/app build` first so `/play/` output exists.
- CI (`.github/workflows/ci.yml`) runs: `pnpm typecheck` → app build → `pnpm test` → website build → website test.

## Test File Organization

**Location:**
- `packages/core`: separate `test/` directory — `test/core.test.ts`, `test/stepFinder.test.ts`.
- `packages/app`: co-located with source — `src/game.test.ts`, `src/coach.test.ts`, `src/solverClient.test.ts`, `src/features.test.ts`.
- `packages/website`: separate `test/` directory — `test/website.test.mjs`, `test/site.test.mjs`.

**Naming:**
- Source module `game.ts` → test `game.test.ts`. Website tests use `.test.mjs`.

**Structure:**
```
packages/core/
├── src/*.ts
└── test/core.test.ts          # groups: solveLineDP, board, solver+generator, generator quality
packages/app/
├── src/game.ts
├── src/game.test.ts           # co-located
└── src/components/*.tsx
packages/website/
├── src/*.mjs
└── test/website.test.mjs      # integration: builds site, asserts output
```

## Test Structure

**Suite Organization:**
```ts
import { describe, expect, it } from 'vitest';
import { solveLineDP } from '../src/index';

describe('solveLineDP', () => {
  it('fills overlap', () => {
    const r = solveLineDP([4], [0, 0, 0, 0, 0, 0]);
    expect(r.forced).toEqual([0, 0, 1, 1, 0, 0]);
  });
});
```

**Patterns:**
- `describe` groups by unit or feature; nested `describe` by behavior (`findLineSteps - FULL_ZERO_LINE`, `NonogramStepFinder.findNextStep`, `analyzePuzzle integration`).
- `it` describes the expected outcome in prose ("fills overlap", "crosses a zero line", "reports multiple solutions for an ambiguous board").
- Assertions use `expect(value).toBe`, `.toEqual`, `.toContain`, `.toMatch`, `.toThrow`, `.rejects.toThrow`; async awaits the promise before asserting.
- Setup is inline per-test (construct a board/`GameState` directly); shared fixtures defined as module-level helper functions rather than `beforeEach` (e.g. `board(...)` in `stepFinder.test.ts`, `loopbackWorker()` in `solverClient.test.ts`).
- Teardown is explicit only for the worker (`terminate()`); no global teardown hooks.

## Mocking

**Framework:** No `vi.mock`. Real implementations plus small injected fakes.

**Patterns:**
- `SolverClient` accepts an injected `WorkerLike` (the slice of `Worker` it needs) so tests pass a fake that runs the real `handleRequest` handler synchronously-ish:
```ts
function loopbackWorker(): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(request: WorkerRequest) {
      queueMicrotask(() => worker.onmessage?.({ data: handleRequest(request) } as MessageEvent));
    },
    terminate() {},
  };
  return worker;
}
```
  Defined identically in `packages/app/src/solverClient.test.ts` and `packages/app/src/features.test.ts`.

**What to Mock:**
- The worker boundary (via the injected `WorkerLike`) — never the core engine itself. `solverApi.ts` is exercised for real through the fake worker.
- The `Worker` global when testing `SolverClient` terminate behavior: `worker.postMessage = () => {}` to simulate a stalled request.

**What NOT to Mock:**
- `@nonogram/core` engine functions — tested directly and through the loopback worker for real.
- `localStorage` — not mocked; `features.test.ts` calls `saveMode`/`loadMode`/`saveDailyStats`/`loadDailyStats` directly (jsdom provides `localStorage`).
- React rendering — there are no component render tests (see Coverage / Test Types).

## Fixtures and Factories

**Test Data:**
- Small hand-built boards via constructors and `NonogramBoard.fromBitmap` (5x5 border bitmap appears repeatedly in `core.test.ts` and `stepFinder.test.ts`).
- Minimal `PuzzleDefinition` literals (`{ width: 2, height: 2, rowClues: [[2],[0]], colClues: [[1],[1]] }`) in `solverClient.test.ts`.
- Deterministic seeds for generator tests: `generatePuzzle({ size: 5, seed: 42 })` and a `for (let seed = 1; seed <= 25; seed++)` sweep.

**Factory helper:**
- `stepFinder.test.ts` defines a local `board(width, height, rowClues, colClues)` factory to shorten construction.

**Location:**
- No external fixture files; fixtures are inline in each test file.

## Coverage

**Requirements:** No coverage threshold enforced. No coverage tooling configured in `vitest.config.ts` / `vite.config.ts`.

**View Coverage:**
```sh
# Not configured. Add `coverage: { provider: 'v8' }` to a vitest config to enable.
```

## Test Types

**Unit Tests:**
- `packages/core` — pure engine logic: `solveLineDP`, board clue derivation/serialization round-trips, `analyzePuzzle`, `generatePuzzle` determinism, `countSolutions`, `checkUniqueness`, `findLineSteps` per-technique, `NonogramStepFinder.findNextStep` ordering and `disabledTechniques`.
- `packages/app` — pure game state (`game.test.ts`), Coach/Prover helpers (`coach.test.ts`), and the worker bridge (`solverClient.test.ts`, `features.test.ts`).

**Integration Tests:**
- `packages/app/src/solverClient.test.ts` — round-trip through `SolverClient` → fake worker → `handleRequest` → real `solverApi` → core engine.
- `packages/website/test/site.test.mjs` — builds the full site and asserts technique diagrams reproduce real engine deductions; manual shortcuts match `App.tsx`; cross-package consistency checks.

**E2E Tests:**
- Not used (no Playwright/Cypress).

## Common Patterns

**Async Testing:**
```ts
it('generates a puzzle and returns its definition', async () => {
  const client = new SolverClient(loopbackWorker());
  const def = await client.generate({ size: 5, seed: 1, maxAttempts: 200 });
  expect(def.width).toBe(5);
});
```

**Error Testing:**
```ts
it('rejects when the worker replies with an error', async () => {
  const client = new SolverClient(loopbackWorker());
  await expect(client.generate({ size: 0, seed: 1, maxAttempts: 1 })).rejects.toThrow();
});
```

**Integration with one-time setup (`beforeAll`):**
```ts
import { beforeAll, describe, expect, it } from 'vitest';
beforeAll(async () => { await build(); });
```

---

*Testing analysis: 2026-11-03*
