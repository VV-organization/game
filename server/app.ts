import express, { type NextFunction, type Request, type Response } from 'express';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Store, ApiError, digest, type TopupRow } from './store';
import { createPaymentGateway, ProviderError, type PaymentGateway } from './payments';
import { categories, products, popularIds } from './catalog';
import { customizationFor } from '../src/lib/customization';
import type { OnlineIdentity } from '../src/shared/online-protocol';
import type { User } from '../src/shared/types';

const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt)).toString('hex')}`;
}
async function checkPassword(password: string, stored?: string) {
  const [salt, expected] = (
    stored ?? '00000000000000000000000000000000:' + Buffer.alloc(64).toString('hex')
  ).split(':');
  const actual = await derive(password, salt);
  const bytes = Buffer.from(expected, 'hex');
  return bytes.length === actual.length && timingSafeEqual(bytes, actual) && !!stored;
}
function cookies(req: Request): Record<string, string> {
  return Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map((x) => x.trim().split('=').slice(0, 2))
      .filter((x) => x.length === 2),
  );
}
function loginValue(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(value.trim()))
    throw new ApiError(
      400,
      'INVALID_LOGIN',
      'Логин: от 3 до 24 латинских букв, цифр или подчёркиваний',
    );
  return value.trim().toLowerCase();
}
function passwordValue(value: unknown) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128)
    throw new ApiError(400, 'INVALID_PASSWORD', 'Пароль должен содержать от 8 до 128 символов');
  return value;
}
function idempotency(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(value))
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Неверный идентификатор запроса');
  return value;
}
function productId(value: unknown) {
  if (typeof value !== 'string' || value.length > 100)
    throw new ApiError(400, 'INVALID_PRODUCT', 'Выберите товар');
  return value;
}
function amount(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 100000)
    throw new ApiError(400, 'INVALID_AMOUNT', 'Введите целую сумму от 1 до 100 000 ₽');
  return value;
}
export interface ApplicationOptions {
  dbPath?: string;
  env?: Record<string, string | undefined>;
  gateway?: PaymentGateway;
}

export function createApplication(options: ApplicationOptions = {}) {
  const env = options.env ?? process.env,
    gateway = options.gateway ?? createPaymentGateway(env);
  const store = new Store(
    options.dbPath ?? ':memory:',
    gateway.mode === 'arco' ? 'live' : 'disabled',
  );
  const app = express();
  app.disable('x-powered-by');
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 86400000,
  };
  const getUser = (req: Request) => store.session(cookies(req).fapix_session);
  const requireUser = (req: Request): User => {
    const user = getUser(req);
    if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Войдите в игровой аккаунт');
    return user;
  };
  function visitor(req: Request, res?: Response) {
    const existing = cookies(req).fapix_visitor;
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return digest(existing);
    if (!res) return '';
    const token = randomBytes(32).toString('hex');
    res.cookie('fapix_visitor', token, cookieOptions);
    return digest(token);
  }
  function actor(req: Request, res?: Response) {
    const user = getUser(req);
    return user ? digest(`account:${user.id}`) : visitor(req, res);
  }
  function accessTopup(req: Request) {
    const row = store.topup(String(req.params.id));
    if (
      !row ||
      (row.creator_hash !== actor(req) &&
        row.creator_hash !== visitor(req) &&
        row.user_id !== getUser(req)?.id)
    )
      throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Пополнение не найдено');
    return row;
  }
  function topupResponse(req: Request, row: TopupRow) {
    const current = getUser(req),
      recipient = store.user(row.user_id);
    return {
      id: row.id,
      login: recipient.login,
      rub: row.rub,
      fapix: row.fapix,
      method: row.method,
      paymentMode: gateway.mode,
      ...(row.checkout_url ? { checkoutUrl: row.checkout_url } : {}),
      status: row.status,
      ...(row.review_reason
        ? {
            requiresReview: true,
            reviewReason: row.review_reason,
            message:
              row.review_reason === 'checkout_unavailable'
                ? 'Платёж создан, но страница оплаты временно недоступна. Проверяем статус; повторную оплату создавать не нужно.'
                : 'Проверяем создание платежа у провайдера. Не создавайте повторную оплату. Сохраните номер операции для обращения в поддержку.',
          }
        : {}),
      ...(current?.id === row.user_id ? { user: recipient } : {}),
    };
  }
  async function reconcile(row: TopupRow, providerId = row.provider_id) {
    if (
      !providerId ||
      row.mode !== 'arco' ||
      gateway.mode !== 'arco' ||
      row.provider_config !== gateway.configurationId
    )
      return row;
    if (row.status === 'success') return row;
    const observed = await gateway.status(providerId);
    if (
      observed.merchantOrderId !== row.id ||
      observed.rub !== row.rub ||
      (observed.method && observed.method !== row.method)
    )
      throw new ApiError(502, 'PAYMENT_MISMATCH', 'Платёж требует проверки. Баланс не изменён');
    if (row.provider_id && row.provider_id !== providerId)
      throw new ApiError(502, 'PAYMENT_MISMATCH', 'Платёж требует проверки');
    if (!row.provider_id) store.attachProvider(row.id, providerId, '');
    if (store.topup(row.id)?.provider_id !== providerId)
      throw new ApiError(502, 'PAYMENT_MISMATCH', 'Платёж требует проверки');
    let settled = store.settle(row.id, observed.status);
    if (settled.status === 'pending' && !settled.checkout_url && gateway.checkout) {
      try {
        const url = await gateway.checkout(
          { id: row.id, rub: row.rub, method: row.method, login: store.user(row.user_id).login },
          providerId,
        );
        store.db
          .prepare('UPDATE topups SET checkout_url=? WHERE id=? AND provider_id=?')
          .run(url, row.id, providerId);
      } catch {
        store.markReview(row.id, 'checkout_unavailable');
      }
      settled = store.topup(row.id)!;
    }
    return settled;
  }
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  // Raw bytes are necessary for RSA verification; this endpoint never trusts callback state.
  app.post(
    '/api/payments/arco/callback',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      if (gateway.mode !== 'arco')
        throw new ApiError(503, 'PAYMENTS_DISABLED', 'Оплата не подключена');
      const claim = gateway.verifyCallback?.(req.body as Buffer, req.get('Payment-Sign') ?? '');
      if (!claim) throw new ApiError(401, 'INVALID_SIGNATURE', 'Недействительная подпись');
      const row = store.topup(claim.merchantOrderId);
      if (!row || row.mode !== 'arco' || row.provider_config !== gateway.configurationId)
        throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Пополнение не найдено');
      await reconcile(row, claim.providerId);
      res.json({ ok: true });
    },
  );
  app.use('/api', express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!req.is('application/json'))
        return next(new ApiError(415, 'JSON_REQUIRED', 'Требуется JSON'));
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site')
        return next(new ApiError(403, 'ORIGIN_REJECTED', 'Недопустимый источник запроса'));
      if (origin) {
        try {
          const expected = env.PUBLIC_URL
            ? new URL(env.PUBLIC_URL).origin
            : `${req.protocol}://${req.get('host')}`;
          const received = new URL(origin).origin;
          const localDevelopment =
            env.NODE_ENV !== 'production' &&
            !env.PUBLIC_URL &&
            ['http://127.0.0.1:5173', 'http://localhost:5173'].includes(received);
          if (received !== expected && !localDevelopment)
            return next(new ApiError(403, 'ORIGIN_REJECTED', 'Недопустимый источник запроса'));
        } catch {
          return next(new ApiError(403, 'ORIGIN_REJECTED', 'Недопустимый источник запроса'));
        }
      }
    }
    next();
  });
  const rateBuckets = new Map<string, { count: number; expires: number }>();
  app.use('/api', (req, _res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/accounts')) return next();
    const key = `${req.ip}:${req.path.startsWith('/auth') ? 'auth' : req.path.startsWith('/topups') ? 'topup' : 'general'}`,
      now = Date.now();
    if (rateBuckets.size > 10000)
      for (const [k, v] of rateBuckets) if (v.expires < now) rateBuckets.delete(k);
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.expires < now) {
      bucket = { count: 0, expires: now + 60000 };
      rateBuckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > (req.path.startsWith('/auth') ? 20 : 120))
      return next(
        new ApiError(429, 'RATE_LIMIT', 'Слишком много запросов. Попробуйте через минуту'),
      );
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', paymentMode: gateway.mode }));
  app.get('/api/catalog', (_req, res) => res.json({ products, categories, popularIds }));
  app.get('/api/session', (req, res) => {
    visitor(req, res);
    res.json({ user: getUser(req), paymentMode: gateway.mode });
  });
  app.post('/api/auth/register', async (req, res) => {
    const login = loginValue(req.body?.login),
      password = passwordValue(req.body?.password);
    const user = store.register(login, await hashPassword(password));
    store.logout(cookies(req).fapix_session);
    res.cookie('fapix_session', store.createSession(user.id), cookieOptions);
    res.status(201).json({ user });
  });
  app.post('/api/auth/login', async (req, res) => {
    const login = loginValue(req.body?.login);
    const password =
      typeof req.body?.password === 'string' && req.body.password.length <= 128
        ? req.body.password
        : '';
    const account = store.accountByLogin(login);
    if (!(await checkPassword(password, account?.password_hash)))
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль');
    store.logout(cookies(req).fapix_session);
    res.cookie('fapix_session', store.createSession(account!.id), cookieOptions);
    res.json({ user: store.user(account!.id) });
  });
  app.post('/api/auth/logout', (req, res) => {
    store.logout(cookies(req).fapix_session);
    res.clearCookie('fapix_session', { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  });
  app.get('/api/accounts/:login', (req, res) =>
    res.json({ exists: !!store.accountByLogin(loginValue(req.params.login)) }),
  );
  app.get('/api/history', (req, res) => res.json(store.history(requireUser(req).id)));
  app.post('/api/purchase', (req, res) =>
    res.json({
      user: store.purchase(
        requireUser(req).id,
        productId(req.body?.productId),
        idempotency(req.body?.idempotencyKey),
      ),
    }),
  );
  app.post('/api/equip', (req, res) =>
    res.json({ user: store.equip(requireUser(req).id, productId(req.body?.productId)) }),
  );
  app.post('/api/topups', async (req, res) => {
    if (gateway.mode !== 'arco')
      throw new ApiError(503, 'PAYMENTS_DISABLED', 'Платежи пока не подключены');
    const login = loginValue(req.body?.login),
      rub = amount(req.body?.rub),
      key = idempotency(req.body?.idempotencyKey),
      method = req.body?.method;
    if (method !== 'card' && method !== 'sbp')
      throw new ApiError(400, 'INVALID_METHOD', 'Выберите карту или СБП');
    const account = store.accountByLogin(login);
    if (!account)
      throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Аккаунт не найден. Зарегистрируйтесь');
    if (!getUser(req) && !visitor(req)) {
      visitor(req, res);
      throw new ApiError(409, 'VISITOR_REQUIRED', 'Сессия оплаты подготовлена. Повторите запрос');
    }
    const result = store.createTopup({
      userId: account.id,
      creatorHash: actor(req, res),
      key,
      rub,
      method,
      mode: gateway.mode,
      configurationId: gateway.configurationId,
    });
    let row = result.row;
    if (gateway.mode === 'arco' && row.status === 'pending') {
      try {
        if (result.created) {
          const payment = await gateway.create({
            id: row.id,
            rub,
            method,
            login,
            onOrderCreated: (providerId) => store.attachProvider(row.id, providerId, ''),
          });
          store.attachProvider(row.id, payment.providerId, payment.checkoutUrl);
          store.db
            .prepare('UPDATE topups SET checkout_url=? WHERE id=? AND provider_id=?')
            .run(payment.checkoutUrl, row.id, payment.providerId);
        } else if (row.provider_id && !row.checkout_url && gateway.checkout) {
          const url = await gateway.checkout({ id: row.id, rub, method, login }, row.provider_id);
          store.db.prepare('UPDATE topups SET checkout_url=? WHERE id=?').run(url, row.id);
        }
      } catch (error) {
        const saved = store.topup(row.id)!;
        if (!saved.provider_id) {
          if (error instanceof ProviderError && !error.ambiguous) {
            store.settle(row.id, 'failed');
            throw error;
          }
          store.markReview(row.id, 'create_unconfirmed');
          return res.status(202).json(topupResponse(req, store.topup(row.id)!));
        }
        throw error;
      }
      row = store.topup(row.id)!;
    }
    res.status(row.review_reason ? 202 : result.created ? 201 : 200).json(topupResponse(req, row));
  });
  app.get('/api/topups/:id', async (req, res) => {
    const row = accessTopup(req);
    if (row.mode === 'sandbox' && row.status === 'pending')
      throw new ApiError(410, 'PAYMENT_RETIRED', 'Старый тестовый платёж больше недоступен');
    res.json(topupResponse(req, await reconcile(row)));
  });
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'NOT_FOUND', message: 'Маршрут не найден' }),
  );
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof ProviderError)
      return res.status(502).json({ error: 'PROVIDER_UNAVAILABLE', message: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: 'INVALID_JSON', message: 'Некорректный JSON' });
    console.error('API request failed', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Не удалось выполнить действие. Попробуйте позже',
    });
  });
  let reconciling = false;
  async function reconcilePending() {
    if (reconciling || gateway.mode !== 'arco') return;
    reconciling = true;
    try {
      for (const row of store.pendingTopups()) {
        try {
          await reconcile(row);
        } catch {
          /* Preserve pending state when the provider cannot be verified. */
        }
      }
    } finally {
      reconciling = false;
    }
  }
  const resolveOnlineIdentity = (cookieHeader: string): OnlineIdentity | null => {
    const jar = Object.fromEntries(
      cookieHeader
        .split(';')
        .map((part) => part.trim().split('=').slice(0, 2))
        .filter((pair) => pair.length === 2),
    );
    const user = store.session(jar.fapix_session);
    if (user)
      return {
        actorId: digest(`account:${user.id}`),
        name: user.login,
        customization: customizationFor(user.equipped, products),
      };
    const token = jar.fapix_visitor;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return {
      actorId: digest(token),
      name: `Гость ${digest(token).slice(0, 4)}`,
      customization: {},
    };
  };
  return {
    app,
    store,
    resolveOnlineIdentity,
    paymentMode: gateway.mode,
    reconcilePending,
    close: () => store.close(),
  };
}
