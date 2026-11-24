import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
} from 'node:fs';
import express, { type Express } from 'express';
import { basename, join, resolve, sep } from 'node:path';

const applicationRoutes = new Set(['/', '/play', '/garage', '/shop', '/records']);
const hashedAsset = /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

// Keep complete asset sets so old race chunks can still import their own dependencies.
function previousAssetDirectories(build: string, archive: string) {
  const release = createHash('sha256')
    .update(readFileSync(join(build, 'index.html')))
    .digest('hex');
  mkdirSync(archive, { recursive: true });
  const current = join(archive, release);
  if (!existsSync(current)) {
    const staging = mkdtempSync(join(archive, '.release-'));
    try {
      for (const asset of readdirSync(join(build, 'assets'), { withFileTypes: true })) {
        if (asset.isFile() && hashedAsset.test(asset.name))
          copyFileSync(join(build, 'assets', asset.name), join(staging, asset.name));
      }
      renameSync(staging, current);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
  const now = new Date();
  utimesSync(current, now, now);
  const older = readdirSync(archive, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && /^[0-9a-f]{64}$/.test(entry.name) && entry.name !== release,
    )
    .map((entry) => join(archive, entry.name))
    .map((path) => ({ path, modified: statSync(path).mtimeMs }))
    .sort((a, b) => b.modified - a.modified);
  for (const expired of older.slice(3)) rmSync(expired.path, { recursive: true });
  return older.slice(0, 3).map((entry) => entry.path);
}

export function mountFrontend(app: Express, directory: string, archive?: string) {
  const index = resolve(directory, 'index.html');
  const assets = resolve(directory, 'assets') + sep;

  // The API normally handles its own 404 before reaching this middleware.
  // Keep that boundary intact even when this helper is mounted independently.
  app.use((req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Маршрут не найден' });
      return;
    }
    next();
  });

  app.use(
    express.static(directory, {
      index: false,
      redirect: false,
      cacheControl: false,
      setHeaders(res, filePath) {
        const immutable = filePath.startsWith(assets) && hashedAsset.test(basename(filePath));
        res.setHeader(
          'Cache-Control',
          immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    }),
  );

  if (archive) {
    for (const previous of previousAssetDirectories(directory, archive)) {
      app.use(
        '/assets',
        express.static(previous, {
          index: false,
          redirect: false,
          immutable: true,
          maxAge: '1y',
        }),
      );
    }
  }

  app.use((req, res) => {
    const navigation = req.method === 'GET' && (req.get('accept') ?? '').includes('text/html');
    if (navigation && applicationRoutes.has(req.path)) {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
      return;
    }
    // Missing CSS, scripts and images must never receive the SPA document.
    res.status(404).type('text/plain').set('Cache-Control', 'no-cache').send('Not found');
  });
}
