import { CAT_IDS } from '../src/cats.js';

export const zeroCounts = () => Object.fromEntries(CAT_IDS.map((id) => [id, 0]));
export const shanghaiDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export function rankCounts(counts) {
  const rows = CAT_IDS.map((id) => ({ id, votes: counts[id] ?? 0 })).sort((a, b) => b.votes - a.votes);
  return rows.map((row) => ({
    ...row, rank: row.votes ? rows.filter((other) => other.votes > row.votes).length + 1 : null,
  }));
}

export function makeSnapshot(day, history, totals, todayTotals, mode = 'shared') {
  const ownTotals = zeroCounts();
  const days = Object.values(history);
  for (const votes of days) for (const id of votes) ownTotals[id] += 1;
  const today = history[day] ?? [];
  return {
    version: 1, mode, day, dailyVotes: { [day]: [...today] },
    remaining: 3 - today.length, totals, todayTotals, ownTotals,
    stats: {
      days: days.filter((votes) => votes.length).length,
      votes: Object.values(ownTotals).reduce((a, b) => a + b, 0),
      hasFullDay: days.some((votes) => votes.length === 3),
      uniqueCats: Object.values(ownTotals).filter(Boolean).length,
    },
  };
}
