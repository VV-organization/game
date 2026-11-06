import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApplication } from './app';
import { mountFrontend } from './static';

let server: Server;
let application: ReturnType<typeof createApplication>;
let directory: string;
let base: string;
const page = '<!doctype html><html><body><div id="root">FApix Racing</div></body></html>';

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'fapix-static-'));
  mkdirSync(join(directory, 'assets'));
  writeFileSync(join(directory, 'index.html'), page);
  writeFileSync(join(directory, 'assets', 'index-AbCd1234.css'), 'body { color: orange; }');
  application = createApplication({ dbPath: ':memory:', env: {} });
  mountFrontend(application.app, directory);
  server = createServer(application.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  application.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('production frontend serving', () => {
  it('serves an existing hashed stylesheet with its CSS type and immutable cache policy', async () => {
    const response = await fetch(`${base}/assets/index-AbCd1234.css`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/css');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await response.text()).toBe('body { color: orange; }');
  });

  it('returns a real 404 for stale assets and preserves JSON API 404s', async () => {
    for (const path of ['/assets/index-OldHash12.css', '/assets/missing', '/missing.png']) {
      const response = await fetch(base + path, { headers: { accept: 'text/html' } });
      expect(response.status, path).toBe(404);
      expect(response.headers.get('content-type'), path).not.toContain('text/html');
      expect(await response.text(), path).not.toContain('<!doctype html>');
    }
    const api = await fetch(`${base}/api/missing`, { headers: { accept: 'text/html' } });
    expect(api.status).toBe(404);
    expect(api.headers.get('content-type')).toContain('application/json');
    expect(await api.json()).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('revalidates the document and limits the SPA fallback to known GET navigation routes', async () => {
    for (const path of ['/', '/play', '/garage', '/shop', '/records', '/index.html']) {
      const response = await fetch(base + path, { headers: { accept: 'text/html' } });
      expect(response.status, path).toBe(200);
      expect(response.headers.get('content-type'), path).toContain('text/html');
      expect(response.headers.get('cache-control'), path).toBe('no-cache');
      expect(await response.text(), path).toBe(page);
    }
    const dataRequest = await fetch(`${base}/shop`, { headers: { accept: 'application/json' } });
    expect(dataRequest.status).toBe(404);
    const mutation = await fetch(`${base}/shop`, {
      method: 'POST',
      headers: { accept: 'text/html' },
    });
    expect(mutation.status).toBe(404);
    const unknownPage = await fetch(`${base}/not-a-page`, { headers: { accept: 'text/html' } });
    expect(unknownPage.status).toBe(404);
  });
});
