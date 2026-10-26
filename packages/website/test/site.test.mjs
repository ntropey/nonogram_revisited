import { beforeAll, describe, expect, it } from 'vitest';
import { join, relative, resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { build } from '../src/build.mjs';
import { TECHNIQUES } from '../src/techniques.mjs';
import { SHORTCUTS } from '../src/manual.mjs';
import { LEVEL_NAMES, NonogramBoard, NonogramStepFinder, TECHNIQUES_META, findLineSteps } from '../../core/src/index';

const SITE = resolve(import.meta.dirname, '..');
const ROOT = resolve(SITE, '..', '..');
const DIST = join(SITE, 'dist');

async function listFiles(dir, skip = []) {
  const out = [];
  const walk = async (d) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      if (skip.includes(entry.name)) continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) await walk(p);
      else out.push(p);
    }
  };
  await walk(dir);
  return out;
}

beforeAll(async () => {
  await build();
});

describe('technique guides', () => {
  it('cover every engine technique, in order, with matching names and levels', () => {
    expect(TECHNIQUES.map((t) => [t.type, t.slug, t.name, t.level])).toEqual(
      TECHNIQUES_META.map((m) => [m.type, m.slug, m.name, m.level]),
    );
  });

  it('write a page per technique', async () => {
    for (const t of TECHNIQUES) {
      const html = await readFile(join(DIST, 'techniques', t.slug, 'index.html'), 'utf8');
      expect(html).toContain(`<h1>${t.name}</h1>`);
      expect(html).toContain('<svg');
      expect(html).toContain(`Level ${t.level}: ${LEVEL_NAMES[t.level]}`);
    }
  });

  for (const t of TECHNIQUES) {
    it(`${t.name}: the diagram shows a deduction the engine makes`, () => {
      const ex = t.example;
      if (ex.kind === 'line') {
        const board = new NonogramBoard({
          width: ex.length,
          height: 1,
          rowClues: [ex.clues],
          colClues: Array.from({ length: ex.length }, () => [1]),
        });
        for (const [pos, state] of Object.entries(ex.marks)) board.cells[Number(pos)] = state;
        const step = findLineSteps(board, 'row', 0).find((s) => s.type === t.type);
        expect(step, 'engine finds this technique on the example line').toBeDefined();
        const shown = ex.deduced.map(([pos, state]) => `${pos}:${state}`).sort();
        const found = step.changes.map((c) => `${c.cell}:${c.state}`).sort();
        expect(found).toEqual(shown);
      } else {
        const height = ex.rows.length;
        const board = new NonogramBoard({
          width: ex.width,
          height,
          rowClues: ex.rows,
          colClues: ex.cols,
          cells: ex.cells,
        });
        const step = new NonogramStepFinder().findNextStep(board);
        expect(step?.type).toBe(t.type);
        expect(step.changes.map((c) => [c.cell, c.state])).toEqual([ex.deduced]);
      }
    });
  }
});

describe('manual', () => {
  it('lists the shortcuts the app actually handles', async () => {
    const app = await readFile(join(ROOT, 'packages/app/src/App.tsx'), 'utf8');
    for (const s of SHORTCUTS) {
      expect(app, `App.tsx handles "${s.key}"`).toMatch(new RegExp(`e\\.key(\\.toLowerCase\\(\\))? === '${s.key}'`));
    }
    const html = await readFile(join(DIST, 'manual', 'index.html'), 'utf8');
    for (const s of SHORTCUTS) expect(html).toContain(`<kbd>${s.label}</kbd>`);
  });
});

describe('shell', () => {
  it('gives every page a favicon, so browsers do not request a missing /favicon.ico', async () => {
    const pages = (await listFiles(DIST, ['play'])).filter((f) => f.endsWith('.html'));
    for (const f of pages) expect(await readFile(f, 'utf8'), relative(DIST, f)).toContain('rel="icon"');
  });

  it('gives every page a skip link, a main landmark and a labeled nav', async () => {
    const pages = (await listFiles(DIST, ['play'])).filter((f) => f.endsWith('.html'));
    for (const f of pages) {
      const html = await readFile(f, 'utf8');
      const name = relative(DIST, f);
      expect(html, name).toContain('<a class="skip" href="#main">');
      expect(html, name).toContain('<main id="main">');
      expect(html, name).toContain('<nav class="nav" aria-label="Main">');
      expect(html.match(/rel="apple-touch-icon"/g)?.length, name).toBe(1);
    }
  });

  it('remembers the consent choice instead of asking on every page', async () => {
    const html = await readFile(join(DIST, 'index.html'), 'utf8');
    expect(html).toContain("localStorage.setItem(KEY, choice)");
    expect(html).toContain("className = 'consent'");
  });
});

