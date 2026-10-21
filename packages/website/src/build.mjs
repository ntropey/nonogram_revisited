/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Dependency-free static site generator for nonogramrevisited.com.
 * Writes every page from string literals, copies the app build to /play/,
 * and emits sitemap.xml / robots.txt when SITE_URL is set.
 */
import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SRC_DIR = resolve(import.meta.dirname, '..'); // packages/website
const ROOT = resolve(SRC_DIR, '..', '..'); // workspace root
const DIST = join(SRC_DIR, 'dist');
const APP_DIST = join(ROOT, 'packages', 'app', 'dist');
const SITE_URL = process.env.SITE_URL || 'https://nonogramrevisited.com/';

/** Inlined consent banner + Google Consent Mode v2 loader (on every site page). */
const CONSENT_MJS = `(function(){
  window.__nonogram_consent = window.__nonogram_consent || { granted: false };
  if (!window.__nonogram_consent.granted) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:9999;background:#0f172a;color:#f8fafc;padding:1rem;border-top:1px solid #334155;display:flex;gap:.75rem;justify-content:space-between;align-items:center;font-family:system-ui,Segoe UI,sans-serif;font-size:.9rem';
    el.innerHTML = '<div>Nonogram Revisited uses optional analytics. Allow cookies?</div><div style="display:flex;gap:.5rem"><button id="nono-consent-yes">Yes</button><button id="nono-consent-no">No</button></div>';
    document.body.appendChild(el);
    document.getElementById('nono-consent-yes').onclick = () => { window.__nonogram_consent.granted = true; el.remove(); };
    document.getElementById('nono-consent-no').onclick = () => { window.__nonogram_consent.granted = false; el.remove(); };
  }
})();`;

