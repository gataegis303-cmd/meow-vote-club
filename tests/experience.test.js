import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCat, parseProfile, getBadges, monthCells, shiftMonth } from '../src/experience.js';
import { createDemoState, demoSnapshot, demoVote } from '../src/data-source.js';
import { getSouvenirData } from '../src/souvenir.js';

test('quiz uses five valid answers, stable ties and no random or vote side effects', () => {
  assert.equal(matchCat(['peach', 'cloud', 'peach', 'cloud', 'oreo']), 'cloud');
  assert.equal(matchCat(Array(5).fill('sesame')), 'sesame');
  assert.equal(matchCat(['unknown']), null);
  assert.equal(matchCat(Array(5).fill('unknown')), null);
});

test('profile sanitizes malformed values and keeps preferences independent of votes', () => {
  const empty = parseProfile(null);
  assert.equal(empty.favoriteCatId, null);
  const parsed = parseProfile(JSON.stringify({ favoriteCatId: 'peach', quizCatId: 'unknown', theme: 'mint', sloganCatId: 'cloud' }));
  assert.equal(parsed.favoriteCatId, 'peach');
  assert.equal(parsed.quizCatId, null);
  assert.equal(parsed.theme, 'mint');
  assert.equal(parsed.sloganCatId, 'cloud');
  assert.equal('dailyVotes' in parsed, false);
  assert.deepEqual(parseProfile('{broken'), empty);
});

test('badges depend on actual server summary only', () => {
  assert.equal(getBadges({ days: 0, votes: 0, hasFullDay: false, uniqueCats: 0 }).some((badge) => badge.unlocked), false);
  assert.equal(getBadges({ days: 3, votes: 8, hasFullDay: true, uniqueCats: 6 }).every((badge) => badge.unlocked), true);
});

test('calendar is Monday-first, handles leap years and year transitions', () => {
  const feb = monthCells('2028-02');
  assert.equal(feb.filter(Boolean).length, 29);
  assert.equal(feb[1], '2028-02-01');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('demo has sample history but starts with three usable tickets and is immutable', () => {
  const state = createDemoState('2026-10-24');
  const snapshot = demoSnapshot(state, '2026-10-24');
  assert.equal(snapshot.remaining, 3);
  assert.equal(snapshot.totals.toffee > 1000, true);
  assert.equal(snapshot.stats.days >= 3, true);
  const changed = demoVote(state, 'peach', '2026-10-24');
  assert.equal(demoSnapshot(changed, '2026-10-24').remaining, 2);
  assert.equal(demoSnapshot(state, '2026-10-24').remaining, 3);
  assert.throws(() => demoVote(changed, 'peach', '2026-10-24'), /DUPLICATE/);
});

test('souvenir freezes theme, declaration, favorite and mode without altering vote history', () => {
  const state = { mode: 'demo', dailyVotes: { '2026-10-24': ['toffee', 'sesame', 'pudding'] } };
  const profile = { theme: 'mint', sloganCatId: 'peach', favoriteCatId: 'cloud' };
  const data = getSouvenirData(state, '2026-10-24', profile);
  assert.equal(data.theme, 'mint');
  assert.equal(data.sloganCatId, 'peach');
  assert.equal(data.favorite.name, '云朵');
  assert.equal(data.mode, 'demo');
  profile.favoriteCatId = 'peach';
  assert.equal(data.favorite.name, '云朵');
  assert.deepEqual(state.dailyVotes['2026-10-24'], ['toffee', 'sesame', 'pudding']);
});
