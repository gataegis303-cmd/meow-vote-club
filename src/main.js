import {
  createIcons, Cat, PawPrint, Trophy, Heart, Ticket, CircleHelp, Sparkles,
  RotateCw, ArrowRight, ArrowUpRight, ArrowDownWideNarrow, ChevronDown,
  Crown, Check, X, Medal, TriangleAlert, CircleCheck, ImageDown, Download,
  Star, CalendarHeart, ChevronLeft, ChevronRight, LockKeyhole, FlaskConical, LogOut, Trash2,
} from 'lucide';
import './styles.css';
import './responsive.css';
import './enhancements.css';
import './experience.css';
import { CATS } from './cats.js';
import { getDailyVotes, getVoteCount } from './voting.js';
import { PROFILE_KEY, shiftMonth } from './experience.js';
import { icon, candidatesView, miniRanking, todayView, rankingView, detailView, completionView } from './views.js';
import { affinityView, journalView } from './experience-views.js';
import { getSouvenirData } from './souvenir.js';
import { setupSouvenirDialog } from './souvenir-dialog.js';
import { setupQuizDialog } from './quiz-dialog.js';
import { createAppData } from './app-data.js';

const icons = { Cat, PawPrint, Trophy, Heart, Ticket, CircleHelp, Sparkles, RotateCw, ArrowRight, ArrowUpRight, ArrowDownWideNarrow, ChevronDown, Crown, Check, X, Medal, TriangleAlert, CircleCheck, ImageDown, Download, Star, CalendarHeart, ChevronLeft, ChevronRight, LockKeyhole, FlaskConical, LogOut, Trash2 };
const $ = (selector) => document.querySelector(selector);
const drawIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.8, 'aria-hidden': 'true' } });
let view = 'cats';
let sort = 'number';
let rankingMode = 'today';
let activeCatId = null;
let toastTimer;
let dialogTrigger;
let historyRequest = 0;
let historyKey = '';
const journal = { month: '', selectedDay: '', history: {}, archive: false, status: 'loading' };
const catDialog = $('#cat-dialog');
const rulesDialog = $('#rules-dialog');

const app = createAppData((reason) => {
  if (reason === 'mode') {
    historyRequest += 1;
    historyKey = '';
    journal.month = '';
    journal.history = {};
    journal.archive = false;
    closeDialogs();
  }
  render();
  if (view === 'mine' && app.model.status === 'ready') {
    const key = `${app.generation}:${app.viewState.day}:${app.viewState.stats.votes}`;
    if (key !== historyKey) { historyKey = key; loadHistory(); }
  }
});

