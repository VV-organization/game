import express, { type Express } from 'express';
import { basename, resolve, sep } from 'node:path';

const applicationRoutes = new Set(['/', '/play', '/garage', '/shop', '/records']);
const hashedAsset = /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

export function mountFrontend(app: Express, directory: string) {
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
