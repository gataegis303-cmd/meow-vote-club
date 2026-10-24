import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.js';

async function fixture(t, { databasePath = ':memory:' } = {}) {
  let clock = new Date('2026-10-24T15:59:00Z');
  const api = createApi({ databasePath, now: () => clock });
  const server = createServer(api.handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    api.close();
  });
  const request = async (path, { cookie, body, method = body ? 'POST' : 'GET', origin, headers = {} } = {}) => {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const session = async () => {
    const result = await request('/api/session', { body: {} });
    assert.equal(result.status, 200);
    assert.match(result.cookie, /HttpOnly/);
    assert.match(result.cookie, /SameSite=Lax/);
    return result.cookie.split(';')[0];
  };
  return { api, request, session, setTime: (value) => { clock = new Date(value); } };
}

test('shared snapshots start at zero, require a session and do not expose identity', async (t) => {
  const app = await fixture(t);
  assert.equal((await app.request('/api/snapshot')).status, 401);
  const cookie = await app.session();
  const result = await app.request('/api/snapshot', { cookie });
  assert.equal(result.status, 200);
  assert.equal(result.body.day, '2026-10-24');
  assert.equal(result.body.remaining, 3);
  assert.equal(result.body.totals.toffee, 0);
  assert.equal(result.body.todayTotals.toffee, 0);
  assert.equal(JSON.stringify(result.body).includes(cookie.split('=')[1]), false);
});

test('two anonymous identities share totals but not personal votes', async (t) => {
  const app = await fixture(t);
  const a = await app.session();
  const b = await app.session();
  const vote = await app.request('/api/votes', { cookie: a, body: { catId: 'toffee', expectedDay: '2026-10-24' } });
  assert.equal(vote.status, 200);
  const other = (await app.request('/api/snapshot', { cookie: b })).body;
  assert.equal(other.totals.toffee, 1);
  assert.equal(other.todayTotals.toffee, 1);
  assert.equal(other.remaining, 3);
  assert.deepEqual(other.dailyVotes['2026-10-24'], []);
});

test('transactions protect the last ticket against concurrent requests and duplicates', async (t) => {
  const app = await fixture(t);
  const cookie = await app.session();
  for (const catId of ['toffee', 'sesame']) {
    assert.equal((await app.request('/api/votes', { cookie, body: { catId, expectedDay: '2026-10-24' } })).status, 200);
  }
  const results = await Promise.all(['pudding', 'oreo', 'cloud', 'peach'].map((catId) =>
    app.request('/api/votes', { cookie, body: { catId, expectedDay: '2026-10-24' } })));
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.equal(results.filter((result) => result.body.error?.code === 'LIMIT').length, 3);
  const duplicate = await app.request('/api/votes', { cookie, body: { catId: 'toffee', expectedDay: '2026-10-24' } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'DUPLICATE');
  const snapshot = (await app.request('/api/snapshot', { cookie })).body;
  assert.equal(snapshot.stats.votes, 3);
  assert.equal(snapshot.remaining, 0);
});

test('server Shanghai date controls rollover and stale intents cannot vote next day', async (t) => {
  const app = await fixture(t);
  const cookie = await app.session();
  await app.request('/api/votes', { cookie, body: { catId: 'toffee', expectedDay: '2026-10-24' } });
  app.setTime('2026-10-24T16:00:01Z');
  const stale = await app.request('/api/votes', { cookie, body: { catId: 'sesame', expectedDay: '2026-10-24' } });
  assert.equal(stale.body.error.code, 'DAY_CHANGED');
  const snapshot = (await app.request('/api/snapshot', { cookie })).body;
  assert.equal(snapshot.day, '2026-10-25');
  assert.equal(snapshot.remaining, 3);
  assert.equal(snapshot.totals.toffee, 1);
  assert.equal(snapshot.todayTotals.toffee, 0);
  const history = await app.request('/api/me/history?month=2026-10', { cookie });
  assert.deepEqual(history.body.dailyVotes['2026-10-24'], ['toffee']);
  assert.equal((await app.request('/api/me/history?month=2026-99', { cookie })).status, 400);
});

test('invalid cats, payloads, origins and unissued identities are rejected', async (t) => {
  const app = await fixture(t);
  const cookie = await app.session();
  assert.equal((await app.request('/api/votes', { cookie, body: { catId: '__proto__', expectedDay: '2026-10-24' } })).status, 400);
  assert.equal((await app.request('/api/votes', { cookie, body: { catId: 'toffee', expectedDay: '2026-10-24', votes: 999 } })).status, 400);
  assert.equal((await app.request('/api/session', { body: {}, origin: 'https://evil.example' })).status, 403);
  assert.equal((await app.request('/api/snapshot', { cookie: `meowSession=${'a'.repeat(64)}` })).status, 401);
});

test('identity and votes survive reopening the SQLite database', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'meow-db-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const databasePath = join(dir, 'test.sqlite');
  const first = createApi({ databasePath });
  const token = first.store.createSession();
  const day = first.store.snapshot(token).day;
  first.store.vote(token, 'peach', day);
  first.close();
  const second = createApi({ databasePath });
  try {
    assert.equal(second.store.snapshot(token).totals.peach, 1);
    assert.equal(second.store.snapshot(token).remaining, 2);
  } finally {
    second.close();
  }
});
