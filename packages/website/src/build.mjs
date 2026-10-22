/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Dependency-free static site generator for nonogramrevisited.com.
 * Writes every page from string literals, copies the app build to /play/,
 * and emits sitemap.xml / robots.txt when SITE_URL is set.
 */
import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { learnPages } from './learn.mjs';
import { manualPage } from './manual.mjs';
import { techniquePages } from './techniques.mjs';

const SRC_DIR = resolve(import.meta.dirname, '..'); // packages/website
const ROOT = resolve(SRC_DIR, '..', '..'); // workspace root
const DIST = join(SRC_DIR, 'dist');
const APP_DIST = join(ROOT, 'packages', 'app', 'dist');
const SITE_URL = process.env.SITE_URL || 'https://nonogramrevisited.com/';

/** Inlined consent banner + Google Consent Mode v2 loader (on every site page). */
const CONSENT_MJS = `(function(){
  var KEY = 'nonogram.consent';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  window.__nonogram_consent = { granted: saved === 'granted' };
  if (saved === 'granted' || saved === 'declined') return;
  var el = document.createElement('div');
  el.className = 'consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Cookie consent');
  el.innerHTML = '<p>Nonogram Revisited doesn’t use analytics or advertising cookies right now. If that changes, we’ll ask you first. Your answer is saved only in this browser.</p><div><button type="button" data-consent="granted">Allow</button><button type="button" data-consent="declined">No thanks</button></div>';
  el.addEventListener('click', function (e) {
    var choice = e.target && e.target.getAttribute && e.target.getAttribute('data-consent');
    if (!choice) return;
    window.__nonogram_consent.granted = choice === 'granted';
    try { localStorage.setItem(KEY, choice); } catch (err) {}
    el.remove();
  });
  document.body.appendChild(el);
})();`;

/** Inlined gate script (age/consent gate referenced by AGENTS.md). */
const GATE_MJS = `(function(){ window.__nonogram_gate = window.__nonogram_gate || { ready: true }; })();`;

const CSS = `
.consent { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999; display: flex; gap: 0.75rem 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #1e293b; border-top: 1px solid #334155; box-shadow: 0 -8px 24px rgba(0,0,0,0.4); font-size: 0.9rem; }
.consent p { margin: 0; }
.consent div { display: flex; gap: 0.5rem; }
.consent button { font: inherit; cursor: pointer; padding: 0.4rem 0.9rem; border-radius: 6px; border: 1px solid #334155; background: transparent; color: #f8fafc; }
.consent button[data-consent="granted"] { background: #38bdf8; border-color: #38bdf8; color: #022c35; font-weight: 600; }
.consent button:hover { border-color: #38bdf8; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; }
body { padding: 1rem; max-width: 900px; margin: 0 auto; }
header { border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
header .nav { margin-bottom: 0; align-items: center; }
header .play-link { margin-top: 0; padding: 0.35rem 0.9rem; font-size: 0.9rem; }
a { color: #38bdf8; text-decoration: underline; }
a:hover { color: #7dd3fc; }
h1 { font-size: 1.75rem; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: #38bdf8; }
p { margin: 0.75rem 0; color: #e2e8f0; }
ul { margin: 0.75rem 0 0.75rem 1.5rem; color: #e2e8f0; }
li { margin: 0.35rem 0; }
.nav { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.nav a { white-space: nowrap; color: #cbd5e1; text-decoration: none; border: 1px solid #334155; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.9rem; }
.nav a:hover { border-color: #38bdf8; color: #38bdf8; }
.play-link { display: inline-block; margin-top: 1rem; background: #38bdf8; color: #022c35; padding: 0.6rem 1rem; border-radius: 6px; text-decoration: none; font-weight: 600; }
.play-link:hover { background: #7dd3fc; }
.tech { border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin: 1rem 0; background: #1e293b; }
.tech h3 { color: #38bdf8; margin-bottom: 0.5rem; }
.lead { font-size: 1.1rem; color: #cbd5e1; }
.crumbs { font-size: 0.85rem; color: #94a3b8; margin: 0 0 0.5rem; }
.crumbs a { color: #94a3b8; }
.level { display: inline-block; font-size: 0.75rem; font-weight: 600; padding: 0.1rem 0.6rem; border: 1px solid #334155; border-radius: 999px; color: #94a3b8; margin: 0; }
.level-1 { color: #4ade80; border-color: #4ade80; } .level-2 { color: #facc15; border-color: #facc15; }
.level-3 { color: #fb923c; border-color: #fb923c; } .level-4, .level-5 { color: #f87171; border-color: #f87171; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
.card { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.9rem 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; text-decoration: none; font-size: 0.9rem; }
.card:hover { border-color: #38bdf8; }
.card strong { color: #f8fafc; font-size: 1rem; }
figure { margin: 1.25rem 0; padding: 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow-x: auto; }
figure svg, .diagram { max-width: 100%; height: auto; display: block; margin: 0 auto; }
figcaption { margin-top: 0.75rem; font-size: 0.85rem; color: #94a3b8; text-align: center; }
.pager { display: flex; justify-content: space-between; gap: 1rem; margin: 1.5rem 0 0; font-size: 0.9rem; }
.steps { margin: 0.75rem 0 0.75rem 1.5rem; } .steps li { margin: 0.6rem 0; }
.toc { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0; } .toc a { font-size: 0.85rem; padding: 0.2rem 0.6rem; border: 1px solid #334155; border-radius: 6px; text-decoration: none; }
ol { margin: 0.75rem 0 0.75rem 1.5rem; color: #e2e8f0; } ol li { margin: 0.35rem 0; }
kbd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; padding: 0.05rem 0.4rem; border: 1px solid #475569; border-bottom-width: 2px; border-radius: 4px; background: #1e293b; }
table { border-collapse: collapse; margin: 0.75rem 0; } th, td { text-align: left; padding: 0.4rem 1rem 0.4rem 0; border-bottom: 1px solid #334155; }
code { background: #1e293b; padding: 0.05rem 0.35rem; border-radius: 4px; }
@media (max-width: 640px) { header { flex-direction: column; align-items: flex-start; } }
`;

