import { beforeAll, describe, expect, it } from 'vitest';
import { join, relative } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { build } from '../src/build.mjs';

const DIST = join(process.cwd(), 'dist');

async function listFiles(dir) {
  const out = [];
  const walk = async (d) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
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

describe('website build', () => {
  it('builds every page into dist', async () => {
    const files = await listFiles(DIST);
    const names = files.map((f) => relative(DIST, f).replace(/\\/g, '/'));
    expect(names).toContain('index.html');
    expect(names).toContain('techniques/index.html');
    expect(names).toContain('learn/index.html');
    expect(names).toContain('manual/index.html');
    expect(names).toContain('about/index.html');
    expect(names).toContain('privacy/index.html');
    expect(names).toContain('robots.txt');
    expect(names).toContain('sitemap.xml');
    expect(names).toContain('ads.txt');
  });

  it('copies the app build to /play/', async () => {
    const files = await listFiles(join(DIST, 'play'));
    expect(files.some((f) => f.endsWith('index.html'))).toBe(true);
  });

  it('pages contain the shell and consent script', async () => {
    const html = await readFile(join(DIST, 'index.html'), 'utf8');
    expect(html).toContain('Nonogram Revisited');
    expect(html).toContain('__nonogram_consent');
    expect(html).toContain('/play/');
  });

  it('emits an Android App Links template', async () => {
    const links = JSON.parse(await readFile(join(DIST, '.well-known/assetlinks.json'), 'utf8'));
    expect(links[0].relation[0]).toBe('delegate_permission/common.handle_all_urls');
    expect(links[0].target.namespace).toBe('android_app');
    expect(links[0].target.package_name).toBe('com.revisitedlabs.nonogram');
    expect(links[0].target.sha256_cert_fingerprints[0]).toBe('PLACEHOLDER_SHA256_CERT_FINGERPRINT');
  });
});
