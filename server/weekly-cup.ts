import pool from '../docs/research/weekly-cup-benchmarks.json';
import { cupSchedule, type CupBoard, type CupFinish } from '../src/shared/weekly-cup';
import { digest, type Store } from './store';

const poolLogins = JSON.stringify(pool.benchmarks.map((row) => row.nickname));

type Time = { nickname: string; finishMs: number };

export class WeeklyCup {
  constructor(private store: Store) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS cup_bests (
      week INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
      best_ms INTEGER NOT NULL CHECK(best_ms > 0), PRIMARY KEY (week, user_id)
    )`);
  }

  board(time: number): CupBoard {
    const schedule = cupSchedule(time);
    const db = this.store.db;
    const racers = db
      .prepare(
        `SELECT u.login AS nickname,b.best_ms AS finishMs FROM cup_bests b
      JOIN users u ON u.id=b.user_id WHERE week=?`,
      )
      .all(schedule.week) as Time[];
    const previous = db
      .prepare('SELECT count(*) AS total FROM cup_bests WHERE week=?')
      .get(schedule.week - 1)!;
    const count = Math.min(50, Math.max(12, Number(previous.total)));
    const benchmarks = pool.benchmarks;
    const occupied = db
      .prepare('SELECT login FROM users WHERE login IN (SELECT value FROM json_each(?))')
      .all(poolLogins) as { login: string }[];
    const reserved = new Set(occupied.map((row) => row.login.toLowerCase()));
    // One candidate from each pace band. A third of bands rotates each Monday.
    for (let i = 0; i < count; i++) {
      const band = benchmarks.slice(
        Math.floor((i * benchmarks.length) / count),
        Math.floor(((i + 1) * benchmarks.length) / count),
      );
      const rotation = Math.floor((schedule.week + (i % 3)) / 3);
      const offset = parseInt(digest(i + '/' + rotation).slice(0, 8), 16) % band.length;
      for (let j = 0; j < band.length; j++) {
        const candidate = band[(offset + j) % band.length];
        if (reserved.has(candidate.nickname)) continue;
        racers.push({
          nickname: candidate.nickname,
          finishMs: candidate.timesMs[schedule.trackId],
        });
        break;
      }
    }
    racers.sort((a, b) => a.finishMs - b.finishMs || a.nickname.localeCompare(b.nickname, 'en'));
    // Equal times share a place, including a tie at the top.
    let place = 0;
    const rows = racers.map((row, index) => {
      if (!index || row.finishMs !== racers[index - 1].finishMs) place = index + 1;
      return { ...row, place };
    });
    return { ...schedule, rows };
  }

  record(time: number, nickname: string, finishMs: number): CupFinish {
    return this.store.transaction(() => {
      const user = this.store.accountByLogin(nickname);
      if (!user || !Number.isSafeInteger(finishMs) || finishMs <= 0)
        throw new Error('Invalid cup finish');
      const { week } = cupSchedule(time);
      const existing = this.store.db
        .prepare('SELECT best_ms FROM cup_bests WHERE week=? AND user_id=?')
        .get(week, user.id);
      const before = existing
        ? this.board(time).rows.find((r) => r.nickname === user.login)
        : undefined;
      this.store.db
        .prepare(
          `INSERT INTO cup_bests(week,user_id,best_ms) VALUES(?,?,?)
        ON CONFLICT(week,user_id) DO UPDATE SET best_ms=excluded.best_ms WHERE excluded.best_ms<cup_bests.best_ms`,
        )
        .run(week, user.id, finishMs);
      const rows = this.board(time).rows;
      const me = rows.find((r) => r.nickname === user.login)!;
      const ahead = rows[me.place - 2];
      return {
        place: me.place,
        bestMs: me.finishMs,
        gapMs: ahead ? me.finishMs - ahead.finishMs : null,
        gained: before ? Math.max(0, before.place - me.place) : 0,
      };
    });
  }
}
