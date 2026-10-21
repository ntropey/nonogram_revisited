# License audit

Nonogram Revisited is licensed **GPL-3.0-or-later** (see `LICENSE`). This file records what has and has
not been checked. It is a working record, not legal advice.

## Direct dependencies

Declared licenses, read from the installed `package.json` of each package on 2026-10-21:

| Package | Version | License | Used for |
| --- | --- | --- | --- |
| react | 19.3.1 | MIT | App UI |
| react-dom | 19.3.1 | MIT | App UI |
| vite | 8.3.4 | MIT | App build |
| @vitejs/plugin-react | 4.7.0 | MIT | App build |
| typescript | 5.6.3 | Apache-2.0 | Type checking |
| vitest | 5.0.5 | MIT | Tests |
| jsdom | 26.1.0 | MIT | App tests |
| esbuild | 0.28.2 | MIT | Root dev tool |
| @types/react, @types/react-dom | 19.3.0 | MIT | Types only |

MIT and Apache-2.0 are compatible with distribution under GPL-3.0-or-later. Runtime code in the
shipped app is limited to React and the project's own code; the website generator has no runtime
dependencies.

**Not audited:** transitive dependencies. Before a release, run a license scan over the lockfile (for
example `pnpm licenses list`) and record the result here.

## Inspiration: FreeNono and NonogramSolver

The README says the project is inspired by these Java tools. This audit has **not** compared the
code, and does not establish their licenses. A maintainer should confirm and record:

- [ ] The license of each upstream project, as shown in its own repository.
- [ ] That no source, puzzle files, images or text were copied from either project. If anything was, keep its notice and check GPL compatibility.
- [ ] That any puzzles or art bundled in the future have a license that allows redistribution.

## Assets and content

- The app ships no images, icons, fonts or puzzle packs. Text uses the system font stack, and puzzles are generated at runtime.
- Technique diagrams on the website are drawn by `packages/website/src/diagrams.mjs`.
- The consent banner and Google Consent Mode loader are referenced in the site shell, but no ad or analytics script is present in this repository. Review the site's privacy text before adding any.
