import { CATS } from './cats.js';
import { DAILY_LIMIT, getDailyVotes, getVoteCount, getDailyRanking } from './voting.js';
import { rankCounts } from '../shared/model.js';

export const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(value);
export const icon = (name, className = '') => `<i data-lucide="${name}" class="${className}" aria-hidden="true"></i>`;
export const portrait = (cat, extra = '') => `<img src="/images/${cat.id}.webp" alt="${cat.name}，${cat.breed}" width="512" height="512" ${extra} />`;
export const catTotal = (state, cat) => state.totals?.[cat.id] ?? (cat.votes + getVoteCount(state, cat.id));
export const rankedCats = (state) => [...CATS].sort((a, b) => catTotal(state, b) - catTotal(state, a));
const cumulativeRows = (state) => rankCounts(Object.fromEntries(CATS.map((cat) => [cat.id, catTotal(state, cat)])));
const catRank = (state, id) => cumulativeRows(state).find((row) => row.id === id).rank;

export function voteButton(cat, state, day, extraClass = '') {
  const daily = getDailyVotes(state, day);
  const voted = daily.includes(cat.id);
  const exhausted = daily.length >= DAILY_LIMIT;
  const text = voted ? '今日已应援' : exhausted ? '明天再来喵' : state.isPending ? '请稍候' : state.isUnavailable ? '等待连接' : '为 TA 应援';
  return `<button class="vote-button ${voted ? 'is-voted' : ''} ${extraClass}" data-vote="${cat.id}" ${voted || exhausted || state.isPending || state.isUnavailable ? 'disabled' : ''} aria-label="${voted ? `今天已为${cat.name}应援` : exhausted ? '今日应援票已用完' : `为${cat.name}应援`}" >${icon(voted ? 'check' : 'heart')}<span>${text}</span></button>`;
}