/** Inlined gate script (age/consent gate referenced by AGENTS.md). */
const GATE_MJS = `(function(){ window.__nonogram_gate = window.__nonogram_gate || { ready: true }; })();`;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; }
body { padding: 1rem; max-width: 900px; margin: 0 auto; }
header { border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; }
a { color: #38bdf8; text-decoration: underline; }
a:hover { color: #7dd3fc; }
h1 { font-size: 1.75rem; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: #38bdf8; }
p { margin: 0.75rem 0; color: #e2e8f0; }
ul { margin: 0.75rem 0 0.75rem 1.5rem; color: #e2e8f0; }
li { margin: 0.35rem 0; }
.nav { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.nav a { color: #cbd5e1; text-decoration: none; border: 1px solid #334155; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.9rem; }
.nav a:hover { border-color: #38bdf8; color: #38bdf8; }
.play-link { display: inline-block; margin-top: 1rem; background: #38bdf8; color: #022c35; padding: 0.6rem 1rem; border-radius: 6px; text-decoration: none; font-weight: 600; }
.play-link:hover { background: #7dd3fc; }
.tech { border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin: 1rem 0; background: #1e293b; }
.tech h3 { color: #38bdf8; margin-bottom: 0.5rem; }
`;

/** Shared page shell. */
function shell({ title, body, active }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Nonogram Revisited</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <a href="/" style="font-weight:700;color:#38bdf8;text-decoration:none">Nonogram Revisited</a>
  <nav class="nav">
    <a href="/" ${active === 'home' ? 'style="border-color:#38bdf8;color:#38bdf8"' : ''}>Home</a>
    <a href="/techniques/" ${active === 'techniques' ? 'style="border-color:#38bdf8;color:#38bdf8"' : ''}>Techniques</a>
    <a href="/learn/" ${active === 'learn' ? 'style="border-color:#38bdf8;color:#38bdf8"' : ''}>Learn</a>
    <a href="/manual/" ${active === 'manual' ? 'style="border-color:#38bdf8;color:#38bdf8"' : ''}>Manual</a>
    <a href="/about/" ${active === 'about' ? 'style="border-color:#38bdf8;color:#38bdf8"' : ''}>About</a>
    <a href="/privacy/" ${active === 'privacy' ? 'style="border-color:#38bdf8;color:#38bdf8"' : ''}>Privacy</a>
    <a class="play-link" href="/play/">Play</a>
  </nav>
</header>
<main>${body}</main>
<script type="module">${GATE_MJS}</script>
<script type="module">${CONSENT_MJS}</script>
</body>
</html>`;
}

const pages = [
  {
    path: 'index.html',
    title: 'Nonogram Revisited',
    active: 'home',
    body: `
<h1>Nonogram Revisited</h1>
<p>A modern TypeScript Nonogram (Picross / Griddlers) solver, generator, trainer, and analyzer
with a 100% deterministic human-step solving engine, a responsive PWA, a 4-stage Socratic AI Coach,
and a Contradiction Prover. Licensed GPL-3.0-or-later.</p>
<h2>Engine</h2>
<p>Nine human-style solving techniques in strict difficulty order, from Full Line &amp; Zero Line up to
Line Contradiction (Bifurcation). Every puzzle is rated deterministically and verified unique without
guessing whenever possible.</p>
<h2>PWA</h2>
<p>Play offline. The React app runs the solver and generator in a Web Worker and stores games and
settings in localStorage.</p>
<p><a class="play-link" href="/play/">Open the app &rarr;</a></p>
<h2>Site</h2>
<ul>
<li><a href="/techniques/">Technique guides</a> with inline SVG line-deduction diagrams</li>
<li><a href="/learn/">Learn pages</a></li>
<li><a href="/manual/">Manual</a></li>
</ul>
`,
  },
  {
    path: 'techniques/index.html',
    title: 'Solving Techniques',
    active: 'techniques',
    body: `
<h1>Solving Techniques</h1>
<p>Nonogram Revisited applies nine human-style techniques in ascending difficulty:</p>
<div class="tech">
<h3>1. Full Line &amp; Zero Line</h3>
<p>A line with clue <code>0</code> is entirely crossed out. A line whose clues plus mandatory 1-cell
gaps exactly span the line is filled immediately.</p>
</div>
<div class="tech">
<h3>2. Simple Boxes (Clue Overlap)</h3>
<p>Pack a line's clues as far left/top and as far right/bottom as possible; any cell covered by the
same block in both extremes must be filled.</p>
</div>
<div class="tech">
<h3>3. Simple Spaces (Block Length Limit)</h3>
<p>Cross out any cell no block can reach, or inside a gap shorter than any block that could fit.</p>
</div>
<div class="tech">
<h3>4. Forcing (Edge &amp; Wall Extension)</h3>
<p>A filled cell near an edge or next to a crossed wall forces its block to extend inward.</p>
</div>
<div class="tech">
<h3>5. Glue &amp; Puncturing</h3>
<p>Filled cells glue a block over neighbors; a completed block is punctured by crosses on either side.</p>
</div>
<div class="tech">
<h3>6. Joining &amp; Splitting Blocks</h3>
<p>Join separated filled groups that must share a block; split with a cross when joining would exceed
the clue length.</p>
</div>
<div class="tech">
<h3>7. Mercury (Bouncing)</h3>
<p>Starting a block next to a wall that would touch a filled cell right after it bounces away.</p>
</div>
<div class="tech">
<h3>8. Edge Logic &amp; 2-Line Lookahead</h3>
<p>Test a cell and trace its immediate effect on crossing lines; if an adjacent line breaks, the cell is resolved.</p>
</div>
<div class="tech">
<h3>9. Line Contradiction (Bifurcation)</h3>
<p>Assume a cell is filled or crossed and propagate forced line steps until a line has no valid
placement, proving the opposite.</p>
</div>
<p><a class="play-link" href="/play/">Try it in the app &rarr;</a></p>
`,
  },
  {
    path: 'learn/index.html',
    title: 'Learn',
    active: 'learn',
    body: `
<h1>Learn Nonogram</h1>
<p>New to Nonograms? Start here.</p>
<ul>
<li><strong>Goal:</strong> fill the grid so each row and column's filled blocks match its clues.</li>
<li><strong>Filled:</strong> a block cell. <strong>Crossed:</strong> definitely empty.</li>
<li><strong>Clues:</strong> the lengths of consecutive filled blocks, in order.</li>
</ul>
<p><a class="play-link" href="/play/">Open the app &rarr;</a></p>
`,
  },
  {
    path: 'manual/index.html',
    title: 'Manual',
    active: 'manual',
    body: `
<h1>Manual</h1>
<p>Nonogram Revisited app reference.</p>
<h2>Playing</h2>
<p>Tap a cell to cycle: empty &rarr; filled &rarr; crossed out &rarr; empty.</p>
<h2>Solver</h2>
<p>Generate a puzzle, then ask the app to solve it. The solver runs in a Web Worker and reveals one
human-style step at a time.</p>
<h2>Settings</h2>
<p>Stored in localStorage: highlights, auto-cross, sound, theme, and game mode. Do not rename these
keys without a migration.</p>
<p><a class="play-link" href="/play/">Open the app &rarr;</a></p>
`,
  },
  {
    path: 'about/index.html',
    title: 'About',
    active: 'about',
    body: `
<h1>About</h1>
<p>Nonogram Revisited is inspired by the classic open-source Java tools <strong>FreeNono</strong> and
<strong>NonogramSolver</strong>. It is written in TypeScript and licensed GPL-3.0-or-later.</p>
<h2>Repository layout</h2>
<ul>
<li><code>packages/core</code> — pure engine (board, line solver, step finder, generator, rater).</li>
<li><code>packages/app</code> — React 19 + Vite 8 PWA running the engine in a Web Worker.</li>
<li><code>packages/website</code> — this dependency-free static site generator.</li>
</ul>
`,
  },
  {
    path: 'privacy/index.html',
    title: 'Privacy',
    active: 'privacy',
    body: `
<h1>Privacy</h1>
<p>Nonogram Revisited stores settings, saved games, and your library in your browser's
<a>localStorage</a>. Nothing is sent to a server unless you explicitly load a shared puzzle URL.</p>
<p>Ads load only after consent via the consent banner and Google Consent Mode v2 loader.</p>
`,
  },
];

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await copyFile(s, d);
    }
  }
}

export async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const page of pages) {
    const dir = join(DIST, page.path === 'index.html' ? '' : page.path.replace(/\/index\.html$/, ''));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), shell(page));
  }

  // Copy the app's Vite build to /play/ verbatim.
  if (await exists(APP_DIST)) {
    await copyDir(APP_DIST, join(DIST, 'play'));
  }

  // sitemap.xml + robots.txt when SITE_URL is configured.
  if (SITE_URL) {
    const base = SITE_URL.endsWith('/') ? SITE_URL : SITE_URL + '/';
    const urls = pages.map((p) => base + p.path.replace(/index\.html$/, '')).concat(base + 'play/');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
    await writeFile(join(DIST, 'sitemap.xml'), sitemap);
    await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`);
  }

  console.log(`Built ${pages.length} pages to ${DIST}`);
}

async function exists(path) {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  build().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
