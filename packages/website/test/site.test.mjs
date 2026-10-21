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
        if (!path.startsWith('/') || path.startsWith('/play/')) continue;
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
