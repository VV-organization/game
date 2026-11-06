import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from './store';
import { products } from './catalog';
describe('durable wallet', () => {
  it('survives restart without losing sessions, ownership or credit deduplication', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fapix-test-'));
    const file = join(directory, 'wallet.sqlite');
    let store = new Store(file, 'sandbox');
    try {
      const user = store.register('alice', 'salt:hash');
      const session = store.createSession(user.id);
      const topup = store.createTopup({
        userId: user.id,
        creatorHash: 'creator',
        key: 'restart-key',
        rub: 5205,
        method: 'card',
        mode: 'sandbox',
        configurationId: 'sandbox',
      }).row;
      store.settle(topup.id, 'success');
      const p = products.find((p) => p.category === 'color')!;
      store.purchase(user.id, p.id, 'restart-purchase-key');
      store.equip(user.id, p.id);
      const balance = store.user(user.id).balance;
      store.close();
      store = new Store(file, 'sandbox');
      expect(store.session(session)?.balance).toBe(balance);
      expect(store.user(user.id).equipped.color).toBe(p.id);
      store.settle(topup.id, 'success');
      expect(store.user(user.id).balance).toBe(balance);
      expect(store.history(user.id).purchases).toHaveLength(1);
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('refuses to reuse a sandbox database for real payments', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fapix-test-'));
    const file = join(directory, 'wallet.sqlite');
    const store = new Store(file, 'sandbox');
    store.close();
    try {
      expect(() => new Store(file, 'live')).toThrow('separate databases');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
