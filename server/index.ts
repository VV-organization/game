import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from './app';
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
    server.close(() => {
      application.close();
      process.exit(0);
    });
  });
