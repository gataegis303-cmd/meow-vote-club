import { CAT_IDS } from './cats.js';

export const DAILY_LIMIT = 3;
export const STORAGE_KEY = 'meow-vote-club:v1';

export function dateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isValidDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export function parseState(raw) {
  const empty = { version: 1, dailyVotes: {} };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.dailyVotes ||
        typeof parsed.dailyVotes !== 'object' || Array.isArray(parsed.dailyVotes)) return empty;
    const entries = Object.entries(parsed.dailyVotes)
      .filter(([day, votes]) => isValidDay(day) && Array.isArray(votes))
      .map(([day, votes]) => [
        day,
        [...new Set(votes.filter((id) => CAT_IDS.includes(id)))].slice(0, DAILY_LIMIT),
      ])
      .filter(([, votes]) => votes.length);
    return { version: 1, dailyVotes: Object.fromEntries(entries) };
  } catch {
    return empty;
  }
}

export function getDailyVotes(state, day = dateKey()) {
  return [...(state.dailyVotes[day] ?? [])];
}

export function getVoteCount(state, catId) {
  if (state.ownTotals) return state.ownTotals[catId] ?? 0;
  return Object.values(state.dailyVotes).filter((votes) => votes.includes(catId)).length;
}

export function getDailyRanking(state, day = dateKey()) {
  const votes = getDailyVotes(state, day);
  const rows = CAT_IDS.map((id) => ({ id, votes: state.todayTotals?.[id] ?? (votes.includes(id) ? 1 : 0) }));
  rows.sort((a, b) => b.votes - a.votes);
  return rows.map((row) => ({
    ...row,
    rank: row.votes ? rows.filter((other) => other.votes > row.votes).length + 1 : null,
  }));
}

export function castVote(state, catId, day = dateKey()) {
  const reject = (reason) => ({ ok: false, reason, state });
  if (!CAT_IDS.includes(catId)) return reject('unknown');
  if (!isValidDay(day)) return reject('invalid-date');
  const votes = getDailyVotes(state, day);
  if (votes.includes(catId)) return reject('duplicate');
  if (votes.length >= DAILY_LIMIT) return reject('limit');
  return {
    ok: true,
    state: {
      version: 1,
      dailyVotes: { ...state.dailyVotes, [day]: [...votes, catId] },
    },
  };
}
