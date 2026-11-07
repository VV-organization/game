import { isRaceFormatId, type RaceResult } from '../shared/race-formats';

export type RaceRecord = Pick<RaceResult, 'position' | 'time' | 'trackId'> &
  Partial<Omit<RaceResult, 'position' | 'time' | 'trackId'>> & {
    date: string;
    carVariant?: number;
  };

export function recordTime(time: number): string {
  const centiseconds = Math.floor(time * 100 + 1e-6);
  return `${Math.floor(centiseconds / 6000)}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

export function recordOutcome(record: RaceRecord): string {
  if (record.didNotFinish) return `DNF · ${record.position} / 6`;
  if (record.formatId === 'time-attack')
    return record.bestLap ? recordTime(record.bestLap) : 'Нет полного круга';
  return `${record.position} / 6${record.eliminated ? ' · Выбыл' : ''}`;
}

export function parseRecords(raw: string | null): RaceRecord[] {
  try {
    const values = JSON.parse(raw || '[]');
    if (!Array.isArray(values)) return [];
    return values
      .filter(
        (r): r is RaceRecord =>
          r &&
          Number.isInteger(r.position) &&
          r.position >= 1 &&
          r.position <= 6 &&
          Number.isFinite(r.time) &&
          r.time > 0 &&
          typeof r.trackId === 'string' &&
          typeof r.date === 'string' &&
          Number.isFinite(Date.parse(r.date)) &&
          (r.formatId === undefined || isRaceFormatId(r.formatId)) &&
          (r.bestLap === undefined ||
            r.bestLap === null ||
            (Number.isFinite(r.bestLap) && r.bestLap > 0 && r.bestLap <= r.time)) &&
          (r.completedLaps === undefined ||
            (Number.isInteger(r.completedLaps) && r.completedLaps >= 0)) &&
          (r.distance === undefined || (Number.isFinite(r.distance) && r.distance >= 0)) &&
          (r.eliminated === undefined || typeof r.eliminated === 'boolean') &&
          (r.online === undefined || typeof r.online === 'boolean') &&
          (r.didNotFinish === undefined || typeof r.didNotFinish === 'boolean') &&
          (r.carVariant === undefined ||
            (Number.isInteger(r.carVariant) && r.carVariant >= 0 && r.carVariant <= 10)),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
