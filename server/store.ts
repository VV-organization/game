import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PaymentMethod, PaymentMode, PaymentStatus, User } from '../src/shared/types';
import { defaultEquipped, productById } from './catalog';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export type TopupRow = {
  id: string;
  user_id: string;
  creator_hash: string;
  idem_key: string;
  rub: number;
  fapix: number;
  method: PaymentMethod;
  status: PaymentStatus;
  mode: PaymentMode;
  provider_id: string | null;
  provider_config: string | null;
  checkout_url: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
};
type AccountRow = {
  id: string;
  login: string;
  password_hash: string;
  balance: number;
  equipped: string;
};

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string, economy: 'sandbox' | 'live') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),equipped TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS owned (user_id TEXT NOT NULL REFERENCES users(id),product_id TEXT NOT NULL,PRIMARY KEY(user_id,product_id));
   CREATE TABLE IF NOT EXISTS topups (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),creator_hash TEXT NOT NULL,idem_key TEXT NOT NULL,rub INTEGER NOT NULL CHECK(rub>0),fapix INTEGER NOT NULL CHECK(fapix>0),method TEXT NOT NULL,status TEXT NOT NULL,mode TEXT NOT NULL,provider_id TEXT,provider_config TEXT,checkout_url TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(creator_hash,idem_key));
   CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),product_id TEXT NOT NULL,name TEXT NOT NULL,fapix INTEGER NOT NULL CHECK(fapix>0),idem_key TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,idem_key));
   CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL,reference TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS topups_user ON topups(user_id,created_at);
   CREATE INDEX IF NOT EXISTS purchases_user ON purchases(user_id,created_at);`);
    const topupColumns = this.db.prepare('PRAGMA table_info(topups)').all() as { name: string }[];
    if (!topupColumns.some((c) => c.name === 'review_reason'))
      this.db.exec('ALTER TABLE topups ADD COLUMN review_reason TEXT');
    const previous = this.db.prepare('SELECT value FROM settings WHERE key=?').get('economy') as
      { value: string } | undefined;
    if (previous && previous.value !== economy) {
      this.db.close();
      throw new Error('Sandbox and real wallets require separate databases');
    }
    this.db
      .prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)')
      .run('economy', economy);
  }
  close() {
    this.db.close();
  }
  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  accountByLogin(login: string) {
    return this.db.prepare('SELECT * FROM users WHERE login=? COLLATE NOCASE').get(login) as
      AccountRow | undefined;
  }
  user(id: string): User {
    const row = this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as AccountRow | undefined;
    if (!row) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Игровой аккаунт не найден');
    return {
      id: row.id,
      login: row.login,
      balance: row.balance,
      owned: (
        this.db
          .prepare('SELECT product_id FROM owned WHERE user_id=? ORDER BY product_id')
          .all(id) as { product_id: string }[]
      ).map((r) => r.product_id),
      equipped: JSON.parse(row.equipped),
    };
  }
  register(login: string, passwordHash: string): User {
    return this.transaction(() => {
      if (this.accountByLogin(login))
        throw new ApiError(409, 'LOGIN_TAKEN', 'Этот логин уже занят');
      const id = randomUUID();
      this.db
        .prepare('INSERT INTO users(id,login,password_hash,equipped,created_at) VALUES(?,?,?,?,?)')
        .run(id, login, passwordHash, JSON.stringify(defaultEquipped), new Date().toISOString());
      return this.user(id);
    });
  }
  createSession(userId: string) {
    const token = randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    this.db
      .prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .run(digest(token), userId, Date.now() + 30 * 86400000);
    return token;
  }
  session(token: string | undefined): User | null {
    if (!token) return null;
    const row = this.db
      .prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?')
      .get(digest(token), Date.now()) as { user_id: string } | undefined;
    return row ? this.user(row.user_id) : null;
  }
  logout(token: string | undefined) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
  }
  topup(id: string) {
    return this.db.prepare('SELECT * FROM topups WHERE id=?').get(id) as TopupRow | undefined;
  }
  createTopup(input: {
    userId: string;
    creatorHash: string;
    key: string;
    rub: number;
    method: PaymentMethod;
    mode: PaymentMode;
    configurationId: string;
  }): { row: TopupRow; created: boolean } {
    return this.transaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM topups WHERE creator_hash=? AND idem_key=?')
        .get(input.creatorHash, input.key) as TopupRow | undefined;
      if (existing) {
        if (
          existing.user_id !== input.userId ||
          existing.rub !== input.rub ||
          existing.method !== input.method
        )
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Этот запрос уже использован для другого платежа',
          );
        return { row: existing, created: false };
      }
      const id = randomUUID(),
        now = new Date().toISOString();
      this.db
        .prepare(
          'INSERT INTO topups(id,user_id,creator_hash,idem_key,rub,fapix,method,status,mode,provider_config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          input.userId,
          input.creatorHash,
          input.key,
          input.rub,
          input.rub * 2,
          input.method,
          'pending',
          input.mode,
          input.configurationId,
          now,
          now,
        );
      return { row: this.topup(id)!, created: true };
    });
  }
  attachProvider(id: string, providerId: string, url: string) {
    this.db
      .prepare(
        'UPDATE topups SET provider_id=?,checkout_url=?,review_reason=NULL,updated_at=? WHERE id=? AND provider_id IS NULL',
      )
      .run(providerId, url, new Date().toISOString(), id);
  }
  markReview(id: string, reason: string) {
    this.db
      .prepare("UPDATE topups SET review_reason=?,updated_at=? WHERE id=? AND status!='success'")
      .run(reason, new Date().toISOString(), id);
  }
  settle(id: string, status: PaymentStatus): TopupRow {
    return this.transaction(() => {
      const row = this.topup(id);
      if (!row) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Пополнение не найдено');
      // A confirmed success is final; a late authoritative success may correct a prior failure.
      if (row.status === 'success') return row;
      if (status === 'pending') {
        this.db
          .prepare('UPDATE topups SET review_reason=NULL,updated_at=? WHERE id=?')
          .run(new Date().toISOString(), id);
        return this.topup(id)!;
      }
      const now = new Date().toISOString();
      if (status === 'success') {
        const ledger = this.db
          .prepare(
            'INSERT OR IGNORE INTO ledger(id,user_id,amount,reference,created_at) VALUES(?,?,?,?,?)',
          )
          .run(randomUUID(), row.user_id, row.fapix, `topup:${id}`, now);
        if (ledger.changes === 1)
          this.db
            .prepare('UPDATE users SET balance=balance+? WHERE id=?')
            .run(row.fapix, row.user_id);
      }
      this.db
        .prepare('UPDATE topups SET status=?,review_reason=NULL,updated_at=? WHERE id=?')
        .run(status, now, id);
      return this.topup(id)!;
    });
  }
  pendingTopups(): TopupRow[] {
    return this.db
      .prepare(
        "SELECT * FROM topups WHERE mode='arco' AND status!='success' AND provider_id IS NOT NULL ORDER BY updated_at ASC LIMIT 50",
      )
      .all() as TopupRow[];
  }
  purchase(userId: string, productId: string, key: string): User {
    const product = productById.get(productId);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден');
    return this.transaction(() => {
      const previous = this.db
        .prepare('SELECT product_id FROM purchases WHERE user_id=? AND idem_key=?')
        .get(userId, key) as { product_id: string } | undefined;
      if (previous) {
        if (previous.product_id !== productId)
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Этот запрос уже использован для другой покупки',
          );
        return this.user(userId);
      }
      const user = this.user(userId);
      if (user.owned.includes(productId))
        throw new ApiError(409, 'ALREADY_OWNED', 'Этот товар уже куплен');
      if (product.bundle?.every((id) => user.owned.includes(id)))
        throw new ApiError(409, 'ALREADY_OWNED', 'Все предметы комплекта уже куплены');
      if (user.balance < product.price)
        throw new ApiError(409, 'INSUFFICIENT_BALANCE', 'Недостаточно Fapix. Пополните баланс');
      const now = new Date().toISOString(),
        id = randomUUID();
      this.db
        .prepare('UPDATE users SET balance=balance-? WHERE id=? AND balance>=?')
        .run(product.price, userId, product.price);
      for (const item of [product.id, ...(product.bundle ?? [])])
        this.db
          .prepare('INSERT OR IGNORE INTO owned(user_id,product_id) VALUES(?,?)')
          .run(userId, item);
      this.db
        .prepare(
          'INSERT INTO purchases(id,user_id,product_id,name,fapix,idem_key,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .run(id, userId, productId, product.name, product.price, key, now);
      this.db
        .prepare('INSERT INTO ledger(id,user_id,amount,reference,created_at) VALUES(?,?,?,?,?)')
        .run(randomUUID(), userId, -product.price, `purchase:${id}`, now);
      return this.user(userId);
    });
  }
  equip(userId: string, productId: string): User {
    const product = productById.get(productId);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден');
    return this.transaction(() => {
      const user = this.user(userId);
      if (!user.owned.includes(productId))
        throw new ApiError(403, 'NOT_OWNED', 'Сначала приобретите этот товар');
      const next = { ...user.equipped };
      for (const item of product.bundle ?? [productId]) {
        const p = productById.get(item)!;
        next[p.category] = item;
      }
      this.db.prepare('UPDATE users SET equipped=? WHERE id=?').run(JSON.stringify(next), userId);
      return this.user(userId);
    });
  }
  history(userId: string) {
    return {
      topups: this.db
        .prepare(
          'SELECT id,created_at AS date,method,rub,fapix,status FROM topups WHERE user_id=? ORDER BY created_at DESC',
        )
        .all(userId),
      purchases: this.db
        .prepare(
          "SELECT id,created_at AS date,name,fapix,'success' AS status FROM purchases WHERE user_id=? ORDER BY created_at DESC",
        )
        .all(userId),
    };
  }
}
