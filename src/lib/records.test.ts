import { describe, it, expect } from 'vitest';
import { parseRecords } from './records';
describe('device race records', () => {
  it('does not crash on corrupt or old storage', () => {
    for (const raw of ['{', 'null', '{}', '42', '[null,{},5]'])
      expect(parseRecords(raw)).toEqual([]);
  });
  it('retains actual results and rejects impossible ones', () => {
    const good = { position: 2, time: 72.5, trackId: 'coast', date: '2026-11-06T10:00:00Z' };
    expect(
      parseRecords(JSON.stringify([good, { ...good, time: -1 }, { ...good, position: 7 }])),
    ).toEqual([good]);
  });
});
