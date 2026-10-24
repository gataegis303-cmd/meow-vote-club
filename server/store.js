import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { CAT_IDS } from '../src/cats.js';
import { zeroCounts, shanghaiDay, makeSnapshot } from '../shared/model.js';

export class ApiError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const hash = (token) => createHash('sha256').update(token).digest('hex');

export function createStore({ databasePath = ':memory:', now = () => new Date() } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  // Official API: https://nodejs.org/docs/latest-v24.x/api/sqlite.html#class-databasesync
  const db = new DatabaseSync(databasePath, { timeout: 5000 });
  if (databasePath !== ':memory:') chmodSync(databasePath, 0o600);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  if (db.prepare('PRAGMA user_version').get().user_version > 1) {
    db.close();
    throw new Error('Unsupported database version');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS voters (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY, voter_id TEXT NOT NULL REFERENCES voters(id),
      day TEXT NOT NULL, cat_id TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(voter_id, day, cat_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS votes_day ON votes(day);
    CREATE INDEX IF NOT EXISTS votes_voter ON votes(voter_id, day);
    PRAGMA user_version = 1;
  `);
  const voterExists = db.prepare('SELECT id FROM voters WHERE id = ?');
  const rowsForVoter = db.prepare('SELECT day, cat_id FROM votes WHERE voter_id = ? ORDER BY id');
  const dailyForVoter = db.prepare('SELECT cat_id FROM votes WHERE voter_id = ? AND day = ? ORDER BY id');
  const insert = db.prepare('INSERT INTO votes(voter_id, day, cat_id, created_at) VALUES (?, ?, ?, ?)');

  function identify(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError('SESSION_REQUIRED', 401);
    const id = hash(token);
    if (!voterExists.get(id)) throw new ApiError('SESSION_REQUIRED', 401);
    return id;
  }

  function historyFor(id) {
    const result = {};
    for (const row of rowsForVoter.all(id)) (result[row.day] ??= []).push(row.cat_id);
    return result;
  }

  function snapshot(token) {
    const id = identify(token);
    const day = shanghaiDay(now());
    const totals = zeroCounts();
    const todayTotals = zeroCounts();
    for (const row of db.prepare('SELECT cat_id, COUNT(*) AS count FROM votes GROUP BY cat_id').all()) totals[row.cat_id] = row.count;
    for (const row of db.prepare('SELECT cat_id, COUNT(*) AS count FROM votes WHERE day = ? GROUP BY cat_id').all(day)) todayTotals[row.cat_id] = row.count;
    return makeSnapshot(day, historyFor(id), totals, todayTotals);
  }

  return {
    createSession() {
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO voters(id, created_at) VALUES (?, ?)').run(hash(token), now().toISOString());
      return token;
    },
    hasSession(token) {
      try { identify(token); return true; } catch { return false; }
    },
    snapshot,
    vote(token, catId, expectedDay) {
      const id = identify(token);
      if (!CAT_IDS.includes(catId)) throw new ApiError('INVALID_CAT');
      db.exec('BEGIN IMMEDIATE');
      try {
        const instant = now();
        const day = shanghaiDay(instant);
        if (expectedDay !== day) throw new ApiError('DAY_CHANGED', 409);
        const votes = dailyForVoter.all(id, day);
        if (votes.some((row) => row.cat_id === catId)) throw new ApiError('DUPLICATE', 409);
        if (votes.length >= 3) throw new ApiError('LIMIT', 409);
        insert.run(id, day, catId, instant.toISOString());
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return snapshot(token);
    },
    history(token, month) {
      const id = identify(token);
      if (typeof month !== 'string' || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError('INVALID_MONTH');
      const dailyVotes = Object.fromEntries(Object.entries(historyFor(id)).filter(([day]) => day.startsWith(`${month}-`)));
      return { month, dailyVotes };
    },
    close: () => db.close(),
  };
}
