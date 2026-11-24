import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError, Store } from './store';
import type { RegistrationStatus } from '../src/shared/types';

const minute = 60_000;
const hour = 60 * minute;
const missing = () => new ApiError(404, 'REGISTRATION_EXPIRED', 'Начните регистрацию заново');
const invalid = () =>
  new ApiError(
    400,
    'INVALID_CODE',
    'Код неверен или истёк. Проверьте письмо или запросите новый код',
  );

export function registrationEmail(value: unknown) {
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_EMAIL', 'Введите адрес почты');
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)
  )
    throw new ApiError(400, 'INVALID_EMAIL', 'Введите адрес почты');
  return email;
}

type Pending = {
  id: string;
  login: string;
  password_hash: string;
  email: string;
  active_version: string | null;
  code_hash: string | null;
  expires_at: number;
  resend_at: number;
  attempts: number;
  sending: string | null;
  lease_until: number;
  keep_until: number;
};
type NewAccount = { login: string; passwordHash: string };

export class Registration {
  constructor(
    private store: Store,
    private secret: string | undefined,
    private send: (email: string, code: string, requestId: string) => Promise<void>,
    private now = Date.now,
  ) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, login TEXT NOT NULL, password_hash TEXT NOT NULL, email TEXT NOT NULL,
      active_version TEXT, code_hash TEXT, expires_at INTEGER DEFAULT 0, resend_at INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0, sending TEXT, lease_until INTEGER DEFAULT 0, keep_until INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS registrations_expiration ON registrations(keep_until);
    CREATE TABLE IF NOT EXISTS registration_sends(email TEXT NOT NULL, ip TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS registration_sends_at ON registration_sends(at);
    CREATE INDEX IF NOT EXISTS registration_sends_by_email ON registration_sends(email,at);
    CREATE INDEX IF NOT EXISTS registration_sends_by_ip ON registration_sends(ip,at);`);
  }
  private row(id: string) {
    return this.store.db
      .prepare('SELECT * FROM registrations WHERE id=? AND keep_until>?')
      .get(id, this.now()) as Pending | undefined;
  }
  private hash(id: string, version: string, email: string, code: string) {
    if (!this.secret || this.secret.length < 32)
      throw new ApiError(503, 'MAIL_UNAVAILABLE', 'Отправка писем временно недоступна');
    return createHmac('sha256', this.secret)
      .update(JSON.stringify([id, version, email, code]))
      .digest('hex');
  }
  status(id: string): RegistrationStatus | null {
    const row = this.row(id);
    if (!row?.active_version) return null;
    const [local, domain] = row.email.split('@');
    return {
      maskedEmail: local[0] + '***@' + domain,
      expiresAt: row.expires_at,
      resendAt: row.resend_at,
    };
  }
  async issue(id: string, ip: string, address?: string, account?: NewAccount) {
    const db = this.store.db;
    const now = this.now();
    const version = randomUUID();
    const code = randomInt(1_000_000).toString().padStart(6, '0');
    const work = this.store.transaction(() => {
      db.prepare('DELETE FROM registrations WHERE keep_until<=?').run(now);
      db.prepare('DELETE FROM registration_sends WHERE at<=?').run(now - hour);
      const row = this.row(id);
      if (!row && !account) throw missing();
      const email = address ?? row!.email;
      if (row?.sending && row.lease_until > now)
        throw new ApiError(409, 'SENDING', 'Письмо уже отправляется. Подождите несколько секунд');
      if (row && account && (row.login !== account.login || row.email !== email))
        throw new ApiError(
          409,
          'REGISTRATION_CHANGED',
          'Продолжите начатую регистрацию или начните новую',
        );
      if (row && row.resend_at > now) {
        if (row.email === email) return null;
        throw new ApiError(
          429,
          'RESEND_COOLDOWN',
          'Новый адрес можно указать через минуту после отправки',
        );
      }
      if (account && this.store.accountByLogin(account.login))
        throw new ApiError(409, 'LOGIN_TAKEN', 'Этот логин уже занят');
      if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
        throw new ApiError(409, 'EMAIL_TAKEN', 'Этот адрес уже используется');
      for (const [column, value, limit] of [
        ['email', email, 5],
        ['ip', ip, 20],
      ] as const) {
        const quota = db
          .prepare(
            `SELECT COUNT(*) AS n, MIN(at) AS first FROM registration_sends WHERE ${column}=?`,
          )
          .get(value) as { n: number; first: number };
        if (quota.n >= limit)
          throw new ApiError(
            429,
            'MAIL_LIMIT',
            `Повторите отправку через ${Math.max(1, Math.ceil((quota.first + hour - now) / minute))} мин.`,
          );
      }
      const hash = this.hash(id, version, email, code);
      if (!row)
        db.prepare(
          'INSERT INTO registrations(id,login,password_hash,email,keep_until) VALUES(?,?,?,?,?)',
        ).run(id, account!.login, account!.passwordHash, email, now + hour);
      db.prepare('UPDATE registrations SET sending=?,lease_until=?,keep_until=? WHERE id=?').run(
        version,
        now + minute,
        now + hour,
        id,
      );
      db.prepare('INSERT INTO registration_sends(email,ip,at) VALUES(?,?,?)').run(email, ip, now);
      return { email, hash };
    });
    if (work) {
      try {
        await this.send(work.email, code, version);
      } catch {
        db.prepare(
          'DELETE FROM registrations WHERE id=? AND sending=? AND active_version IS NULL',
        ).run(id, version);
        db.prepare('UPDATE registrations SET sending=NULL WHERE id=? AND sending=?').run(
          id,
          version,
        );
        throw new ApiError(
          503,
          'MAIL_UNAVAILABLE',
          'Не удалось отправить письмо. Попробуйте ещё раз',
        );
      }
      const accepted = this.now();
      const result = db
        .prepare(
          'UPDATE registrations SET active_version=?,code_hash=?,email=?,expires_at=?,resend_at=?,attempts=0,sending=NULL WHERE id=? AND sending=? AND lease_until>?',
        )
        .run(
          version,
          work.hash,
          work.email,
          accepted + 10 * minute,
          accepted + minute,
          id,
          version,
          accepted,
        );
      if (!result.changes)
        throw new ApiError(
          409,
          'SEND_EXPIRED',
          'Отправка устарела. Проверьте текущий код или запросите новый',
        );
    }
    return this.status(id);
  }
  verify(id: string, code: unknown, previousSession?: string) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw invalid();
    const result = this.store.transaction(() => {
      const row = this.row(id);
      if (!row) throw missing();
      if (
        !row.active_version ||
        !row.code_hash ||
        row.expires_at <= this.now() ||
        row.attempts >= 5
      )
        throw invalid();
      if (
        !timingSafeEqual(
          Buffer.from(row.code_hash, 'hex'),
          Buffer.from(this.hash(id, row.active_version, row.email, code), 'hex'),
        )
      ) {
        this.store.db.prepare('UPDATE registrations SET attempts=attempts+1 WHERE id=?').run(id);
        return null;
      }
      const user = this.store.register(row.login, row.password_hash, row.email);
      this.store.logout(previousSession);
      const token = this.store.createSession(user.id);
      this.store.db.prepare('DELETE FROM registrations WHERE id=?').run(id);
      return { user, token };
    });
    if (!result) throw invalid();
    return result;
  }
}