function catCard(cat, state, day, index, view) {
  const rank = catRank(state, cat.id);
  const mine = getVoteCount(state, cat.id);
  return `<article class="cat-card tone-${cat.color}" data-cat="${cat.id}" style="--card-index:${index}">
    <button class="cat-portrait" data-detail="${cat.id}" aria-label="认识${cat.name}">
      ${portrait(cat, `loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async"`)}
      ${rank === 1 ? `<span class="portrait-badge top-badge">${icon('crown')}人气 TOP 1</span>` : `<span class="portrait-badge number-badge">NO. ${String(CATS.indexOf(cat) + 1).padStart(2, '0')}</span>`}
      <span class="portrait-open">${icon('arrow-up-right')}</span>
      ${view === 'mine' ? `<span class="my-vote-badge">${icon('heart')}我的 ${mine} 份偏爱</span>` : ''}
    </button>
    <div class="cat-card-content">
      <button class="favorite-button" data-favorite="${cat.id}" aria-pressed="${state.favoriteCatId === cat.id}" aria-label="${state.favoriteCatId === cat.id ? '取消' : '设'}${cat.name}${state.favoriteCatId === cat.id ? '本命猫' : '为本命猫'}" title="本命猫">${icon('star')}<span>${state.favoriteCatId === cat.id ? '我的本命猫' : '本命猫'}</span></button>
      <div class="cat-name-row"><h3>${cat.name}<span>${cat.english}</span></h3><span class="personality">${cat.personality}</span></div>
      <p class="cat-meta">${cat.breed}<span>·</span>${cat.age}</p>
      <p class="cat-line">“${cat.line}”</p>
      <div class="card-vote-row"><div class="vote-total">${icon('heart')}<strong data-total="${cat.id}">${formatNumber(catTotal(state, cat))}</strong><span>票</span></div>${voteButton(cat, state, day)}</div>
    </div>
  </article>`;
}

export function candidatesView(state, day, view, sort) {
  let cats = sort === 'popular' ? rankedCats(state) : CATS;
  if (view === 'mine') cats = cats.filter((cat) => getVoteCount(state, cat.id) > 0);
  if (!cats.length) return `<section class="empty-support"><div class="empty-portrait">${portrait(CATS[4])}${icon('heart')}</div><span class="eyebrow">YOUR LITTLE LOVE STORY</span><h3>你的心动，还没有被记录</h3><p>小猫们已经准备好，与你相遇。</p><a href="#cats" class="primary-button">去遇见小猫${icon('arrow-right')}</a></section>`;
  return `<div class="cat-grid">${cats.map((cat, index) => catCard(cat, state, day, index, view)).join('')}</div><div class="list-end"><span></span>${icon('paw-print')}<p>本期小可爱，已全员到齐</p><span></span></div>`;
}

export function miniRanking(state) {
  const cats = rankedCats(state);
  return cats.map((cat) => `<button class="mini-rank-row tone-${cat.color}" data-detail="${cat.id}" aria-label="${catRank(state, cat.id) ?? '未上榜'}，${cat.name}，${formatNumber(catTotal(state, cat))}票，查看详情">
    <span class="rank-number rank-${catRank(state, cat.id) ?? 0}">${catRank(state, cat.id) === 1 ? icon('crown') : catRank(state, cat.id) ?? '-'}</span>
    ${portrait(cat)}<span class="mini-rank-info"><span><strong>${cat.name}</strong><b>${formatNumber(catTotal(state, cat))}<small>票</small></b></span><span class="rank-track"><span style="width:${catTotal(state, cat) / Math.max(1, catTotal(state, cats[0])) * 100}%"></span></span></span>
  </button>`).join('');
}

export function todayView(state, day) {
  const votes = getDailyVotes(state, day);
  if (!votes.length) return `<div class="today-empty"><div class="empty-tickets">${icon('ticket')}${icon('heart')}</div><p>第一份偏爱，会是谁呢？</p><span>小猫们在等你心动</span></div>`;
  return `<div class="today-cats">${votes.map((id) => {
    const cat = CATS.find((item) => item.id === id);
    return `<button data-detail="${cat.id}" class="today-cat" aria-label="今日已为${cat.name}应援，查看详情">${portrait(cat)}<span>${cat.name}</span><b>${icon('check')}</b></button>`;
  }).join('')}${Array.from({ length: DAILY_LIMIT - votes.length }, () => `<span class="today-slot">${icon('heart')}<small>待心动</small></span>`).join('')}</div><p class="today-message">${votes.length === 3 ? '今日偏爱已送达，明天再见喵。' : '又有一只小猫，被你放在心上。'}</p>`;
}

function cumulativeRankingView(state, day) {
  const rows = cumulativeRows(state);
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  return `<div class="ranking-summary"><span>${icon('heart')}本期累计人气<strong>${formatNumber(total)}</strong><small>票</small></span><span class="demo-data-badge">${state.mode === 'demo' ? '样例 · 含演示初始票数' : '共享记录 · 从零计票'}</span></div>
    ${rankList(rows, state, day)}
    <div class="ranking-footnote">${icon('sparkles')}同票并列，零票暂不上榜。</div>`;
}

function rankList(rows, state, day) {
  return `<div class="daily-rank-list">${rows.map((row) => {
    const cat = CATS.find((item) => item.id === row.id);
    const tied = row.rank !== null && rows.filter((other) => other.rank === row.rank).length > 1;
    const label = row.rank === null ? '未上榜' : `${tied ? '并列' : '第'} ${row.rank}`;
    return `<article class="daily-rank-row tone-${cat.color}" data-day-cat="${cat.id}">
      <span class="daily-rank-label ${row.rank === null ? '' : 'has-vote'}">${label}</span>
      <button class="ranking-cat-name" data-detail="${cat.id}" aria-label="认识${cat.name}">${portrait(cat)}<span><strong>${cat.name}</strong><small>${cat.personality}</small></span></button>
      <span class="daily-vote-count"><strong data-day-votes>${formatNumber(row.votes)}</strong><small>票</small></span>
      ${voteButton(cat, state, day)}
    </article>`;
  }).join('')}</div>`;
}

function dailyRankingView(state, day) {
  const rows = getDailyRanking(state, day);
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  return `<div class="ranking-summary"><span>${icon('heart')}今日已送出<strong>${formatNumber(total)}</strong><small>票</small></span><span class="demo-data-badge">${day.replaceAll('-', '.')} · ${state.mode === 'demo' ? '演示样例' : '共享应援'}</span></div>
    ${total ? '' : `<div id="daily-empty" class="daily-empty">${icon('paw-print')}<div><h3>今天的第一份偏爱，等你送出</h3><p>今日尚无应援</p></div></div>`}
    ${rankList(rows, state, day)}
    <p class="daily-ranking-note">${icon('circle-help')}${state.mode === 'demo' ? '演示数据，不写入共享榜。' : '北京时间今日新增应援，不含历史票数。'}同票并列，按候选编号排列。</p>`;
}

export function rankingView(state, day, mode = 'today') {
  return `<div class="ranking-modes" role="group" aria-label="榜单范围">
    <button data-ranking-mode="today" aria-pressed="${mode === 'today'}">${icon('heart')}今日应援</button>
    <button data-ranking-mode="total" aria-pressed="${mode === 'total'}">${icon('trophy')}累计人气</button>
  </div>${mode === 'today' ? dailyRankingView(state, day) : cumulativeRankingView(state, day)}`;
}

export function completionView(state, day) {
  const ids = getDailyVotes(state, day);
  if (ids.length !== DAILY_LIMIT) return '';
  return `<div class="completion-copy"><span class="eyebrow">${day.replaceAll('-', '.')} / 03 OF 03</span><h2 id="completion-title">${icon('circle-check')}今日偏爱，已全部送达</h2><p>三份心动，值得认真留下。</p></div>
    <div class="completion-cats">${ids.map((id) => {
      const cat = CATS.find((item) => item.id === id);
      return `<figure>${portrait(cat)}<figcaption>${cat.name}</figcaption></figure>`;
    }).join('')}</div>
    <div class="completion-actions"><button class="primary-button" data-action="souvenir">${icon('image-down')}生成应援纪念卡</button><a href="#mine">${icon('heart')}查看我的应援${icon('arrow-right')}</a></div>`;
}

export function detailView(cat, state, day) {
  const rank = catRank(state, cat.id);
  return `<div class="detail-layout tone-${cat.color}">
    <button class="dialog-close icon-button" data-close="cat" aria-label="关闭猫咪详情" data-tip="关闭">${icon('x')}</button>
    <div class="detail-portrait">${portrait(cat)}<span class="detail-number">MEOW FILE / ${String(CATS.indexOf(cat) + 1).padStart(2, '0')}</span></div>
    <div class="detail-content"><span class="eyebrow">${cat.english}'S LITTLE WORLD</span><h2 id="dialog-cat-name">${cat.name}<span class="personality">${cat.personality}</span></h2><p class="detail-meta">${cat.breed} · ${cat.age}</p><p class="detail-motto">“${cat.motto}”</p><p class="detail-story">${cat.story}</p><h3>心动关键词</h3><div class="likes">${cat.likes.map((like) => `<span>${icon('sparkles')}${like}</span>`).join('')}</div><div class="detail-stats"><div><span>累计人气</span><strong>${formatNumber(catTotal(state, cat))}<small>票</small></strong></div><div><span>本期排名</span><strong>${rank === null ? '<small>未上榜</small>' : `<small>NO.</small>${String(rank).padStart(2, '0')}`}</strong></div></div><button class="favorite-button detail-favorite" data-favorite="${cat.id}" aria-pressed="${state.favoriteCatId === cat.id}">${icon('star')}${state.favoriteCatId === cat.id ? '取消本命猫' : '设为本命猫'}</button><div id="detail-vote">${voteButton(cat, state, day, 'detail-vote-button')}</div></div>
  </div>`;
}
