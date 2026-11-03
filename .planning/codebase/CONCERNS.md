---
last_mapped_commit: 0d7b1dbdcc93d66e2eb1606c2e43277fd9efbcab
last_mapped_at: 2026-11-03
---
# Codebase Concerns

**Analysis Date:** 2026-11-03

## Tech Debt

**Monetization module is dead code — never wired into the UI:**
- Issue: `packages/app/src/monetization/monetization.ts` (325 lines: `MonetizationManager`, Google Play Digital Goods API, `$2.99` lifetime ad-removal flow), `AdBanner.tsx`, and `useMonetization.ts` are written but never rendered. `grep` for `AdBanner`/`useMonetization` finds imports only inside the `monetization/` directory itself. `packages/app/src/main.tsx` renders `<App />` with no ad banner, and `packages/app/src/App.tsx` never imports it.
- Files: `C:\dev\nonogram_revisited\packages\app\src\monetization\monetization.ts`, `...\monetization\AdBanner.tsx`, `...\monetization\useMonetization.ts`
- Impact: The in-app purchase ("Remove ads") can never be triggered; the consent/ad infrastructure in `AGENTS.md` implies ads exist when none actually load. The whole `monetization/` subtree is misleading dead weight that adds `(window as any)` casts and swallowed errors without delivering value.
- Fix approach: Either wire `AdBanner` into `App.tsx` (or `main.tsx`) behind the consent flag, or delete the subtree and simplify the consent banner copy until ads are actually added. Do not leave a half-implemented payment flow unreachable.

**`library` storage helpers are aliases with a dead key:**
- Issue: `packages/app/src/store.ts` defines `LIBRARY_KEY = 'nonogram.library'` and exports it, but `loadLibrary()`/`saveLibrary()` just delegate to `loadGames()`/`saveGames()`, which use `GAMES_KEY`. `LIBRARY_KEY` is never read or written.
- Files: `C:\dev\nonogram_revisited\packages\app\src\store.ts` (lines 9, 50-56, 104)
- Impact: There is no separate "library" concept despite `AGENTS.md` and `PORT-PLAN.md` referring to one as a localStorage contract. Any future code reading `LIBRARY_KEY` finds nothing.
- Fix approach: Decide whether the library is the same as saved games (then delete `LIBRARY_KEY` and the aliases) or a distinct store (then implement real read/write + migration).

**Unused domain types:**
- Issue: `packages/app/src/types.ts` declares `LibraryEntry`, `CellHighlight`, `LineHighlight`, `StepRender`, and `StoredSettings` (re-export of `AppSettings`). None are consumed anywhere (`grep` finds only their declarations and the `StoredSettings` import in `store.ts`).
- Files: `C:\dev\nonogram_revisited\packages\app\src\types.ts` (lines 79-114)
- Impact: Drift risk — these types pretend to describe rendering/storage APIs that don't exist.
- Fix approach: Remove the unused types, or implement the features they describe.

**Unused worker message path (`COUNT_SOLUTIONS`):**
- Issue: `countSolutions` and `checkUniqueness` are exported from `packages/core/src/solver.ts`, wired through `protocol.ts` (`COUNT_SOLUTIONS`), `solverApi.ts`, and `solverClient.ts`, but no UI code calls `countSolutions`. Only tests use the bridge path.
- Files: `C:\dev\nonogram_revisited\packages\core\src\solver.ts` (lines 73-129), `...\app\src\solverClient.ts` (line 82), `...\app\src\solverApi.ts` (line 48)
- Impact: Uniqueness verification exists in the engine but the app never surfaces it; the "verified unique without guessing" claim in `README.md` is enforced only indirectly through generator internals, not by a call to `checkUniqueness`.
- Fix approach: Either surface uniqueness/count in Analyze mode, or trim the dead `COUNT_SOLUTIONS` path.

**Placeholder Android App Links shipped to production:**
- Issue: `packages/website/src/build.mjs` writes `.well-known/assetlinks.json` with a fixed `package_name: 'com.revisitedlabs.nonogram'` and two hardcoded SHA256 fingerprints, described in-code as a "template with placeholder".
- Files: `C:\dev\nonogram_revisited\packages\website\src\build.mjs` (lines 319-340)
- Impact: The Android App Links association is non-functional until real signing fingerprints are substituted; the TWA deep-linking the monetization flow depends on this file.
- Fix approach: Move the package name + fingerprints to build-time inputs (env), and fail the build rather than emit placeholders when they're absent.

