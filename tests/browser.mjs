import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createApi } from '../server/api.js';

let instant = new Date('2026-10-24T04:00:00Z');
let api = createApi({ now: () => instant });
const install = (server) => { server.middlewares.use((req, res, next) => api.handler(req, res, next)); };
const config = {
  configFile: false, logLevel: 'error',
  plugins: [{ name: 'isolated-test-api', configureServer: install, configurePreviewServer: install }],
  server: { host: '127.0.0.1', port: 0 },
  preview: { host: '127.0.0.1', port: 0 },
};
const production = process.env.TEST_BUILD === '1';
const server = production ? await preview(config) : await createServer(config);
if (!production) await server.listen();
const baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const contexts = new Set();
const issues = [];
let checks = 0;
let currentCheck = '';
await fs.mkdir('test-results', { recursive: true });

async function check(name, run) {
  if (process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER)) return;
  currentCheck = name;
  api.close();
  instant = new Date('2026-10-24T04:00:00Z');
  api = createApi({ now: () => instant });
  try {
    await run();
    checks += 1;
    console.log(`PASS ${name}`);
  } finally {
    for (const context of contexts) await context.close();
    contexts.clear();
  }
}

async function fixture({ width = 1440, hash = '', raw, init, reducedMotion, offlineExpected = false, context: existing } = {}) {
  const context = existing ?? await browser.newContext({
    viewport: { width, height: width < 768 ? 844 : 1000 },
    timezoneId: 'America/Los_Angeles', locale: 'zh-CN', reducedMotion,
    storageState: raw === undefined ? undefined : {
      cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'meow-vote-club:v1', value: raw }] }],
    },
  });
  contexts.add(context);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('pageerror', (error) => issues.push(`${currentCheck}: ${error.message}`));
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type()) && !(offlineExpected && /Failed to load resource|net::ERR_|401|409|503/.test(msg.text()))) issues.push(`${currentCheck}: ${msg.text()}`);
  });
  await page.goto(`${baseURL}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#mode-status').textContent));
  return { context, page };
}

async function vote(page, id, remaining) {
  await page.locator(`#view-content [data-vote="${id}"]`).click();
  await page.waitForFunction((value) => document.querySelector('#ticket-count').textContent === String(value), remaining);
}
async function navigate(page, name, view) {
  await page.locator('.main-nav').getByRole('link', { name, exact: false }).click();
  await page.locator(`#view-content[data-view="${view}"]`).waitFor();
  if (view === 'mine') await page.locator('.day-record[aria-busy="false"]').waitFor();
}
async function axe(page) {
  await page.evaluate(() => Promise.all([...document.querySelectorAll('dialog[open]')].flatMap((el) => el.getAnimations({ subtree: true })).map((animation) => animation.finished.catch(() => {}))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), []);
}
async function assertLayout(page) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    broken: [...document.images].filter((img) => img.hasAttribute('src') && (!img.complete || !img.naturalWidth)).map((img) => img.src),
    controls: [...document.querySelectorAll('.cat-card, .vote-button, .ticket-wallet, .nav-link, .daily-rank-row, .completion-actions, .primary-button, .affinity-strip, .support-badge, .quiz-choices label, .calendar, .souvenir-customization, .mode-toolbar')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className),
  }));
  assert.equal(result.overflow, false, 'No horizontal page overflow');
  assert.deepEqual(result.broken, [], 'Portraits load');
  assert.deepEqual(result.controls, [], 'Text fits controls');
}
async function fillQuiz(page, id = 'peach') {
  for (let step = 0; step < 5; step++) {
    await page.locator(`#quiz-dialog input[value="${id}"]`).check();
    await page.locator('[data-quiz-next]').click();
  }
}

