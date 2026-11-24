import type { OnlineTrackId } from './online-protocol';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const firstMonday = Date.UTC(2026, 10, 23);
const circuits: readonly OnlineTrackId[] = ['coast', 'neon', 'canyon', 'sky'];

export function cupSchedule(time: number) {
  const week = Math.floor((time - firstMonday) / WEEK);
  return {
    week,
    trackId: circuits[((week % circuits.length) + circuits.length) % circuits.length],
    endsAt: firstMonday + (week + 1) * WEEK,
  };
}

export type CupRow = { nickname: string; finishMs: number; place: number };
export type CupBoard = ReturnType<typeof cupSchedule> & { rows: CupRow[] };
export type CupFinish = { place: number; bestMs: number; gapMs: number | null; gained: number };

export function cupTime(ms: number) {
  return Math.floor(ms / 60000) + ':' + ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
}
