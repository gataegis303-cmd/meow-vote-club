import { CATS } from './cats.js';
import { getBadges, monthCells } from './experience.js';
import { icon, portrait, formatNumber } from './views.js';

export function affinityView(profile) {
  const favorite = CATS.find((cat) => cat.id === profile.favoriteCatId);
  const match = CATS.find((cat) => cat.id === profile.quizCatId);
  return `<section class="affinity-strip" aria-label="我的猫咪缘分">
    ${favorite ? `<button class="affinity-portrait" data-detail="${favorite.id}" aria-label="认识本命猫${favorite.name}">${portrait(favorite)}</button>` : `<span class="affinity-symbol">${icon('sparkles')}</span>`}
    <div><span class="eyebrow">A CAT THAT FEELS LIKE YOU</span><h3>${favorite ? `我的本命猫 · ${favorite.name}` : '你的同频小猫，会是谁？'}</h3><p>${favorite ? favorite.motto : match ? `上次遇见了${match.name} · ${match.personality}` : '一点点性格，一点点缘分。'}</p></div>
    <button class="subtle-button" data-action="quiz">${icon('sparkles')}${match ? '再测一次' : '寻找同频猫'}${icon('arrow-right')}</button>
  </section>`;
}

export function journalView({ state, month, history, selectedDay, archive, status, hasLegacy }) {
  const stats = state.stats;
  const votes = history[selectedDay] ?? [];
  const cells = monthCells(month);
  return `<section class="journal" aria-labelledby="journal-title">
    <div class="journal-stats"><div><strong>${formatNumber(stats.days)}</strong><span>应援天数</span></div><div><strong>${formatNumber(stats.votes)}</strong><span>累计偏爱</span></div><div><strong>${stats.uniqueCats}<small> / 6</small></strong><span>支持过的猫咪</span></div></div>
    <div class="badge-grid" aria-label="应援徽章">${getBadges(stats).map((badge) => `<div class="support-badge ${badge.unlocked ? 'is-unlocked' : ''}"><span>${icon(badge.icon)}</span><div><strong>${badge.name}</strong><small>${badge.unlocked ? '已点亮' : badge.description}</small></div>${icon(badge.unlocked ? 'circle-check' : 'lock-keyhole')}</div>`).join('')}</div>
    <div class="journal-heading"><h3 id="journal-title">${icon('calendar-heart')}应援日历</h3>${hasLegacy ? `<div class="archive-tabs" role="group" aria-label="历史来源"><button data-archive="false" aria-pressed="${!archive}">当前记录</button><button data-archive="true" aria-pressed="${archive}">旧版本地</button></div>` : ''}</div>
    ${archive ? '<p class="archive-note">旧版只读历史 · 不计入共享榜、当前统计或徽章</p>' : ''}
    <div class="calendar-layout">
      <div class="calendar"><div class="calendar-toolbar"><button class="icon-button" data-month="-1" aria-label="上个月" data-tip="上个月" ${month <= '2000-01' ? 'disabled' : ''}>${icon('chevron-left')}</button><strong>${month.replace('-', ' 年 ')} 月</strong><button class="icon-button" data-month="1" aria-label="下个月" data-tip="下个月" ${month >= state.day.slice(0, 7) ? 'disabled' : ''}>${icon('chevron-right')}</button></div>
      <div class="calendar-week" aria-hidden="true">${['一', '二', '三', '四', '五', '六', '日'].map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="calendar-days" aria-label="${month} 应援记录">${cells.map((day) => day ? `<button class="calendar-day ${day === state.day ? 'is-today' : ''}" data-day="${day}" aria-label="${day}，${history[day]?.length ?? 0} 票" aria-pressed="${day === selectedDay}" ${day > state.day || status === 'loading' ? 'disabled' : ''}><span>${Number(day.slice(-2))}</span><span class="calendar-dots" aria-hidden="true">${Array.from({ length: history[day]?.length ?? 0 }, () => '<b></b>').join('')}</span></button>` : '<span></span>').join('')}</div></div>
      <div class="day-record" aria-live="polite" aria-busy="${status === 'loading'}"><span class="eyebrow">${selectedDay.replaceAll('-', '.')}</span><h4>${status === 'loading' ? '正在寻找这一天的偏爱…' : status === 'error' ? '暂时没有连接到记录' : votes.length ? '那天的心动，都在这里' : '这一天，留给下一次心动'}</h4>
        ${status === 'error' ? `<button class="subtle-button" data-action="retry-history">${icon('rotate-cw')}重试</button>` : votes.map((id) => {
          const cat = CATS.find((item) => item.id === id);
          return `<button class="day-cat" data-detail="${id}">${portrait(cat)}<span><strong>${cat.name}</strong><small>${cat.personality}</small></span>${icon('heart')}</button>`;
        }).join('')}
        ${!votes.length && status === 'ready' ? `<div class="calendar-empty-image">${portrait(CATS[4])}</div>` : ''}
      </div>
    </div>
  </section>`;
}
