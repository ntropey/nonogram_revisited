# Port plan: status and roadmap

Where Nonogram Revisited stands, what is verified, and what comes next. Update this file when a
milestone lands. Last reviewed: 2026-10-27.

## Status

| Area | State | Notes |
| --- | --- | --- |
| Core engine (`packages/core`) | Done | Board model, line solver, nine techniques, uniqueness check, difficulty rating, seeded generator. Generator skips dull boards (nearly empty/full, or mostly blank/full lines). Level targeting uses fast line propagation, a bounded hard-level search and closest-level fallback. |
| Worker bridge (`packages/app`) | Done | Typed request/response envelopes in `protocol.ts`; `SolverClient` takes an injectable worker and has round-trip tests. Supports `DAILY` requests. |
| Board and play | Done | Single-grid layout with clue gutters, 5-cell guides, drag/right-click painting, undo, auto-cross, win detection, persistence. |
| Coach | Done | Four stages: where to look, a question, the technique and reason, the move. Rule-based (it narrates the step finder; there is no language model). |
| Prover ("Why?") | Done | Fill and cross-out hypotheses traced with core's `traceHypothesis`; chain and conflict line shown, one-click apply. |
| Themes and layout | Done | Dark and light, responsive. |
| Website | Done | Home, nine technique pages with verified diagrams, Learn (3 pages), manual, about, privacy. |
| PWA shell | Done | Service worker works. `manifest.json` declares `start_url`, scope, 192/512/maskable icons and an SVG icon. |
| Modes (play / train / analyze) | Done | Mode switcher in top bar. Play provides standard solving; Train enables technique selection and Coach practice; Analyze computes and inspects the step-by-step solve trail. |
| Daily puzzle | Done | `dailyPuzzle` generated off-thread, `?daily=1` deep link, toolbar Daily button, streak tracking (`nonogram.daily`), and completion share card. |
| Share by URL | Done | `?p=...` deep link parsing on mount, Share button for compact URL strings, and Import modal for text, `.non` format, JSON, or ASCII grids. |
| Keyboard play | Done | The grid uses a roving tab stop; arrow keys move focus, Space/Enter paints, and each cell has an `aria-label`. |
| UI tests | Not started | Logic and worker are unit tested; the UI was checked by hand with a browser. |

## How things are verified

- `pnpm test` runs core, app logic, and website tests.
- Each technique guide's diagram is checked against the engine: the website test builds the example
  board and asserts the engine finds that technique and that exact deduction.
- The manual's shortcut table is checked against `App.tsx`.
- The website test fails on broken internal links and on British spellings.

## Roadmap

1. **Modes:** Play (no hints), Train (Coach on, techniques selectable via the step finder's `disabledTechniques`), Analyze (paste or load clues and see the full step list and rating). *(Done)*
2. **Daily puzzle and sharing:** use `dailyPuzzle` and the core serializer; keep stored keys stable. *(Done)*
3. **Generator quality:** pixel-art puzzles with titles. The target-difficulty search now screens with line propagation, bounds the hard-level search, and falls back to the closest rated board.
4. **UI tests:** a few browser tests for painting, undo, Coach and Why?.
5. **Installable PWA smoke test:** verify install prompts and an offline reload in a browser.

## Constraints to keep

- Stored keys in localStorage are a contract. Add a migration before renaming any.
- `solverApi.ts` stays pure; keep `protocol.ts`, `solverClient.ts` and `worker.ts` in sync.
- The manual and technique pages are tied to the app and engine by tests; change them together.
