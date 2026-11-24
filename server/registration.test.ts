import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';
import { Registration } from './registration';

const key = 'test-only-separate-registration-hmac-key';
const account = { login: 'racer', passwordHash: 'test-hash' };
const email = 'player@example.test';
let directory: string;
let store: Store;
let registration: Registration;
let now: number;
const send = vi.fn(async (_email: string, _code: string) => {});
const lastCode = () => send.mock.calls.at(-1)![1];
function open() {
  store = new Store(join(directory, 'test.sqlite'), 'disabled');
  registration = new Registration(store, key, send, () => now);
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'fapix-otp-'));
  now = Date.now();
  send.mockReset();
  open();
});
afterEach(() => {
  store.close();
  rmSync(directory, { force: true, recursive: true });
});

it('preserves the previous address and code after failed correction, including restart', async () => {
  const state = await registration.issue('reg', 'ip', email, account);
  const original = lastCode();
  now += 60000;
  send.mockRejectedValueOnce(new Error('offline'));
  await expect(registration.issue('reg', 'ip', 'fixed@example.test')).rejects.toMatchObject({
    code: 'MAIL_UNAVAILABLE',
  });
  store.close();
  open();
  expect(registration.status('reg')).toEqual(state);
  expect(registration.verify('reg', original).user.login).toBe('racer');
  expect(store.db.prepare('SELECT email FROM users').get()?.email).toBe(email);
});

it('deduplicates a repeat, replaces an accepted code and atomically limits guesses', async () => {
  const state = await registration.issue('reg', 'ip', email, account);
  expect(await registration.issue('reg', 'ip')).toEqual(state);
  expect(send).toHaveBeenCalledTimes(1);
  now += 60000;
  await registration.issue('reg', 'ip', 'fixed@example.test');
  const good = lastCode();
  const wrong = good === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) expect(() => registration.verify('reg', wrong)).toThrow();
  expect(() => registration.verify('reg', good)).toThrow();
  expect(store.accountByLogin('racer')).toBeUndefined();
});

it('rejects an expired code at the exact ten minute boundary', async () => {
  await registration.issue('reg', 'ip', email, account);
  now += 600000;
  expect(() => registration.verify('reg', lastCode())).toThrow();
});

it('rejects a late SMTP response after another send recovered the expired lease', async () => {
  let finish!: () => void;
  send.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const late = registration.issue('reg', 'ip', email, account);
  await expect(registration.issue('reg', 'ip')).rejects.toMatchObject({ code: 'SENDING' });
  now += 61000;
  await registration.issue('reg', 'ip', 'fixed@example.test');
  const good = lastCode();
  finish();
  await expect(late).rejects.toMatchObject({ code: 'SEND_EXPIRED' });
  expect(registration.verify('reg', good).user.login).toBe('racer');
  expect(store.db.prepare('SELECT email FROM users').get()?.email).toBe('fixed@example.test');
});
it('charges failed delivery attempts to persistent address and IP limits', async () => {
  send.mockRejectedValue(new Error('offline'));
  for (let i = 0; i < 5; i++)
    await expect(registration.issue('reg', 'ip', email, account)).rejects.toMatchObject({
      code: 'MAIL_UNAVAILABLE',
    });
  store.close();
  open();
  await expect(registration.issue('reg', 'ip', email, account)).rejects.toMatchObject({
    code: 'MAIL_LIMIT',
  });
  for (let i = 0; i < 15; i++)
    await expect(registration.issue('reg' + i, 'ip', i + email, account)).rejects.toMatchObject({
      code: 'MAIL_UNAVAILABLE',
    });
  await expect(
    registration.issue('other', 'ip', 'other@example.test', account),
  ).rejects.toMatchObject({ code: 'MAIL_LIMIT' });
});

it('can correct credentials after the very first email is rejected', async () => {
  send.mockRejectedValueOnce(new Error('offline'));
  await expect(registration.issue('reg', 'ip', email, account)).rejects.toThrow();
  await registration.issue('reg', 'ip', 'fixed@example.test', {
    login: 'changed',
    passwordHash: 'new-hash',
  });
  const result = registration.verify('reg', lastCode());
  expect(store.accountByLogin(result.user.login)?.password_hash).toBe('new-hash');
});