**Password gate is a no-op stub:**
- Issue: `packages/website/src/build.mjs` inlines `GATE_MJS` as `window.__nonogram_gate = { ready: true }` — no password check. `pages.yml` has a `gate` workflow input that requires the `SITE_PASSWORD` secret but never uses it to gate content.
- Files: `C:\dev\nonogram_revisited\packages\website\src\build.mjs` (line 42), `C:\dev\nonogram_revisited\.github\workflows\pages.yml` (lines 6-9, 30-42)
- Impact: The "temporary password gate" toggle does nothing; a maintainer could believe the site is gated when it is publicly visible.
- Fix approach: Implement the gate or remove the `gate` input and `SITE_PASSWORD` wiring to avoid a false sense of security.

**Duplicate website build in the deploy workflow:**
- Issue: `pages.yml` runs `pnpm --filter @nonogram/website build && ... test` once, then runs `pnpm --filter @nonogram/website build` again for the deploy step.
- Files: `C:\dev\nonogram_revisited\.github\workflows\pages.yml` (lines 35-42)
- Impact: Wasted CI time and a possible source of inconsistency if the two builds were to differ (e.g. env drift).
- Fix approach: Build once, test the artifact, then deploy that same `dist/`.

**`SolveAnalysis.unique` is misleading:**
- Issue: `packages/core/src/solver.ts` `analyzePuzzle` returns `unique: solved` (line 35). "Solved" means the human-step finder reached a full grid that matches the clues; it is not a distinct uniqueness proof and it can be true even when the CONTRADICTION technique (bifurcation) was used.
- Files: `C:\dev\nonogram_revisited\packages\core\src\solver.ts` (lines 32-41)
- Impact: Callers reading `unique` may assume a hard uniqueness guarantee (`checkUniqueness`) that was never run.
- Fix approach: Rename to `solved`/`complete`, or actually derive `unique` from `checkUniqueness` and document its `unknown` case.

## Known Bugs

**No upper bound on imported board dimensions (JSON and `.non` paths):**
- Symptoms: The compact `WxH:rows:cols` and ASCII-grid paths are capped at 30×30, but the JSON path (`parseNonogramText`, `if (text.startsWith('{'))`) and the `.non` path accept arbitrary `width`/`height` (the `.non` path even infers `width = colClues.length`). `NonogramBoard` only rejects `< 1`.
- Files: `C:\dev\nonogram_revisited\packages\core\src\board.ts` (lines 287-318, 323-430)
- Trigger: Import a JSON with `"width": 100000, "height": 100000` (or a `.non` with 100000 columns) via the Import modal or `?p=` deep link.
- Workaround: None; the app allocates `width*height` cells and may freeze or crash.
- Fix: Reject dimensions above a sane max (e.g. 30 or 40) in the JSON and `.non` parse paths, matching the existing compact/ASCII cap.

**`analyzePuzzle` can report `unique: true` for a puzzle it proved via bifurcation:**
- Symptoms: A board solved only through `CONTRADICTION` still reports `unique: true`.
- Files: `C:\dev\nonogram_revisited\packages\core\src\solver.ts` (line 35)
- Fix: See the `unique` field note above.

## Security Considerations

**Unbounded input dimensions (memory DoS):**
- Risk: A crafted puzzle string (JSON or `.non`) with huge dimensions causes `NonogramBoard` to allocate massive arrays and can hang the worker/main thread.
- Files: `C:\dev\nonogram_revisited\packages\core\src\board.ts` (lines 287-318, 323-430)
- Current mitigation: Compact and ASCII paths cap at 30; nothing caps JSON/`.non`.
- Recommendations: Add a shared `MAX_BOARD_DIM` constant and enforce it in every deserialization path and in `NonogramBoard.fromBitmap`/constructor.

**Hardcoded third-party IDs in the site generator:**
- Risk: AdSense account/publisher IDs and a Cloudflare account ID are committed as literals.
- Files: `C:\dev\nonogram_revisited\packages\website\src\build.mjs` (line 153, 308), `C:\dev\nonogram_revisited\.github\workflows\pages.yml` (line 47)
- Current mitigation: These are not secrets (the Cloudflare `accountId` is public), so exposure risk is low, but they are a maintenance hazard and the AdSense IDs imply monetization that isn't implemented.
- Recommendations: Move the AdSense ID behind a build-time constant with a clear comment, and consider a comment noting the account ID is public.

**Consent script uses `innerHTML`:**
- Risk: `build.mjs` injects the consent banner via `el.innerHTML = '...'` with a hardcoded string (no user input), so no XSS today. It becomes a risk only if the string is later parameterized.
- Files: `C:\dev\nonogram_revisited\packages\website\src\build.mjs` (line 30)
- Recommendations: Keep the consent copy static; if it must be dynamic, switch to `textContent`/`document.createElement`.

