export type RaceRecord = { position: number; time: number; trackId: string; date: string };
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
          Number.isFinite(Date.parse(r.date)),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
