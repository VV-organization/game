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
    let store = new Store(file, 'live');
    try {
      const user = store.register('alice', 'salt:hash');
      const session = store.createSession(user.id);
      const topup = store.createTopup({
        userId: user.id,
        creatorHash: 'creator',
        key: 'restart-key',
        rub: 5205,
        method: 'card',
        mode: 'arco',
        configurationId: 'test-shop',
      }).row;
      store.settle(topup.id, 'success');
      const p = products.find((p) => p.category === 'color')!;
      store.purchase(user.id, p.id, 'restart-purchase-key');
      store.equip(user.id, p.id);
      const balance = store.user(user.id).balance;
      store.close();
      store = new Store(file, 'live');
      expect(store.session(session)?.balance).toBe(balance);
      expect(store.user(user.id).equipped.color).toBe(p.id);
      store.settle(topup.id, 'success');
      expect(store.user(user.id).balance).toBe(balance);
      expect(store.history(user.id).purchases).toHaveLength(1);
    } finally {
      if (store.db.isOpen) store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('keeps legacy wallets and sessions available with payments disabled without relabeling them as live', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fapix-test-'));
    const file = join(directory, 'wallet.sqlite');
    let store = new Store(file, 'live');
    try {
      const user = store.register('legacy_user', 'salt:hash');
      const session = store.createSession(user.id);
      const topup = store.createTopup({
        userId: user.id,
        creatorHash: 'legacy-fixture',
        key: 'legacy-topup-key',
        rub: 5205,
        method: 'card',
        mode: 'arco',
        configurationId: 'test-shop',
      }).row;
      store.settle(topup.id, 'success');
      const product = products.find((p) => p.category === 'color')!;
      store.purchase(user.id, product.id, 'legacy-purchase-key');
      store.equip(user.id, product.id);
      const before = store.user(user.id);
      // Reproduce a database written by the removed sandbox implementation.
      store.db.prepare("UPDATE settings SET value='sandbox' WHERE key='economy'").run();
      store.db.prepare("UPDATE topups SET mode='sandbox',provider_config='sandbox'").run();
      store.close();
      store = new Store(file, 'disabled');
      expect(store.session(session)).toEqual(before);
      expect(store.history(user.id).topups).toHaveLength(1);
      expect(store.history(user.id).purchases).toHaveLength(1);
      expect(store.db.prepare("SELECT value FROM settings WHERE key='economy'").get()).toEqual({
        value: 'sandbox',
      });
      expect(() => new Store(file, 'live')).toThrow('separate databases');
    } finally {
      if (store.db.isOpen) store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('marks a new disabled database as live so it can later use real payments', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fapix-test-'));
    const file = join(directory, 'wallet.sqlite');
    let store = new Store(file, 'disabled');
    try {
      const user = store.register('future_live', 'salt:hash');
      expect(store.db.prepare("SELECT value FROM settings WHERE key='economy'").get()).toEqual({
        value: 'live',
      });
      store.close();
      store = new Store(file, 'live');
      expect(store.user(user.id)).toEqual(user);
    } finally {
      if (store.db.isOpen) store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
