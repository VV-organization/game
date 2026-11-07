import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from './app';
import { attachOnlineServer } from './online';
import { mountFrontend } from './static';

const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(resolve(root, '.env'))) loadEnvFile(resolve(root, '.env'));
const dbPath = process.env.DATABASE_PATH ?? resolve(root, 'data', 'fapix.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const application = createApplication({ dbPath });
const distribution = resolve(root, 'dist');
if (existsSync(distribution)) {
  mountFrontend(application.app, distribution);
}
const server = createServer(application.app);
const online = attachOnlineServer(server, {
  resolveIdentity: application.resolveOnlineIdentity,
  allowedOrigins: process.env.PUBLIC_URL
    ? [new URL(process.env.PUBLIC_URL).origin]
    : process.env.NODE_ENV !== 'production'
      ? [
          'http://127.0.0.1:5173',
          'http://localhost:5173',
          `http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 3001}`,
        ]
      : undefined,
});
const port = Number(process.env.PORT ?? 3001),
  host = process.env.HOST ?? '127.0.0.1';
const timer = setInterval(() => void application.reconcilePending(), 30000);
timer.unref();
void application.reconcilePending();
server.listen(port, host, () =>
  console.info(`FApix Racing API: http://${host}:${port} (payments: ${application.paymentMode})`),
);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    online.close();
    server.close(() => {
      application.close();
      process.exit(0);
    });
  });