/** Shared page shell. */
function shell({ title, body, active, description }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230b1220'/%3E%3Crect x='5' y='5' width='10' height='10' rx='2' fill='%2338bdf8'/%3E%3Crect x='17' y='5' width='10' height='10' rx='2' fill='%23334155'/%3E%3Crect x='5' y='17' width='10' height='10' rx='2' fill='%23334155'/%3E%3Crect x='17' y='17' width='10' height='10' rx='2' fill='%2338bdf8'/%3E%3C/svg%3E" />
<title>${title} — Nonogram Revisited</title>
${description ? `<meta name="description" content="${description.replace(/"/g, '&quot;')}" />\n` : ''}
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
<footer>
  <p style="font-size:.75rem;margin-top:8px">
    More tools:
    <a href="https://hodokurevisited.com/" target="_blank" rel="noopener noreferrer">Hodoku Revisited</a> ·
    <a href="https://kakurorevisited.com/" target="_blank" rel="noopener noreferrer">Kakuro Revisited</a> ·
    <a href="https://nonogramrevisited.com/" target="_blank" rel="noopener noreferrer">Nonogram Revisited</a> ·
    <a href="https://logisimrevisited.com/" target="_blank" rel="noopener noreferrer">Logisim Revisited</a>
  </p>
</footer>
<script type="module">${GATE_MJS}</script>
<script type="module">${CONSENT_MJS}</script>
</body>
</html>`;
}

const pages = [
  ...techniquePages,
  ...learnPages,
  manualPage,
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
<li><a href="/learn/">Learn pages</a>: how Nonograms work and a solving routine</li>
<li><a href="/manual/">Manual</a>: the app's tools, Coach, Why? prover and shortcuts</li>
</ul>
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
<p>Nonogram Revisited stores settings and saved puzzles in your browser's local storage. Nothing you
do in the app, such as the puzzles you play or your settings, is sent to a server. Your answer to
the cookie banner is remembered in local storage too, so it only asks once.</p>
<p>The site doesn’t load advertising or analytics right now. If that changes, it will only do so after you consent through the banner.</p>
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