## Performance Bottlenecks

**`findContradictionSteps` scans every unknown cell twice:**
- Problem: For every unknown cell it runs `traceHypothesis` for both `1` and `-1` (each up to 60 rounds of full-grid line DP), collects *all* traces, then sorts and dedupes before returning the first `maxResults`.
- Files: `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts` (lines 751-830)
- Cause: O(unknownCells × 2 × 60 × lines × lineDP). On a hard 30×30 board this is thousands of `traceHypothesis` calls.
- Improvement path: Early-exit once `maxResults` traces are found; bound the candidate scan (e.g. sample cells near edges/partially-constrained lines as `findEdgeLookaheadSteps` does) instead of enumerating all unknowns.

**`analyzePuzzle` and the Analyze-mode effect re-solve on every active-puzzle change:**
- Problem: `analyzePuzzle` loops `width*height*4` times, each calling `findNextStep` which scans all rows/columns and may invoke `findEdgeLookaheadSteps`/`findContradictionSteps`. The Analyze-mode `useEffect` in `App.tsx` re-runs the full solve whenever `active` changes.
- Files: `C:\dev\nonogram_revisited\packages\core\src\solver.ts` (lines 15-42), `...\app\src\App.tsx` (lines 222-253)
- Cause: Full human-step solve is O(cells² · lineDP) worst case, off the main thread but still slow and battery-draining for large boards.
- Improvement path: Memoize analysis per puzzle id; cache `findNextStep` results; consider a wall-clock budget like the generator uses.

**Generator throw path on exhausted fallbacks:**
- Problem: `generatePuzzle` throws when every fallback fails (`Could not generate a puzzle...`). The worker wraps this into an ERROR reply, and `App.tsx` surfaces it, but a burst of requests (e.g. rapid Daily + Generate) can trigger it.
- Files: `C:\dev\nonogram_revisited\packages\core\src\generator.ts` (line 340)
- Improvement path: The `generateEasyFallback` is already a "cannot throw" safety net in most cases; verify the `findLevelFour` + `easyFallback` combination covers `maxTimeMs`-bounded hard searches so the throw is truly unreachable.

## Fragile Areas

**`stepFinder.ts` technique classification:**
- Files: `C:\dev\nonogram_revisited\packages\core\src\stepFinder.ts` (836 lines)
- Why fragile: The 7 in-line techniques are assigned by a sequence of mutually-exclusive `claimedPos` filters with subtle ordering (FORCING vs JOINING_SPLITTING at lines 280-285, GLUE_PUNCTURING vs MERCURY bounce at lines 358-374). A change to one classifier can silently re-label deductions and alter puzzle ratings, which the website diagram tests and the `level` assertions depend on.
- Safe modification: Extend `stepFinder.test.ts` before touching classifiers; keep the `claimedPos` claim order stable.
- Test coverage: `packages/core/test/stepFinder.test.ts` is only 92 lines for 9 techniques.

**`Board.tsx` manual memo comparator:**
- Files: `C:\dev\nonogram_revisited\packages\app\src\components\Board.tsx` (lines 320-331)
- Why fragile: `rowPropsEqual` reimplements shallow equality with a convoluted `selChanged` expression; a wrong result either skips needed re-renders (stale cells) or re-renders every row.
- Safe modification: Prefer extracting the per-row highlight/selection into stable props, or drop the custom comparator in favor of React's default and profile.

**localStorage stored-key contract has no versioning:**
- Files: `C:\dev\nonogram_revisited\packages\app\src\store.ts` (lines 7-11), `...\app\src\App.tsx` (lines 71-73)
- Why fragile: `AGENTS.md` says stored keys are a contract and must not be renamed without migration, but there is no schema version field or migration hook. `loadGames`/`loadSettings` silently fall back to defaults on any parse error, so a future shape change silently resets users.
- Safe modification: Add a `schemaVersion` to each stored blob and a migration function before changing shapes.

**Service worker cache version is manual:**
- Files: `C:\dev\nonogram_revisited\packages\app\public\sw.js` (lines 6-7)
- Why fragile: `ASSET_CACHE`/`PAGE_CACHE` use a hardcoded `v1`. Hashed assets are cache-first, so a stale `sw.js` can keep serving old logic; bumping requires a manual edit.
- Safe modification: Consider a build-time cache-name hash or a `CACHE_PREFIX` injected by Vite.

## Scaling Limits

