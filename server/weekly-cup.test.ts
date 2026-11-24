import { expect, it } from 'vitest';
import { createApplication } from './app';
import { cupSchedule } from '../src/shared/weekly-cup';
import pool from '../docs/research/weekly-cup-benchmarks.json';

it('keeps each verified account’s fastest finish, handles equal times and rotates at the UTC week boundary', () => {
  const app = createApplication({ env: {} });
  try {
    const now = Date.UTC(2026, 10, 24);
    const first = app.weeklyCup.board(now);
    expect(first.rows).toHaveLength(12);
    const name = first.rows[0].nickname;
    app.store.register(name, 'test', 'one@example.test');
    app.store.register('second', 'test', 'two@example.test');
    expect(app.weeklyCup.board(now).rows.some((row) => row.nickname === name)).toBe(false);
    app.weeklyCup.record(now, name, 60000);
    const best = app.weeklyCup.record(now, name, 20000);
    expect(best.place).toBe(1);
    expect(best.gained).toBeGreaterThan(0);
    const repeat = app.weeklyCup.record(now, name, 40000);
    expect(repeat.bestMs).toBe(20000);
    expect(repeat.gained).toBe(0);
    app.weeklyCup.record(now, 'second', 20000);
    const rows = app.weeklyCup.board(now).rows;
    expect(rows).toHaveLength(14);
    expect(rows.slice(0, 3).map((row) => row.place)).toEqual([1, 1, 3]);
    const next = app.weeklyCup.board(first.endsAt);
    expect(cupSchedule(first.endsAt - 1).week).toBe(first.week);
    expect(next.trackId).toBe('neon');
    expect(next.rows).toHaveLength(12);
    expect(next.rows).not.toEqual(first.rows);
    for (const row of next.rows)
      expect(row.finishMs).toBe(
        pool.benchmarks.find((b) => b.nickname === row.nickname)?.timesMs.neon,
      );
  } finally {
    app.close();
  }
});