try {
  await check('skip link, zero shared baseline, three votes and refresh persistence', async () => {
    const { page } = await fixture();
    const skip = page.getByRole('link', { name: '跳到候选猫咪' });
    assert.equal(await skip.evaluate((el) => getComputedStyle(el).opacity), '0');
    await page.keyboard.press('Tab');
    assert.equal(await skip.evaluate((el) => getComputedStyle(el).opacity), '1');
    assert.deepEqual(await page.locator('[data-total]').allTextContents(), Array(6).fill('0'));
    await vote(page, 'toffee', 2);
    assert.equal(await page.locator('[data-total="toffee"]').innerText(), '1');
    assert.equal(await page.locator('[data-vote="toffee"]').isDisabled(), true);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#ticket-count').textContent === '2');
    await vote(page, 'sesame', 1);
    await vote(page, 'pudding', 0);
    assert.equal(await page.locator('#view-content .vote-button:disabled').count(), 6);
    assert.equal(await page.locator('#completion-summary').isVisible(), true);
    assert.equal(await page.locator('#completion-summary img').count(), 3);
  });

  await check('two isolated browsers share totals without sharing personal allowance', async () => {
    const a = await fixture();
    const b = await fixture();
    await vote(a.page, 'toffee', 2);
    await b.page.waitForFunction(() => document.querySelector('[data-total="toffee"]').textContent === '1');
    assert.equal(await b.page.locator('#ticket-count').innerText(), '3');
    await vote(b.page, 'toffee', 2);
    await a.page.waitForFunction(() => document.querySelector('[data-total="toffee"]').textContent === '2');
    await navigate(a.page, '人气榜', 'ranking');
    assert.equal(await a.page.locator('[data-day-cat="toffee"] [data-day-votes]').innerText(), '2');
  });

  await check('same-identity tabs synchronize votes, completion and preference changes', async () => {
    const { context, page } = await fixture();
    const second = await fixture({ context });
    await page.locator('[data-favorite="peach"]').click();
    await second.page.locator('[data-favorite="peach"][aria-pressed="true"]').waitFor();
    for (const [i, id] of ['toffee', 'sesame', 'pudding'].entries()) await vote(page, id, 2 - i);
    await second.page.locator('#completion-summary:not([hidden])').waitFor();
    assert.equal(await second.page.locator('#ticket-count').innerText(), '0');
  });

  await check('today and cumulative rankings have honest ties, no seeded votes and no zero ranks', async () => {
    const { page } = await fixture();
    await navigate(page, '人气榜', 'ranking');
    assert.equal(await page.locator('#daily-empty').isVisible(), true);
    await vote(page, 'peach', 2);
    await vote(page, 'cloud', 1);
    assert.deepEqual(await page.locator('[data-day-cat]').evaluateAll((rows) => rows.slice(0, 2).map((row) => row.dataset.dayCat)), ['cloud', 'peach']);
    assert.equal(await page.locator('.daily-rank-label').filter({ hasText: '并列 1' }).count(), 2);
    await page.locator('[data-ranking-mode="total"]').click();
    assert.match(await page.locator('.ranking-summary').innerText(), /2.*从零/s);
    assert.equal(await page.locator('.daily-rank-label').filter({ hasText: '未上榜' }).count(), 4);
    await axe(page);
  });

  await check('cat detail voting preserves modal, Escape and trigger focus; rules close correctly', async () => {
    const { page } = await fixture();
    await page.locator('#view-content [data-detail="sesame"]').click();
    await page.locator('#cat-dialog [data-vote="sesame"]').click();
    await page.waitForFunction(() => document.querySelector('#ticket-count').textContent === '2');
    assert.equal(await page.locator('#cat-dialog').evaluate((el) => el.open), true);
    assert.equal(await page.locator('#toast').evaluate((el) => el.matches(':popover-open')), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.detail === 'sesame');
    await page.getByRole('button', { name: '查看投票规则', exact: true }).click();
    await axe(page);
    await page.getByRole('button', { name: '约定好啦' }).click();
    assert.equal(await page.getByRole('button', { name: '查看投票规则', exact: true }).evaluate((el) => el === document.activeElement), true);
  });

  await check('quiz supports backtracking, a stable result, favorite selection and retesting without votes', async () => {
    const { page } = await fixture();
    await page.locator('[data-action="quiz"]').click();
    const progress = page.getByRole('progressbar', { name: '答题进度' });
    assert.equal(await progress.count(), 1);
    assert.equal(await progress.getAttribute('aria-valuenow'), '1');
    assert.equal(await progress.getAttribute('aria-valuemax'), '5');
    await page.locator('#quiz-dialog input[value="cloud"]').check();
    await page.locator('[data-quiz-next]').click();
    assert.equal(await progress.getAttribute('aria-valuenow'), '2');
    await page.locator('[data-quiz-back]').click();
    assert.equal(await progress.getAttribute('aria-valuenow'), '1');
    assert.equal(await page.locator('#quiz-dialog input[value="cloud"]').isChecked(), true);
    await fillQuiz(page);
    assert.match(await page.locator('#quiz-title').innerText(), /桃桃/);
    assert.equal(await page.locator('#ticket-count').innerText(), '3');
    await axe(page);
    await page.locator('[data-quiz-favorite]').click();
    assert.match(await page.locator('#affinity-content').innerText(), /我的本命猫 · 桃桃/);
    await page.locator('[data-quiz-restart]').click();
    assert.equal(await page.locator('input[name="quiz-answer"]').count(), 6);
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-favorite="peach"][aria-pressed="true"]').waitFor();
    await page.locator('[data-favorite="peach"]').click();
    assert.equal(await page.locator('[data-favorite="peach"]').getAttribute('aria-pressed'), 'false');
  });

  await check('server history powers calendar and badges; legacy local data remains read-only and excluded', async () => {
    const raw = JSON.stringify({ version: 1, dailyVotes: { '2026-10-23': ['peach', 'cloud', 'oreo'] } });
    const { page, context } = await fixture({ raw });
    assert.equal(await page.locator('[data-total="peach"]').innerText(), '0');
    for (const [date, cats] of [
      ['2026-10-21', ['toffee', 'sesame', 'pudding']],
      ['2026-10-22', ['oreo', 'cloud', 'peach']],
      ['2026-10-23', ['toffee']],
    ]) {
      instant = new Date(`${date}T04:00:00Z`);
      for (const catId of cats) assert.equal((await context.request.post(`${baseURL}/api/votes`, { data: { catId, expectedDay: date } })).status(), 200);
    }
    instant = new Date('2026-10-24T04:00:00Z');
    await page.reload({ waitUntil: 'networkidle' });
    await navigate(page, '我的应援', 'mine');
    await page.locator('.support-badge.is-unlocked').first().waitFor();
    assert.equal(await page.locator('.support-badge.is-unlocked').count(), 4);
    assert.match(await page.locator('.journal-stats').innerText(), /3.*7.*6/s);
    await page.locator('[data-day="2026-10-22"]').click();
    assert.deepEqual(await page.locator('.day-cat strong').allTextContents(), ['奥利奥', '云朵', '桃桃']);
    await page.locator('[data-archive="true"]').click();
    await page.locator('[data-day="2026-10-23"]').click();
    assert.deepEqual(await page.locator('.day-cat strong').allTextContents(), ['桃桃', '云朵', '奥利奥']);
    assert.match(await page.locator('.archive-note').innerText(), /只读历史/);
    const stored = await page.evaluate(() => localStorage.getItem('meow-vote-club:v1'));
    assert.equal(stored, raw);
    await page.locator('[data-month="-1"]').click();
    await page.locator('.day-record[aria-busy="false"]').waitFor();
    assert.match(await page.locator('.calendar-toolbar strong').innerText(), /09/);
    await axe(page);
  });

  await check('completion in details does not auto-open souvenir; custom PNG downloads and keeps frozen date', async () => {
    const { page } = await fixture();
    await page.locator('[data-favorite="peach"]').click();
    await vote(page, 'toffee', 2);
    await vote(page, 'sesame', 1);
    await page.locator('#view-content [data-detail="pudding"]').click();
    await page.locator('#cat-dialog [data-vote="pudding"]').click();
    await page.locator('#completion-summary:not([hidden])').waitFor();
    assert.equal(await page.locator('#souvenir-dialog').evaluate((el) => el.open), false);
    assert.equal(await page.locator('#cat-dialog').evaluate((el) => el.open), true);
    await page.keyboard.press('Escape');
    await page.locator('[data-action="souvenir"]').click();
    await page.locator('#souvenir-download[href^="blob:"]').waitFor();
    const firstURL = await page.locator('#souvenir-download').getAttribute('href');
    await page.locator('input[name="souvenir-theme"][value="mint"]').check();
    await page.locator('#souvenir-slogan').selectOption('peach');
    await page.waitForFunction((old) => {
      const link = document.querySelector('#souvenir-download');
      return !link.hidden && link.getAttribute('href') !== old;
    }, firstURL);
    await page.locator('#souvenir-preview').evaluate((img) => img.decode());
    const pixels = await page.locator('#souvenir-preview').evaluate((img) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const colors = new Set();
      const bytes = ctx.getImageData(70, 410, 760, 200).data;
      for (let i = 0; i < bytes.length; i += 64) colors.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
      return { width: img.naturalWidth, height: img.naturalHeight, background: [...ctx.getImageData(5, 5, 1, 1).data], colors: colors.size };
    });
    assert.equal(pixels.width, 900); assert.equal(pixels.height, 1200);
    assert.deepEqual(pixels.background, [238, 248, 241, 255]);
    assert.ok(pixels.colors > 100);
    const downloaded = page.waitForEvent('download');
    await page.locator('#souvenir-download').click();
    const file = await downloaded;
    assert.equal(file.suggestedFilename(), '喵喵应援纪念-2026-10-24.png');
    await file.saveAs('test-results/enhanced-souvenir.png');
    const bytes = await fs.readFile('test-results/enhanced-souvenir.png');
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 900); assert.equal(bytes.readUInt32BE(20), 1200);
    await axe(page);
    await page.screenshot({ path: 'test-results/personalized-souvenir.png' });
    instant = new Date('2026-10-24T16:00:01Z');
    await page.waitForFunction(() => document.querySelector('#ticket-count').textContent === '3');
    assert.equal(await page.locator('#souvenir-download').getAttribute('download'), '喵喵应援纪念-2026-10-24.png');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#souvenir-preview').hasAttribute('src'));
    assert.equal(await page.locator('#souvenir-preview').getAttribute('src'), null);
    await navigate(page, '人气榜', 'ranking');
    assert.equal(await page.locator('#daily-empty').isVisible(), true);
  });

  await check('PNG export failure can retry without spending votes', async () => {
    const { page } = await fixture({ init: () => {
      const original = HTMLCanvasElement.prototype.toBlob;
      let first = true;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        if (first) { first = false; callback(null); } else original.call(this, callback, ...args);
      };
    } });
    for (const [i, id] of ['toffee', 'sesame', 'pudding'].entries()) await vote(page, id, 2 - i);
    await page.locator('[data-action="souvenir"]').click();
    await page.locator('#souvenir-retry:not([hidden])').waitFor();
    await page.locator('#souvenir-retry').click();
    await page.locator('#souvenir-download[href^="blob:"]').waitFor();
    assert.equal(await page.locator('#ticket-count').innerText(), '0');
  });

  await check('demo state persists per tab, no shared requests, reset confirmation and exit restore real data', async () => {
    const { page } = await fixture();
    await vote(page, 'toffee', 2);
    await page.locator('[data-favorite="sesame"]').click();
    await page.locator('#mode-toggle').click();
    await page.waitForFunction(() => document.querySelector('#mode-label').textContent === '演示样例');
    let requests = 0;
    page.on('request', (req) => { if (new URL(req.url()).pathname.startsWith('/api/')) requests++; });
    await page.locator('[data-favorite="peach"]').click();
    await vote(page, 'cloud', 2);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#ticket-count').innerText(), '2');
    assert.equal(await page.locator('[data-favorite="peach"]').getAttribute('aria-pressed'), 'true');
    await navigate(page, '我的应援', 'mine');
    assert.equal(await page.locator('.support-badge.is-unlocked').count(), 4);
    await page.locator('#demo-reset').click();
    await axe(page);
    await page.getByRole('button', { name: '保留当前演示' }).click();
    assert.equal(await page.locator('#ticket-count').innerText(), '2');
    await page.locator('#demo-reset').click();
    await page.locator('[data-action="confirm-reset"]').click();
    await page.waitForFunction(() => document.querySelector('#ticket-count').textContent === '3');
    assert.equal(requests, 0);
    await page.locator('#mode-toggle').click();
    await page.waitForFunction(() => document.querySelector('#ticket-count').textContent === '2');
    await navigate(page, '猫咪候选人', 'cats');
    assert.equal(await page.locator('[data-total="toffee"]').innerText(), '1');
    assert.equal(await page.locator('[data-favorite="sesame"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-favorite="peach"]').getAttribute('aria-pressed'), 'false');
  });

  await check('late shared snapshot cannot overwrite demo UI', async () => {
    const { page } = await fixture();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route('**/api/snapshot', async (route) => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    const pending = page.waitForRequest('**/api/snapshot');
    await pending;
    await page.locator('#mode-toggle').click();
    await page.waitForFunction(() => document.querySelector('#mode-label').textContent === '演示样例');
    release();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#mode-label').innerText(), '演示样例');
    assert.match(await page.locator('[data-total="toffee"]').innerText(), /1,28/);
  });

  await check('network loss disables votes and recovery reconciles without a second POST', async () => {
    const { page } = await fixture({ offlineExpected: true });
    let posts = 0;
    await page.route('**/api/votes', async (route) => {
      posts++;
      await route.fetch();
      await route.abort();
    });
    await page.locator('#view-content [data-vote="toffee"]').click();
    await page.waitForFunction(() => document.querySelector('#ticket-count').textContent === '2');
    assert.equal(posts, 1);
    await page.route('**/api/snapshot', (route) => route.abort());
    await page.locator('#connection-warning:not([hidden])').waitFor();
    assert.equal(await page.locator('#view-content [data-vote="sesame"]').isDisabled(), true);
    await page.unroute('**/api/snapshot');
    await page.locator('[data-action="reconnect"]').click();
    await page.waitForFunction(() => document.querySelector('#connection-warning').hidden);
    assert.equal(await page.locator('#ticket-count').innerText(), '2');
  });

  await check('cookie rejection does not create a local voting fallback', async () => {
    const { page } = await fixture({ offlineExpected: true });
    await page.route('**/api/snapshot', (route) => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'SESSION_REQUIRED', message: '匿名身份不可用，请允许 Cookie 后重新连接。' } }),
    }));
    await page.locator('#connection-warning:not([hidden])').waitFor();
    assert.match(await page.locator('#connection-message').innerText(), /Cookie/);
    assert.equal(await page.locator('#view-content .vote-button:disabled').count(), 6);
  });

  await check('blocked or full storage preserves shared voting and PNG export', async () => {
    const { page } = await fixture({ init: () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    } });
    assert.equal(await page.locator('#storage-warning').isVisible(), true);
    await page.locator('[data-favorite="peach"]').click();
    for (const [i, id] of ['toffee', 'sesame', 'pudding'].entries()) await vote(page, id, 2 - i);
    await page.locator('[data-action="souvenir"]').click();
    await page.locator('#souvenir-download[href^="blob:"]').waitFor();
    assert.equal(await page.locator('#ticket-count').innerText(), '0');
  });

  await check('corrupt legacy storage cannot affect new shared state', async () => {
    const { page } = await fixture({ raw: '{broken' });
    assert.equal(await page.locator('#ticket-count').innerText(), '3');
    await navigate(page, '我的应援', 'mine');
    assert.equal(await page.locator('[data-archive]').count(), 0);
    assert.equal(await page.locator('.support-badge.is-unlocked').count(), 0);
    await axe(page);
  });

  for (const width of [320, 390, 768, 1024, 1440]) {
    await check(`all views, quiz, details and personalized souvenir fit ${width}px`, async () => {
      const { page } = await fixture({ width });
      await assertLayout(page);
      await page.screenshot({ path: `test-results/enhanced-cats-${width}.png`, fullPage: true });
      await page.locator('[data-action="quiz"]').click();
      await assertLayout(page);
      await axe(page);
      await page.screenshot({ path: `test-results/enhanced-quiz-${width}.png` });
      await page.keyboard.press('Escape');
      for (const [i, id] of ['toffee', 'sesame', 'pudding'].entries()) await vote(page, id, 2 - i);
      await navigate(page, '我的应援', 'mine');
      await assertLayout(page);
      await axe(page);
      await page.screenshot({ path: `test-results/enhanced-journal-${width}.png`, fullPage: true });
      await navigate(page, '人气榜', 'ranking');
      await assertLayout(page);
      await page.locator('[data-ranking-mode="total"]').click();
      await assertLayout(page);
      await navigate(page, '猫咪候选人', 'cats');
      await page.locator('#view-content [data-detail="toffee"]').click();
      await assertLayout(page);
      await axe(page);
      await page.keyboard.press('Escape');
      await page.locator('[data-action="souvenir"]').click();
      await page.locator('#souvenir-download[href^="blob:"]').waitFor();
      await assertLayout(page);
      await axe(page);
      await page.screenshot({ path: `test-results/enhanced-card-${width}.png` });
    });
  }

  await check('reduced motion, all six cat detail dialogs and empty journal are accessible', async () => {
    const { page } = await fixture({ reducedMotion: 'reduce' });
    for (const id of ['toffee', 'sesame', 'pudding', 'oreo', 'cloud', 'peach']) {
      await page.locator(`#view-content [data-detail="${id}"]`).click();
      await axe(page);
      await page.keyboard.press('Escape');
    }
    await vote(page, 'toffee', 2);
    assert.equal(await page.locator('.love-particle').count(), 0);
    await navigate(page, '我的应援', 'mine');
    await axe(page);
  });

  assert.deepEqual(issues, [], 'No unexpected browser errors or warnings');
  console.log(`\n${checks} ${production ? 'production' : 'development'} browser scenarios passed at isolated ${baseURL}`);
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  if (production) await new Promise((resolve) => server.httpServer.close(resolve));
  else await server.close();
  api.close();
}