**Board size:**
- Current capacity: Import formats cap at 30×30 (compact/ASCII), but `generatePuzzle` and the UI accept any `size`; the Board renders with a zoom control only at ≥15.
- Limit: Step-finding and contradiction search degrade super-linearly; a 40×40 or larger board makes the Prover/Analyze path sluggish.
- Scaling path: Enforce a shared max dimension across generation and import, and keep hard searches bounded (the generator already uses `maxTimeMs`).

**localStorage quota for saved games:**
- Current capacity: `MAX_GAMES = 50` in `App.tsx` caps the *count*, but not the *size* of each stored board (a large imported board with a full `solution` and `cells` arrays can be large).
- Limit: Exceeding the ~5 MB quota makes `saveGames` throw, which is silently swallowed (`catch {}`), losing saves.
- Scaling path: Cap stored board dimensions, or catch quota errors and warn the user instead of failing silently.

## Dependencies at Risk

**Transitive dependencies unaudited:**
- Risk: `docs/LICENSE-AUDIT.md` explicitly states transitive dependencies are "Not audited" and asks for a `pnpm licenses list` scan before release.
- Impact: A transitive GPL-incompatible or non-redistributable package could taint a GPL-3.0-or-later release.
- Migration plan: Run `pnpm licenses list` and record results in `LICENSE-AUDIT.md`.

**Very recent dependency pins:**
- Risk: `react` 19.3.1, `vite` 8.3.4, `vitest` 5.0.5, `jsdom` 26.1.0 are bleeding-edge versions (see `docs/LICENSE-AUDIT.md`).
- Impact: Higher chance of upstream breakage; the app/website behavior is coupled to Vite 8 and React 19 internals.
- Migration plan: Add a Dependabot or Renovate config and pin with `~`/`^` deliberately; the repo has no dependency-update automation visible.

**Deploy action and account pinning:**
- Risk: `cloudflare/wrangler-action@v3` is pinned by major only, and the Cloudflare `accountId` is hardcoded in the workflow.
- Impact: A breaking `v3` minor could silently change deploy behavior.
- Migration plan: Pin the action to a full tag/SHA and document the account ID.

## Missing Critical Features

**No UI/browser tests:**
- Problem: `docs/PORT-PLAN.md` lists "UI tests — Not started" and roadmap item 4. Painting, undo, Coach staging, and the Why? prover are only verified by hand.
- Blocks: Regression safety for the React components and the drag/keyboard interactions.
- Files: `C:\dev\nonogram_revisited\packages\app\src\components\*`, `...\app\src\App.tsx`

**No installable PWA smoke test:**
- Problem: Roadmap item 5 is unstarted; the service worker install/offline-reload path is untested end-to-end.
- Blocks: Confidence that `/play/` works offline after a deploy.

**Ads described but not implemented:**
- Problem: The consent banner, `ads.txt`, and AdSense meta tags exist, but no ad script loads and the monetization engine is unwired. The privacy page ("doesn't load advertising") is actually consistent, but the ad infrastructure suggests intent that isn't realized.
- Blocks: Any real monetization work is effectively from scratch.

## Test Coverage Gaps

**Monetization engine (`packages/app/src/monetization/*`) — untested:**
- What's not tested: `MonetizationManager` init/purchase/restore flows, `AdBanner`, `useMonetization`.
- Risk: The payment state machine (and its `(window as any)` casts) could break silently.
- Priority: Medium (currently dead code, but must be tested before wiring up).

**Sound (`packages/app/src/sound.ts`) — untested:**
- What's not tested: `playTick`/`playSolved` WebAudio setup and graceful fallback when audio is blocked.
- Priority: Low.

**Consent/gate/ad injection in `build.mjs` — untested:**
- What's not tested: The inlined `CONSENT_MJS`, `GATE_MJS`, `ads.txt`, and `assetlinks.json` outputs.
- Files: `C:\dev\nonogram_revisited\packages\website\src\build.mjs`
- Risk: A consent/gate regression ships unnoticed.
- Priority: Medium.

**`SolveAnalysis.unique` semantics — untested:**
- What's not tested: That `unique` correctly distinguishes a genuine uniqueness proof from a "reached a full grid" solve.
- Risk: Misleading API contracts propagate to future callers.
- Priority: Medium.

**UI/component layer — untested:**
- What's not tested: `Board` drag/keyboard painting, `TopBar`/`ToolPad`/`SidePanel`/`HintPanel`/`SolvedModal`/`AnalyzePanel` behavior, undo/redo, mode switching.
- Files: `C:\dev\nonogram_revisited\packages\app\src\components\*`, `...\app\src\App.tsx`
- Risk: High — the most user-facing code has no automated coverage (explicit roadmap item).
- Priority: High.

---

*Concerns audit: 2026-11-03*
