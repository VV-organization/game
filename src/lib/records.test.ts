import { describe, it, expect } from 'vitest';
import { parseRecords, recordOutcome } from './records';
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
  it('preserves new format metrics and rejects corrupt explicit formats or metrics', () => {
    const good = {
      position: 1,
      time: 120,
      trackId: 'coast',
      date: '2026-11-07T10:00:00Z',
      formatId: 'time-attack',
      bestLap: 25.32,
      completedLaps: 4,
      distance: 4100,
      eliminated: false,
      carVariant: 3,
    };
    expect(
      parseRecords(
        JSON.stringify([
          good,
          { ...good, formatId: 'unknown' },
          { ...good, bestLap: -1 },
          { ...good, bestLap: 121 },
          { ...good, distance: -1 },
          { ...good, completedLaps: 2.5 },
          { ...good, carVariant: 11 },
        ]),
      ),
    ).toEqual([good]);
  });
  it('shows solo lap times and incomplete attempts without a fake race position', () => {
    const attempt = {
      position: 1,
      time: 120,
      trackId: 'coast',
      date: '2026-11-07T10:00:00Z',
      formatId: 'time-attack' as const,
      bestLap: null,
      completedLaps: 0,
      distance: 0,
      eliminated: false,
    };
    expect(recordOutcome(attempt)).toBe('Нет полного круга');
    expect(recordOutcome({ ...attempt, bestLap: 25.32, completedLaps: 4 })).toBe('0:25.32');
    expect(
      recordOutcome({ ...attempt, formatId: 'elimination', position: 6, eliminated: true }),
    ).toBe('6 / 6 · Выбыл');
    expect(recordOutcome({ position: 2, time: 75, trackId: 'coast', date: attempt.date })).toBe(
      '2 / 6',
    );
  });
  it('preserves network provenance and never labels an unfinished race as a normal podium result', () => {
    const result = {
      position: 4,
      time: 100,
      trackId: 'coast',
      date: '2026-11-07T10:00:00Z',
      online: true,
      didNotFinish: true,
    };
    expect(
      parseRecords(
        JSON.stringify([result, { ...result, online: 'true' }, { ...result, didNotFinish: 1 }]),
      ),
    ).toEqual([result]);
    expect(recordOutcome(result)).toBe('DNF · 4 / 6');
  });
});
