import { CATS } from './cats.js';
import { DAILY_LIMIT, getDailyVotes } from './voting.js';
import { parseProfile, THEMES } from './experience.js';

export function getSouvenirData(state, day, preferences = {}) {
  const ids = getDailyVotes(state, day);
  if (ids.length !== DAILY_LIMIT) return null;
  const profile = parseProfile(JSON.stringify(preferences));
  const favorite = CATS.find((cat) => cat.id === profile.favoriteCatId);
  return {
    day, cats: ids.map((id) => ({ ...CATS.find((cat) => cat.id === id) })),
    theme: profile.theme, sloganCatId: profile.sloganCatId, showFavorite: profile.showFavorite,
    favorite: favorite ? { ...favorite } : null, mode: state.mode ?? 'local',
  };
}

export const souvenirFilename = (data) => `喵喵应援纪念-${data.day}.png`;

async function loadPortrait(cat) {
  const image = new Image();
  image.src = `/images/${cat.id}.webp`;
  let timeout;
  try {
    await Promise.race([
      image.decode(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Portrait timeout')), 10000); }),
    ]);
    return image;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createSouvenirImage(data) {
  const images = await Promise.all(data.cats.map(loadPortrait));
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const theme = THEMES.find((item) => item.id === data.theme) ?? THEMES[0];
  const slogan = CATS.find((cat) => cat.id === data.sloganCatId)?.motto ?? '三份偏爱，刚刚好。';
  const font = '"PingFang SC", "Microsoft YaHei", sans-serif';
  const text = (value, x, y, size, color = '#323139', weight = 400, align = 'left') => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  };
  const rounded = (x, y, width, height, radius, color) => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const line = (y) => {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(836, y);
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, 900, 1200);
  ctx.beginPath();
  ctx.roundRect(28, 28, 844, 1144, 32);
  ctx.strokeStyle = theme.line;
  ctx.stroke();
  text('MEOW VOTE CLUB / DAILY KEEPSAKE', 64, 92, 20, '#8c5e75', 600);
  text('今日偏爱', 64, 182, 62, '#323139', 700);
  text('已全部送达', 64, 262, 62, theme.ink, 700);
  text(data.day.replaceAll('-', '.'), 64, 310, 24, '#756575');
  rounded(688, 126, 148, 130, 24, '#e5f0e8');
  text('03 / 03', 762, 185, 36, '#426e58', 700, 'center');
  text('心动已收集', 762, 223, 18, '#426e58', 500, 'center');
  line(350);

  data.cats.forEach((cat, index) => {
    const x = 64 + index * 270;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, 400, 232, 232, 28);
    ctx.clip();
    ctx.drawImage(images[index], x, 400, 232, 232);
    ctx.restore();
    text(cat.name, x + 116, 689, 36, '#323139', 700, 'center');
    text(cat.personality, x + 116, 727, 20, '#756575', 400, 'center');
    rounded(x + 26, 754, 180, 44, 22, '#e5f0e8');
    text('今日已应援', x + 116, 783, 20, '#426e58', 500, 'center');
  });

  line(846);
  text(slogan, 64, 920, 30, theme.ink, 600);
  text(data.showFavorite && data.favorite ? `我的本命猫：${data.favorite.name} · ${data.favorite.personality}` : '今天也被小猫治愈了。', 64, 973, 28, '#756575');
  text('喵喵人气事务所', 64, 1064, 26, '#323139', 600);
  text('A LITTLE LOVE, EVERY DAY.', 64, 1100, 18, '#756575');
  text(`${data.mode === 'demo' ? '演示样例' : '本地生成的应援纪念'} · 非线上投票凭证`, 64, 1138, 18, '#756575');
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png');
  });
}
