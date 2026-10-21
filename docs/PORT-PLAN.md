# Port plan: status and roadmap

Where Nonogram Revisited stands, what is verified, and what comes next. Update this file when a
milestone lands. Last reviewed: 2026-10-21.

## Status

| Area | State | Notes |
| --- | --- | --- |
| Core engine (`packages/core`) | Done | Board model, line solver, nine techniques, uniqueness check, difficulty rating, seeded generator. Generator skips dull boards (nearly empty/full, or mostly blank/full lines). |
| Worker bridge (`packages/app`) | Done | Typed request/response envelopes in `protocol.ts`; `SolverClient` takes an injectable worker and has round-trip tests. |
| Board and play | Done | Single-grid layout with clue gutters, 5-cell guides, drag/right-click painting, undo, auto-cross, win detection, persistence. |
| Coach | Done | Four stages: where to look, a question, the technique and reason, the move. Rule-based (it narrates the step finder; there is no language model). |
| Prover ("Why?") | Done | Fill and cross-out hypotheses traced with core's `traceHypothesis`; chain and conflict line shown, one-click apply. |
| Themes and layout | Done | Dark and light, responsive. |
| Website | Done | Home, nine technique pages with verified diagrams, Learn (3 pages), manual, about, privacy. |
| PWA shell | Partial | Service worker works (it did not evaluate before; fixed). The manifest has no icons yet, so the app is not installable on most platforms. |
| Modes (play / train / analyze) | Not started | `gameMode` is stored but unused. |
| Daily puzzle | Not started | `dailyPuzzle` exists in core; no UI. |
| Share by URL | Not started | `serializePuzzle` / `deserializePuzzle` exist in core; no UI. |
| Keyboard play | Not started | Cells are not focusable; only tool shortcuts exist. |
| UI tests | Not started | Logic and worker are unit tested; the UI was checked by hand with a browser. |

## How things are verified

- `pnpm test` runs core, app logic, and website tests.
- Each technique guide's diagram is checked against the engine: the website test builds the example
  board and asserts the engine finds that technique and that exact deduction.
- The manual's shortcut table is checked against `App.tsx`.
- The website test fails on broken internal links and on British spellings.

## Roadmap

1. **Installable PWA:** icons (192 and 512 px, plus maskable), `start_url` and scope checks, an offline smoke test.
2. **Keyboard and screen-reader play:** roving focus on cells, arrow keys, Space/Enter to paint, a live region for Coach text.
3. **Modes:** Play (no hints), Train (Coach on, techniques selectable via the step finder's `disabledTechniques`), Analyze (paste or load clues and see the full step list and rating).
4. **Daily puzzle and sharing:** use `dailyPuzzle` and the core serializer; keep stored keys stable.
5. **Generator quality:** a target difficulty search that is smarter than random retries, and pixel-art puzzles with titles.
6. **UI tests:** a few browser tests for painting, undo, Coach and Why?.

## Constraints to keep

- Stored keys in localStorage are a contract. Add a migration before renaming any.
- `solverApi.ts` stays pure; keep `protocol.ts`, `solverClient.ts` and `worker.ts` in sync.
- The manual and technique pages are tied to the app and engine by tests; change them together.