function render() {
  const state = app.viewState;
  const day = state.day;
  const daily = getDailyVotes(state, day);
  const supported = CATS.filter((cat) => getVoteCount(state, cat.id) > 0).length;
  const heading = { cats: ['本期候选喵', '各有可爱，等你偏爱'], ranking: ['本期人气榜', '每一份偏爱，都算数'], mine: ['我的应援小队', '把每一次心动，认真收好'] }[view];
  const focused = document.activeElement;
  const focusAttributes = ['data-vote', 'data-favorite', 'data-detail', 'data-ranking-mode', 'data-day', 'data-archive', 'data-month', 'data-action'];
  const focusAttribute = focusAttributes.find((name) => focused?.hasAttribute(name));
  const focusValue = focusAttribute ? focused.getAttribute(focusAttribute) : null;
  const focusRoot = catDialog.open ? catDialog : $('#view-content').contains(focused) ? $('#view-content') : $('#affinity-content').contains(focused) ? $('#affinity-content') : null;
  $('#section-title').textContent = heading[0];
  $('#section-caption').textContent = heading[1];
  $('#section-count').textContent = String(view === 'mine' ? supported : CATS.length).padStart(2, '0');
  $('#sort-control').hidden = view !== 'cats';
  $('#ticket-count').textContent = app.model.state ? state.remaining : '…';
  $('#ticket-dots').innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="${i < state.remaining ? '' : 'spent'}">${icon(i < state.remaining ? 'heart' : 'check')}</span>`).join('');
  $('#mine-count').textContent = supported;
  $('#mine-count').hidden = !supported;
  $('#today-count').textContent = `${daily.length} / 3`;
  $('#affinity-content').innerHTML = affinityView(app.model.profile);
  if (view === 'mine') {
    if (!journal.month) { journal.month = day.slice(0, 7); journal.selectedDay = day; }
    const legacy = app.legacy();
    $('#view-content').innerHTML = journalView({
      state, ...journal, hasLegacy: app.model.mode === 'shared' && Object.keys(legacy.dailyVotes).length > 0,
    });
  } else {
    $('#view-content').innerHTML = view === 'ranking' ? rankingView(state, day, rankingMode) : candidatesView(state, day, view, sort);
  }
  $('#view-content').dataset.view = view;
  $('#mini-ranking-list').innerHTML = miniRanking(state);
  $('#today-list').innerHTML = todayView(state, day);
  $('#completion-summary').innerHTML = completionView(state, day);
  $('#completion-summary').hidden = daily.length !== 3;
  $('#storage-warning').hidden = !app.model.storageWarning;
  $('#connection-warning').hidden = app.model.status !== 'error';
  $('#connection-message').textContent = app.model.error;
  $('#mode-label').textContent = app.model.mode === 'demo' ? '演示样例' : '共享投票';
  $('#mode-status').textContent = app.model.mode === 'demo' ? '独立样例 · 不计入共享榜' : app.model.status === 'ready' ? '已连接 · 北京时间' : app.model.status === 'loading' ? '正在连接…' : '连接中断 · 暂停投票';
  $('#mode-toggle').innerHTML = `${icon(app.model.mode === 'demo' ? 'log-out' : 'flask-conical')}<span>${app.model.mode === 'demo' ? '退出演示' : '演示模式'}</span>`;
  $('#demo-reset').hidden = app.model.mode !== 'demo';
  $('#demo-notice').hidden = app.model.mode !== 'demo';
  $('.live-badge').textContent = app.model.mode === 'demo' ? '演示样例' : app.model.status === 'ready' ? '共享同步' : '等待连接';
  $('.data-note').textContent = app.model.mode === 'demo' ? '样例数据，与共享记录隔离。' : '匿名身份每日三票 · 换浏览器不恢复记录';
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === view);
    if (link.dataset.nav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (activeCatId) $('#cat-dialog-content').innerHTML = detailView(CATS.find((cat) => cat.id === activeCatId), state, day);
  drawIcons();
  if (focusRoot && focusAttribute && !focused.isConnected) {
    let replacement = [...focusRoot.querySelectorAll(`[${focusAttribute}]`)].find((item) => item.getAttribute(focusAttribute) === focusValue);
    if (replacement?.disabled && focusAttribute === 'data-vote') replacement = catDialog.open ? $('[data-close="cat"]') : $(`[data-detail="${focusValue}"]`);
    if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
  }
}

function toast(message, success = true) {
  clearTimeout(toastTimer);
  const el = $('#toast');
  el.innerHTML = `${icon(success ? 'heart' : 'circle-help')}<span></span>`;
  el.querySelector('span').textContent = message;
  el.classList.toggle('toast-info', !success);
  el.classList.add('visible');
  if (!el.matches(':popover-open')) el.showPopover();
  drawIcons();
  toastTimer = setTimeout(() => { el.classList.remove('visible'); el.hidePopover(); }, 3600);
}

function celebrate(catId) {
  const card = $(`[data-cat="${catId}"]`);
  card?.classList.add('just-voted');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = (catDialog.open ? $('#detail-vote') : card)?.getBoundingClientRect();
  if (!box) return;
  const container = $('#celebration');
  container.style.setProperty('--burst-x', `${Math.min(innerWidth - 32, box.left + box.width / 2)}px`);
  container.style.setProperty('--burst-y', `${Math.min(innerHeight - 32, box.top + box.height / 2)}px`);
  container.innerHTML = Array.from({ length: 9 }, (_, i) => `<span class="love-particle" style="--dx:${(i - 4) * 28}px;--dy:${-60 - Math.sin(i) * 32}px;--rotation:${i * 30}deg;--delay:${i * 15}ms">${icon(i % 3 === 0 ? 'sparkles' : 'heart')}</span>`).join('');
  drawIcons();
  setTimeout(() => container.replaceChildren(), 1200);
}

async function vote(catId) {
  const result = await app.vote(catId);
  if (result.ignored) return;
  if (!result.ok) { toast(result.message, false); return; }
  const completed = app.viewState.remaining === 0;
  toast(completed ? '三份偏爱都送到啦，留下今天的纪念吧。' : `${CATS.find((cat) => cat.id === catId).name}收到你的偏爱啦！`);
  celebrate(catId);
}

function openDetail(catId, trigger) {
  const cat = CATS.find((item) => item.id === catId);
  if (!cat) return;
  dialogTrigger = trigger;
  activeCatId = catId;
  $('#cat-dialog-content').innerHTML = detailView(cat, app.viewState, app.viewState.day);
  drawIcons();
  catDialog.showModal();
}

function closeDialogs() {
  activeCatId = null;
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  if ($('#toast').matches(':popover-open')) $('#toast').hidePopover();
}

async function loadHistory() {
  if (view !== 'mine') return;
  const ownRequest = ++historyRequest;
  const day = app.viewState.day;
  if (!journal.month) { journal.month = day.slice(0, 7); journal.selectedDay = day; }
  journal.status = 'loading';
  journal.history = {};
  render();
  try {
    const data = journal.archive ? app.legacy() : await app.history(journal.month);
    if (ownRequest !== historyRequest) return;
    journal.history = data.dailyVotes;
    journal.status = 'ready';
  } catch {
    if (ownRequest !== historyRequest) return;
    journal.status = 'error';
  }
  render();
}

const quiz = setupQuizDialog({
  getProfile: () => app.model.profile,
  setProfile: (patch) => app.updateProfile(patch), openDetail, drawIcons,
});
setupSouvenirDialog(
  () => getSouvenirData(app.viewState, app.viewState.day, app.model.profile),
  toast, (patch) => app.updateProfile(patch),
);

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.vote) vote(button.dataset.vote);
  else if (button.dataset.favorite) app.updateProfile({ favoriteCatId: app.model.profile.favoriteCatId === button.dataset.favorite ? null : button.dataset.favorite });
  else if (button.dataset.rankingMode) { rankingMode = button.dataset.rankingMode; render(); }
  else if (button.dataset.detail) openDetail(button.dataset.detail, button);
  else if (button.dataset.day) { journal.selectedDay = button.dataset.day; render(); }
  else if (button.dataset.month) {
    journal.month = shiftMonth(journal.month, Number(button.dataset.month));
    journal.selectedDay = `${journal.month}-01`;
    loadHistory();
  } else if (button.hasAttribute('data-archive')) {
    journal.archive = button.dataset.archive === 'true';
    loadHistory();
  } else if (button.dataset.action === 'retry-history') loadHistory();
  else if (button.dataset.action === 'quiz') quiz.show(button);
  else if (button.dataset.action === 'reconnect') app.reconnect();
  else if (button.dataset.action === 'mode') app.setMode(app.model.mode === 'demo' ? 'shared' : 'demo');
  else if (button.dataset.action === 'reset-demo') $('#reset-dialog').showModal();
  else if (button.dataset.action === 'confirm-reset') {
    $('#reset-dialog').close();
    app.resetDemo();
  } else if (button.dataset.action === 'rules') {
    dialogTrigger = button;
    rulesDialog.showModal();
  } else if (button.dataset.close) $(`#${button.dataset.close}-dialog`)?.close();
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}
for (const dialog of [catDialog, rulesDialog]) dialog.addEventListener('close', () => {
  if (dialog === catDialog) activeCatId = null;
  const replacement = dialogTrigger?.dataset.detail ? $(`[data-detail="${dialogTrigger.dataset.detail}"]`) : null;
  (dialogTrigger?.isConnected ? dialogTrigger : replacement)?.focus({ preventScroll: true });
});
$('#reset-dialog').addEventListener('close', () => $('#demo-reset').focus({ preventScroll: true }));

function navigate() {
  const requested = location.hash.slice(1);
  view = ['cats', 'ranking', 'mine'].includes(requested) ? requested : 'cats';
  if (view === 'mine') {
    if (!journal.month) { journal.month = app.viewState.day.slice(0, 7); journal.selectedDay = app.viewState.day; }
    if (app.model.status === 'ready') loadHistory();
    else render();
  } else { historyRequest += 1; render(); }
}
$('#sort-select').addEventListener('change', (event) => { sort = event.target.value; render(); });
window.addEventListener('hashchange', navigate);
window.addEventListener('storage', (event) => { if (event.key === PROFILE_KEY || event.key === null) app.syncProfile(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) app.refresh(); });
const poll = setInterval(() => { if (!document.hidden) app.refresh(); }, 3000);
import.meta.hot?.dispose(() => { clearInterval(poll); clearTimeout(toastTimer); });
navigate();
app.start();
