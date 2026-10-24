import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppData } from '../src/app-data.js';
import { makeSnapshot, zeroCounts } from '../shared/model.js';

const day = '2026-10-24';
const snapshot = (votes = []) => makeSnapshot(day, { [day]: votes }, { ...zeroCounts(), toffee: votes.length }, { ...zeroCounts(), toffee: votes.length });
function environment(t, handler, blockedStorage = false) {
  const previous = { window: globalThis.window, fetch: globalThis.fetch };
  const storage = () => {
    const map = new Map();
    return {
      getItem(key) { if (blockedStorage) throw new Error('blocked'); return map.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error('blocked'); map.set(key, value); },
    };
  };
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  globalThis.fetch = handler;
  t.after(() => { globalThis.window = previous.window; globalThis.fetch = previous.fetch; });
}
const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });

test('polls do not supersede a still-pending slow snapshot indefinitely', async (t) => {
  const finishes = [];
  let reads = 0;
  environment(t, async (path) => {
    if (path === '/api/session') return json({ ok: true });
    reads++;
    if (reads === 1) return json(snapshot());
    return new Promise((resolve) => { finishes.push(() => resolve(json(snapshot(['toffee'])))); });
  });
  const app = createAppData(() => {});
  await app.start();
  const slow = app.refresh();
  const redundant = app.refresh();
  finishes.forEach((finish) => finish());
  await Promise.all([slow, redundant]);
  assert.equal(reads, 2, 'only one snapshot request may be in flight');
  assert.equal(app.model.state.remaining, 2);
});

test('late shared response cannot replace demo mode or its profile', async (t) => {
  let finish;
  let reads = 0;
  environment(t, async (path) => {
    if (path === '/api/session') return json({ ok: true });
    if (++reads === 1) return json(snapshot());
    return new Promise((resolve) => { finish = () => resolve(json(snapshot(['toffee']))); });
  });
  const app = createAppData(() => {});
  await app.start();
  const slow = app.refresh();
  await app.setMode('demo');
  app.updateProfile({ favoriteCatId: 'peach' });
  finish();
  await slow;
  assert.equal(app.model.state.mode, 'demo');
  assert.equal(app.model.profile.favoriteCatId, 'peach');
  assert.equal(app.model.state.remaining, 3);
});

test('lost vote response reconciles committed vote without a second POST', async (t) => {
  let posted = 0;
  environment(t, async (path) => {
    if (path === '/api/session') return json({ ok: true });
    if (path === '/api/votes') { posted++; throw new TypeError('Failed to fetch'); }
    return json(snapshot(posted ? ['toffee'] : []));
  });
  const app = createAppData(() => {});
  await app.start();
  const result = await app.vote('toffee');
  assert.equal(result.ok, false);
  assert.equal(posted, 1);
  assert.equal(app.model.state.remaining, 2);
  assert.equal(app.model.status, 'ready');
});

test('blocked preference storage does not prevent shared voting or create local fallback votes', async (t) => {
  environment(t, async (path) => json(path === '/api/session' ? { ok: true } : snapshot(path === '/api/votes' ? ['toffee'] : [])), true);
  const app = createAppData(() => {});
  await app.start();
  assert.equal(app.model.storageWarning, true);
  assert.equal((await app.vote('toffee')).ok, true);
  assert.equal(app.model.state.remaining, 2);
});

test('demo reset and preferences never call the shared service and do not change shared preferences', async (t) => {
  let requests = 0;
  environment(t, async (path) => { requests++; return json(path === '/api/session' ? { ok: true } : snapshot()); });
  const app = createAppData(() => {});
  await app.start();
  app.updateProfile({ favoriteCatId: 'sesame' });
  const before = requests;
  await app.setMode('demo');
  app.updateProfile({ favoriteCatId: 'peach' });
  await app.vote('toffee');
  await app.resetDemo();
  assert.equal(requests, before);
  assert.equal(app.model.profile.favoriteCatId, null);
  assert.equal(app.model.state.remaining, 3);
  await app.setMode('shared');
  assert.equal(app.model.profile.favoriteCatId, 'sesame');
  assert.equal(app.model.state.remaining, 3);
});

test('a mode change during failed-vote reconciliation suppresses stale feedback', async (t) => {
  let finish;
  let hasVoted = false;
  environment(t, async (path) => {
    if (path === '/api/session') return json({ ok: true });
    if (path === '/api/votes') { hasVoted = true; throw new TypeError('Failed to fetch'); }
    if (!hasVoted) return json(snapshot());
    return new Promise((resolve) => { finish = () => resolve(json(snapshot(['toffee']))); });
  });
  const app = createAppData(() => {});
  await app.start();
  const voting = app.vote('toffee');
  await new Promise((resolve) => setImmediate(resolve));
  await app.setMode('demo');
  finish();
  const result = await voting;
  assert.equal(result.ignored, true);
});
