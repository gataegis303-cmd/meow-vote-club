import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LIMIT, dateKey, parseState, castVote, getDailyVotes, getVoteCount, getDailyRanking,
} from '../src/voting.js';
import { getSouvenirData, souvenirFilename } from '../src/souvenir.js';

const DAY = '2026-10-24';
const empty = () => parseState(null);

test('starts with no votes and a daily limit of three', () => {
  assert.equal(DAILY_LIMIT, 3);
  assert.deepEqual(getDailyVotes(empty(), DAY), []);
});

test('records the first vote without mutating the previous state', () => {
  const before = empty();
  const result = castVote(before, 'toffee', DAY);
  assert.equal(result.ok, true);
  assert.deepEqual(getDailyVotes(result.state, DAY), ['toffee']);
  assert.deepEqual(getDailyVotes(before, DAY), []);
  assert.equal(getVoteCount(result.state, 'toffee'), 1);
});

test('rejects a second vote for the same cat on the same day', () => {
  const first = castVote(empty(), 'toffee', DAY);
  const second = castVote(first.state, 'toffee', DAY);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'duplicate');
  assert.equal(getVoteCount(second.state, 'toffee'), 1);
});

test('rejects the fourth distinct vote on one day', () => {
  let state = empty();
  for (const id of ['toffee', 'sesame', 'pudding']) {
    state = castVote(state, id, DAY).state;
  }
  const result = castVote(state, 'oreo', DAY);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'limit');
  assert.equal(getDailyVotes(result.state, DAY).length, 3);
});

test('allows voting for the same cat again on a new day', () => {
  const first = castVote(empty(), 'toffee', DAY);
  const next = castVote(first.state, 'toffee', '2026-10-25');
  assert.equal(next.ok, true);
  assert.equal(getDailyVotes(next.state, '2026-10-25').length, 1);
  assert.equal(getVoteCount(next.state, 'toffee'), 2);
});

test('unspent daily tickets do not accumulate across days', () => {
  const first = castVote(empty(), 'toffee', DAY);
  assert.deepEqual(getDailyVotes(first.state, '2026-10-25'), []);
});

test('unknown cats are rejected and never added to state', () => {
  const result = castVote(empty(), 'not-a-cat', DAY);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unknown');
  assert.deepEqual(result.state, empty());
});

test('invalid vote dates are rejected', () => {
  const result = castVote(empty(), 'toffee', '2026-02-30');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-date');
});

test('survives a serialized persistence round trip', () => {
  const voted = castVote(empty(), 'sesame', DAY).state;
  assert.deepEqual(parseState(JSON.stringify(voted)), voted);
});

test('corrupt storage and unrecognized schema versions fall back safely', () => {
  for (const raw of ['invalid-json', 'null', '[]', 'true', '{"version":2,"dailyVotes":{}}']) {
    assert.deepEqual(parseState(raw), empty());
  }
});

test('sanitizes unknown cats, duplicates, extra tickets and invalid dates', () => {
  const state = parseState(JSON.stringify({
    version: 1,
    dailyVotes: {
      [DAY]: ['toffee', 'toffee', 'unknown', 'sesame', 'pudding', 'oreo'],
      '2026-02-30': ['toffee'],
      '2026-10-25': 'sesame',
    },
  }));
  assert.deepEqual(getDailyVotes(state, DAY), ['toffee', 'sesame', 'pudding']);
  assert.equal(Object.keys(state.dailyVotes).length, 1);
});

test('returns a defensive copy of daily votes', () => {
  const state = castVote(empty(), 'toffee', DAY).state;
  getDailyVotes(state, DAY).push('sesame');
  assert.equal(getDailyVotes(state, DAY).length, 1);
});

test('date keys use local calendar days rather than UTC dates', () => {
  const date = new Date(2026, 0, 2, 0, 15);
  assert.equal(dateKey(date), '2026-01-02');
});

test('counts only votes cast for the requested cat across history', () => {
  let state = castVote(empty(), 'toffee', DAY).state;
  state = castVote(state, 'sesame', DAY).state;
  state = castVote(state, 'toffee', '2026-10-25').state;
  assert.equal(getVoteCount(state, 'toffee'), 2);
  assert.equal(getVoteCount(state, 'sesame'), 1);
  assert.equal(getVoteCount(state, 'oreo'), 0);
});

test('today ranking starts at zero without seeded votes or invented ranks', () => {
  const rows = getDailyRanking(empty(), DAY);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => row.votes), [0, 0, 0, 0, 0, 0]);
  assert.equal(rows.every((row) => row.rank === null), true);
});

test('today ranking excludes history and puts supported cats first', () => {
  let state = castVote(empty(), 'toffee', '2026-10-23').state;
  state = castVote(state, 'peach', DAY).state;
  const rows = getDailyRanking(state, DAY);
  assert.deepEqual(rows[0], { id: 'peach', votes: 1, rank: 1 });
  assert.equal(rows.find((row) => row.id === 'toffee').votes, 0);
  assert.equal(rows.slice(1).every((row) => row.rank === null), true);
});

test('equal today votes share a rank and use candidate order, not voting order', () => {
  let state = castVote(empty(), 'peach', DAY).state;
  state = castVote(state, 'sesame', DAY).state;
  const before = JSON.stringify(state);
  const rows = getDailyRanking(state, DAY);
  assert.deepEqual(rows.slice(0, 2), [
    { id: 'sesame', votes: 1, rank: 1 }, { id: 'peach', votes: 1, rank: 1 },
  ]);
  assert.equal(JSON.stringify(state), before);
  rows[0].votes = 42;
  assert.equal(getDailyRanking(state, DAY)[0].votes, 1);
});

test('a new local date begins with an empty today ranking', () => {
  const state = castVote(empty(), 'peach', DAY).state;
  assert.equal(getDailyRanking(state, '2026-10-25').every((row) => row.rank === null), true);
});

test('souvenir is unavailable before all three daily votes are cast', () => {
  const state = castVote(empty(), 'peach', DAY).state;
  assert.equal(getSouvenirData(empty(), DAY), null);
  assert.equal(getSouvenirData(state, DAY), null);
});

test('souvenir snapshots exactly the selected day, cats and vote order', () => {
  let state = castVote(empty(), 'toffee', '2026-10-23').state;
  for (const id of ['peach', 'cloud', 'oreo']) state = castVote(state, id, DAY).state;
  const data = getSouvenirData(state, DAY);
  assert.equal(data.day, DAY);
  assert.deepEqual(data.cats.map((cat) => cat.id), ['peach', 'cloud', 'oreo']);
  assert.deepEqual(data.cats.map((cat) => cat.name), ['桃桃', '云朵', '奥利奥']);
  data.cats[0].name = 'changed';
  assert.equal(getSouvenirData(state, DAY).cats[0].name, '桃桃');
  assert.equal(getSouvenirData(state, '2026-10-25'), null);
  assert.equal(souvenirFilename(data), '喵喵应援纪念-2026-10-24.png');
});