describe('seo metadata', () => {
  const BASE = (process.env.SITE_URL || 'https://nonogramrevisited.com').replace(/\/*$/, '/');
  const marketingPages = async () =>
    (await listFiles(DIST, ['play'])).filter((f) => f.endsWith('.html'));

  it('gives every marketing page one canonical link, a description, an og:image and JSON-LD', async () => {
    for (const f of await marketingPages()) {
      const html = await readFile(f, 'utf8');
      const name = relative(DIST, f).replace(/\\/g, '/');
      expect(html.match(/rel="canonical"/g)?.length, name).toBe(1);
      expect(html, name).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, name).toMatch(/<meta property="og:image" content="[^"]+"/);
      expect(html.match(/<script type="application\/ld\+json">/g)?.length, name).toBe(1);
    }
  });

  it('builds absolute canonicals: root for home, trailing slash for directories', async () => {
    const home = await readFile(join(DIST, 'index.html'), 'utf8');
    expect(home).toContain(`<link rel="canonical" href="${BASE}" />`);
    const about = await readFile(join(DIST, 'about', 'index.html'), 'utf8');
    expect(about).toContain(`<link rel="canonical" href="${BASE}about/" />`);
    const technique = await readFile(join(DIST, 'techniques', TECHNIQUES[0].slug, 'index.html'), 'utf8');
    expect(technique).toContain(`<link rel="canonical" href="${BASE}techniques/${TECHNIQUES[0].slug}/" />`);
  });

  it('does not repeat the site name in the home title', async () => {
    const html = await readFile(join(DIST, 'index.html'), 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    expect(title).toContain('Nonogram Solver &amp; Trainer');
    expect(title.match(/Nonogram Revisited/g)?.length ?? 0).toBe(1);
    expect(html).not.toContain('Nonogram Revisited — Nonogram Revisited');
  });

  it('uses the expected descriptions for home, about and privacy', async () => {
    const expected = {
      'index.html':
        'Free Nonogram (Picross) solver with step-by-step hints, a four-stage coach, contradiction proofs, a seeded generator, and offline play.',
      'about/index.html':
        'Why Nonogram Revisited exists, how the deterministic solver works, and the open-source projects behind it.',
      'privacy/index.html':
        'What Nonogram Revisited stores in your browser, what it never sends, and how cookie consent works.',
    };
    for (const [page, description] of Object.entries(expected)) {
      const html = await readFile(join(DIST, page), 'utf8');
      expect(html, page).toContain(`<meta name="description" content="${description}" />`);
      expect(html, page).toContain(`<meta property="og:description" content="${description}" />`);
    }
  });

  it('embeds Organization, WebSite and WebPage JSON-LD nodes', async () => {
    const html = await readFile(join(DIST, 'about', 'index.html'), 'utf8');
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    const data = JSON.parse(json);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph'].map((node) => node['@type'])).toEqual(['Organization', 'WebSite', 'WebPage']);
    const page = data['@graph'][2];
    expect(page.url).toBe(`${BASE}about/`);
    expect(page.name).toBe('About — Nonogram Revisited');
  });
});

describe('site integrity', () => {
  it('has no broken internal links or anchors', async () => {
    const pages = (await listFiles(DIST, ['play'])).filter((f) => f.endsWith('.html'));
    const byUrl = new Map();
    for (const f of pages) {
      const rel = relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '');
      byUrl.set('/' + rel, await readFile(f, 'utf8'));
    }
    const broken = [];
    for (const [url, html] of byUrl) {
      for (const m of html.matchAll(/href="([^"#]*)(#[^"]*)?"/g)) {
        const [, path, hash] = m;
        if (!path.startsWith('/') || path.startsWith('/play/') || /\.(svg|png|ico|json)$/.test(path)) continue;
        const target = byUrl.get(path);
        if (!target) broken.push(`${url} -> ${path}`);
        else if (hash && !target.includes(`id="${hash.slice(1)}"`)) broken.push(`${url} -> ${path}${hash}`);
      }
      for (const m of html.matchAll(/href="(#[^"]+)"/g)) {
        if (!html.includes(`id="${m[1].slice(1)}"`)) broken.push(`${url} -> ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('lists every page in the sitemap', async () => {
    const sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf8');
    for (const t of TECHNIQUES) expect(sitemap).toContain(`/techniques/${t.slug}/`);
    expect(sitemap).toContain('/learn/how-to-play/');
    expect(sitemap).toContain('/learn/strategy/');
  });
});

describe('spelling', () => {
  it('uses American spelling in the app, website, docs and README', async () => {
    const british = /\b(colours?|coloured|behaviours?|centres?|favourites?|grey|practis(e|ed|es|ing)|labelled|organis(e|ed|ation)|neighbours?|analys(e|ed|es|ing)|honour|cancelled)\b/gi;
    const files = [
      ...(await listFiles(join(ROOT, 'packages/app/src'))),
      ...(await listFiles(join(ROOT, 'packages/website/src'))),
      ...(await listFiles(join(ROOT, 'docs')).catch(() => [])),
      join(ROOT, 'README.md'),
    ].filter((f) => /\.(tsx?|mjs|css|md)$/.test(f));
    const hits = [];
    for (const f of files) {
      const text = await readFile(f, 'utf8');
      for (const m of text.matchAll(british)) {
        if (/^(color|colors|colored)$/i.test(m[0])) continue; // US spelling
        hits.push(`${relative(ROOT, f)}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
