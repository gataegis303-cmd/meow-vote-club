import { CATS, CAT_IDS } from './cats.js';
import { parseState, castVote } from './voting.js';
import { shanghaiDay, zeroCounts, makeSnapshot } from '../shared/model.js';

export const DEMO_KEY = 'meow-vote-club:demo:v1';
export const MODE_KEY = 'meow-vote-club:mode:v1';

export function createDemoState(day) {
  const dailyVotes = {};
  for (let offset = 1; offset <= 3; offset++) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - offset);
    dailyVotes[date.toISOString().slice(0, 10)] = [
      CAT_IDS[(offset * 2 - 2) % 6], CAT_IDS[(offset * 2 - 1) % 6], CAT_IDS[(offset * 2) % 6],
    ];
  }
  return { version: 1, dailyVotes };
}

export function demoSnapshot(state, day) {
  const totals = Object.fromEntries(CATS.map((cat) => [cat.id, cat.votes]));
  const todayTotals = zeroCounts();
  for (const [date, votes] of Object.entries(state.dailyVotes)) {
    for (const id of votes) {
      totals[id] += 1;
      if (date === day) todayTotals[id] += 1;
    }
  }
  return makeSnapshot(day, state.dailyVotes, totals, todayTotals, 'demo');
}

export function demoVote(state, catId, day) {
  const result = castVote(state, catId, day);
  if (!result.ok) {
    const error = new Error(result.reason.toUpperCase());
    error.code = result.reason.toUpperCase();
    throw error;
  }
  return result.state;
}

function validateSnapshot(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.day) || data.mode !== 'shared' ||
      !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > 3 ||
      !data.dailyVotes || !Array.isArray(data.dailyVotes[data.day]) || !data.stats ||
      !['votes', 'days', 'uniqueCats'].every((key) => Number.isInteger(data.stats[key]) && data.stats[key] >= 0) ||
      typeof data.stats.hasFullDay !== 'boolean' ||
      !['totals', 'todayTotals', 'ownTotals'].every((key) => data[key] && CAT_IDS.every((id) => Number.isInteger(data[key][id]) && data[key][id] >= 0))) {
    throw new Error('服务返回的数据不完整，请重新连接。');
  }
  const votes = data.dailyVotes[data.day];
  if (votes.some((id) => !CAT_IDS.includes(id)) || new Set(votes).size !== votes.length || votes.length !== 3 - data.remaining) {
    throw new Error('服务返回的票额不一致，请重新连接。');
  }
  return data;
}

export function createSharedSource(fetcher = (...args) => fetch(...args)) {
  async function request(path, body) {
    const response = await fetcher(path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message ?? '连接暂时中断，请稍后重试。');
      error.code = data.error?.code;
      throw error;
    }
    return data;
  }
  return {
    async connect() {
      await request('/api/session', {});
      return validateSnapshot(await request('/api/snapshot'));
    },
    async snapshot() { return validateSnapshot(await request('/api/snapshot')); },
    async vote(catId, expectedDay) { return validateSnapshot(await request('/api/votes', { catId, expectedDay })); },
    async history(month) {
      const data = await request(`/api/me/history?month=${encodeURIComponent(month)}`);
      if (data.month !== month || !data.dailyVotes || typeof data.dailyVotes !== 'object' || Array.isArray(data.dailyVotes)) throw new Error('历史记录格式异常。');
      const clean = parseState(JSON.stringify({ version: 1, dailyVotes: data.dailyVotes })).dailyVotes;
      return { month, dailyVotes: Object.fromEntries(Object.entries(clean).filter(([day]) => day.startsWith(`${month}-`))) };
    },
  };
}

export function createDemoSource(read, write, getDay = shanghaiDay) {
  let state = read() ?? createDemoState(getDay());
  function persist() { write(state); }
  return {
    async connect() { persist(); return demoSnapshot(state, getDay()); },
    async snapshot() { return demoSnapshot(state, getDay()); },
    async vote(catId, expectedDay) {
      if (expectedDay !== getDay()) {
        const error = new Error('已经是新的一天。');
        error.code = 'DAY_CHANGED';
        throw error;
      }
      state = demoVote(state, catId, getDay());
      persist();
      return demoSnapshot(state, getDay());
    },
    async history(month) {
      return { month, dailyVotes: Object.fromEntries(Object.entries(state.dailyVotes).filter(([day]) => day.startsWith(`${month}-`))) };
    },
    reset() { state = createDemoState(getDay()); persist(); },
  };
}
