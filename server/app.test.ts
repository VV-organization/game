import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApplication } from './app';
import { products, popularIds } from './catalog';
import type { PaymentGateway } from './payments';
import { ProviderError } from './payments';

let server: Server;
let base: string;
let application: ReturnType<typeof createApplication>;
const clients: Record<string, string> = {};
async function request(path: string, body?: unknown, client = 'alice', method?: string) {
  const response = await fetch(base + path, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(clients[client] ? { cookie: clients[client] } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const incoming = response.headers.getSetCookie().map((c) => c.split(';')[0]);
  if (incoming.length) {
    const all = new Map(
      (clients[client] ?? '')
        .split('; ')
        .filter(Boolean)
        .map((c) => [c.split('=')[0], c]),
    );
    incoming.forEach((c) => all.set(c.split('=')[0], c));
    clients[client] = [...all.values()].join('; ');
  }
  return {
    status: response.status,
    body: await response.json(),
    cookies: response.headers.getSetCookie(),
  };
}
async function register(login = 'alice', client = login) {
  return request('/api/auth/register', { login, password: 'correct-horse-battery' }, client);
}
async function fund(rub = 5205, client = 'alice') {
  const result = await request(
    '/api/topups',
    { login: client, rub, method: 'card', idempotencyKey: crypto.randomUUID() },
    client,
  );
  return request(`/api/topups/${result.body.id}/sandbox`, { outcome: 'success' }, client);
}
async function replaceGateway(gateway: PaymentGateway) {
  await new Promise<void>((r) => server.close(() => r()));
  application.close();
  application = createApplication({ dbPath: ':memory:', gateway });
  server = createServer(application.app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
  Object.keys(clients).forEach((k) => delete clients[k]);
}
beforeEach(async () => {
  Object.keys(clients).forEach((k) => delete clients[k]);
  application = createApplication({ dbPath: ':memory:', env: { PAYMENT_MODE: 'sandbox' } });
  server = createServer(application.app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
});
afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  application.close();
});

describe('catalog economy', () => {
  it('contains 300+ real SKUs, explicit minima and exact popular denominations', () => {
    expect(products.length).toBeGreaterThanOrEqual(300);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    for (const [category, minimum] of Object.entries({
      car: 10,
      color: 20,
      body: 20,
      wheels: 20,
      garage: 10,
      decor: 20,
      helmet: 20,
      suit: 20,
    }))
      expect(
        products.filter((p) => p.category === category).length,
        category,
      ).toBeGreaterThanOrEqual(minimum);
    expect(popularIds.map((id) => products.find((p) => p.id === id)?.price)).toEqual([
      622, 1168, 2078, 4154, 5806, 10410,
    ]);
    const cars = products.filter((p) => p.category === 'car');
    for (let i = 1; i < cars.length; i++) {
      expect(cars[i].price).toBeGreaterThan(cars[i - 1].price);
      for (const stat of ['speed', 'acceleration', 'handling'] as const)
        expect(cars[i].stats![stat]).toBeGreaterThan(cars[i - 1].stats![stat]);
    }
  });
});
describe('accounts and authorization', () => {
  it('accepts the local Vite origin in development and rejects foreign origins', async () => {
    const send = (origin: string) =>
      fetch(base + '/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ login: 'vite_user', password: 'correct-horse-battery' }),
      });
    expect((await send('https://untrusted.example')).status).toBe(403);
    expect((await send('http://127.0.0.1:5173')).status).toBe(201);
  });
  it('starts at zero, stores only an HttpOnly session cookie and isolates sessions', async () => {
    const alice = await register();
    expect(alice.status).toBe(201);
    expect(alice.body.user.balance).toBe(0);
    expect(alice.cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    expect(JSON.stringify(alice.body)).not.toContain('password');
    await register('bob');
    expect((await request('/api/session', undefined, 'bob')).body.user.login).toBe('bob');
    expect((await request('/api/session')).body.user.login).toBe('alice');
    expect((await request('/api/history', undefined, 'guest')).status).toBe(401);
    expect(
      (await request('/api/auth/login', { login: 'alice', password: 'wrong' }, 'guest')).status,
    ).toBe(401);
    await request('/api/auth/logout', {});
    expect((await request('/api/session')).body.user).toBeNull();
  });
  it('normalizes login identity and rejects duplicate registration and malformed credentials', async () => {
    await register();
    expect((await register('ALICE', 'other')).status).toBe(409);
    expect((await request('/api/auth/register', { login: 'xx', password: 'short' })).status).toBe(
      400,
    );
  });
});
describe('money and ownership', () => {
  it('returns immutable payment details for a safe resume after navigation', async () => {
    await register();
    const created = await request('/api/topups', {
      login: 'alice',
      rub: 311,
      method: 'sbp',
      idempotencyKey: 'resume-test-key',
    });
    expect((await request(`/api/topups/${created.body.id}`)).body).toMatchObject({
      id: created.body.id,
      login: 'alice',
      rub: 311,
      fapix: 622,
      method: 'sbp',
      paymentMode: 'sandbox',
      status: 'pending',
    });
  });
  it('uses account identity for idempotency even on concurrent first payment requests', async () => {
    await register();
    const body = {
      login: 'alice',
      rub: 311,
      method: 'card',
      idempotencyKey: 'concurrent-first-key',
    };
    const responses = await Promise.all([
      request('/api/topups', body),
      request('/api/topups', body),
    ]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect((await request('/api/history')).body.topups).toHaveLength(1);
  });
  it('validates money and does not let a disabled provider produce credit', async () => {
    await register();
    for (const rub of [0, -1, 0.01, Number.MAX_SAFE_INTEGER, '311', null])
      expect(
        (
          await request('/api/topups', {
            login: 'alice',
            rub,
            method: 'card',
            idempotencyKey: crypto.randomUUID(),
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await request('/api/topups', {
          login: 'missing',
          rub: 311,
          method: 'card',
          idempotencyKey: 'missing-account-key',
        })
      ).status,
    ).toBe(404);
  });
  it('credits exactly once with immutable amount and account, and keeps failure at zero', async () => {
    await register();
    const body = { login: 'alice', rub: 311, method: 'sbp', idempotencyKey: 'same-topup-key' };
    const first = await request('/api/topups', body);
    expect(first.status).toBe(201);
    expect((await request('/api/topups', body)).body.id).toBe(first.body.id);
    expect((await request('/api/topups', { ...body, rub: 584 })).status).toBe(409);
    await Promise.all([
      request(`/api/topups/${first.body.id}/sandbox`, { outcome: 'success' }),
      request(`/api/topups/${first.body.id}/sandbox`, { outcome: 'success' }),
    ]);
    expect((await request('/api/session')).body.user.balance).toBe(622);
    await request(`/api/topups/${first.body.id}/sandbox`, { outcome: 'failed' });
    expect((await request('/api/session')).body.user.balance).toBe(622);
    const failed = await request('/api/topups', { ...body, idempotencyKey: 'failure-topup-key' });
    await request(`/api/topups/${failed.body.id}/sandbox`, { outcome: 'failed' });
    expect((await request('/api/history')).body.topups).toHaveLength(2);
    expect((await request('/api/session')).body.user.balance).toBe(622);
  });
  it('rejects foreign status access and never exposes recipient wallet to a guest payer', async () => {
    await register();
    await request('/api/session', undefined, 'guest');
    const t = await request(
      '/api/topups',
      { login: 'alice', rub: 311, method: 'card', idempotencyKey: 'guest-topup-key' },
      'guest',
    );
    expect((await request(`/api/topups/${t.body.id}`, undefined, 'stranger')).status).toBe(404);
    const paid = await request(`/api/topups/${t.body.id}/sandbox`, { outcome: 'success' }, 'guest');
    expect(paid.body.user).toBeUndefined();
    expect((await request('/api/session')).body.user.balance).toBe(622);
  });
  it('purchases atomically, prevents duplicate ownership and equips only owned items', async () => {
    await register();
    const product = products.find((p) => p.category === 'color')!;
    expect(
      (await request('/api/purchase', { productId: product.id, idempotencyKey: 'buy-first-key' }))
        .status,
    ).toBe(409);
    expect((await request('/api/equip', { productId: product.id })).status).toBe(403);
    await fund();
    const before = (await request('/api/session')).body.user.balance;
    const purchase = { productId: product.id, idempotencyKey: 'purchase-valid-key' };
    const bought = await request('/api/purchase', purchase);
    expect(bought.status).toBe(200);
    expect(bought.body.user.balance).toBe(before - product.price);
    expect(bought.body.user.owned).toContain(product.id);
    expect((await request('/api/purchase', purchase)).body.user.balance).toBe(
      before - product.price,
    );
    expect(
      (await request('/api/purchase', { ...purchase, idempotencyKey: 'duplicate-owned-key' }))
        .status,
    ).toBe(409);
    expect((await request('/api/equip', { productId: product.id })).body.user.equipped.color).toBe(
      product.id,
    );
    expect((await request('/api/history')).body.purchases).toHaveLength(1);
    await register('bob');
    expect((await request('/api/purchase', purchase, 'bob')).status).toBe(409);
    expect((await request('/api/history', undefined, 'bob')).body.purchases).toHaveLength(0);
  });
  it('does not accept a client race result as a money source', async () => {
    await register();
    expect((await request('/api/race/reward', { amount: 100000, won: true })).status).toBe(404);
    expect((await request('/api/session')).body.user.balance).toBe(0);
  });
});
describe('verified payment settlement', () => {
  it('does not create any guest payment until the browser has an established visitor cookie', async () => {
    await register();
    const body = { login: 'alice', rub: 311, method: 'card', idempotencyKey: 'guest-initial-key' };
    const result = await Promise.all([
      request('/api/topups', body, 'guest'),
      request('/api/topups', body, 'guest'),
    ]);
    expect(result.map((r) => r.status)).toEqual([409, 409]);
    expect((await request('/api/history')).body.topups).toHaveLength(0);
    const retried = await request('/api/topups', body, 'guest');
    expect(retried.status).toBe(201);
    expect((await request('/api/topups', body, 'guest')).body.id).toBe(retried.body.id);
  });
  it('persists explicit review for an unknown CREATE result and recovers only from a verified callback', async () => {
    let merchant = '';
    const create = vi.fn(async (r: { id: string }) => {
      merchant = r.id;
      throw new ProviderError(true);
    });
    const gateway: PaymentGateway = {
      mode: 'arco',
      configurationId: 'test-shop',
      create,
      status: async () => ({
        status: 'success',
        rub: 311,
        method: 'card',
        merchantOrderId: merchant,
      }),
      verifyCallback: () => ({ providerId: 'late-order', merchantOrderId: merchant }),
    };
    await replaceGateway(gateway);
    await register();
    const body = {
      login: 'alice',
      rub: 311,
      method: 'card',
      idempotencyKey: 'ambiguous-create-key',
    };
    const initial = await request('/api/topups', body);
    expect(initial.status).toBe(202);
    expect(initial.body.requiresReview).toBe(true);
    expect(initial.body.id).toBeTruthy();
    const retry = await request('/api/topups', body);
    expect(retry.body.id).toBe(initial.body.id);
    expect(retry.body.requiresReview).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect((await request(`/api/topups/${initial.body.id}`)).body.requiresReview).toBe(true);
    expect((await request('/api/session')).body.user.balance).toBe(0);
    expect((await request('/api/payments/arco/callback', {})).status).toBe(200);
    const result = await request(`/api/topups/${initial.body.id}`);
    expect(result.body.requiresReview).not.toBe(true);
    expect(result.body.status).toBe('success');
    expect(result.body.user.balance).toBe(622);
  });
  it('recovers the existing checkout after a verified early callback without another CREATE', async () => {
    let merchant = '';
    const create = vi.fn(async (r: { id: string }) => {
        merchant = r.id;
        throw new ProviderError(true);
      }),
      checkout = vi.fn(async () => 'https://checkout.example/recovered');
    await replaceGateway({
      mode: 'arco',
      configurationId: 'test-shop',
      create,
      checkout,
      status: async () => ({
        status: 'pending',
        rub: 311,
        method: 'card',
        merchantOrderId: merchant,
      }),
      verifyCallback: () => ({ providerId: 'early-order', merchantOrderId: merchant }),
    });
    await register();
    const created = await request('/api/topups', {
      login: 'alice',
      rub: 311,
      method: 'card',
      idempotencyKey: 'early-callback-key',
    });
    await request('/api/payments/arco/callback', {});
    const result = await request(`/api/topups/${created.body.id}`);
    expect(result.body.checkoutUrl).toBe('https://checkout.example/recovered');
    expect(result.body.requiresReview).not.toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.body.user.balance).toBe(0);
  });
  it('fails closed with payments disabled and never enables the sandbox endpoint', async () => {
    await replaceGateway({
      mode: 'disabled',
      configurationId: 'disabled',
      create: vi.fn(),
      status: vi.fn(),
    });
    await register();
    expect(
      (
        await request('/api/topups', {
          login: 'alice',
          rub: 311,
          method: 'card',
          idempotencyKey: 'disabled-test-key',
        })
      ).status,
    ).toBe(503);
    expect((await request('/api/history')).body.topups).toHaveLength(0);
  });
  it('validates provider account, amount and method before one durable credit', async () => {
    let merchant = '',
      observed = { status: 'pending' as 'pending' | 'success', rub: 311, method: 'card' as const };
    const gateway: PaymentGateway = {
      mode: 'arco',
      configurationId: 'test-shop',
      create: async (r) => {
        merchant = r.id;
        r.onOrderCreated?.('order1');
        return { providerId: 'order1', checkoutUrl: 'https://checkout.example/order1' };
      },
      status: async () => ({ ...observed, merchantOrderId: merchant }),
    };
    await replaceGateway(gateway);
    await register();
    const topup = await request('/api/topups', {
      login: 'alice',
      rub: 311,
      method: 'card',
      idempotencyKey: 'verified-test-key',
    });
    const id = topup.body.id;
    expect((await request(`/api/topups/${id}/sandbox`, { outcome: 'success' })).status).toBe(403);
    expect((await request(`/api/topups/${id}`)).body.user.balance).toBe(0);
    observed = { ...observed, status: 'success', rub: 312 };
    expect((await request(`/api/topups/${id}`)).status).toBe(502);
    expect((await request('/api/session')).body.user.balance).toBe(0);
    observed.rub = 311;
    merchant = 'foreign-merchant';
    expect((await request(`/api/topups/${id}`)).status).toBe(502);
    merchant = id;
    expect((await request(`/api/topups/${id}`)).body.user.balance).toBe(622);
    expect((await request(`/api/topups/${id}`)).body.user.balance).toBe(622);
    expect((await request('/api/history')).body.topups).toHaveLength(1);
  });
});
