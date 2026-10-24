import { CATS, CAT_IDS } from './cats.js';

export const PROFILE_KEY = 'meow-vote-club:profile:v1';
export const THEMES = [
  { id: 'pink', name: '莓果粉', background: '#fff4f7', ink: '#b8324d', line: '#e6cfd8' },
  { id: 'mint', name: '薄荷绿', background: '#eef8f1', ink: '#426e58', line: '#c9ded0' },
  { id: 'yellow', name: '奶油黄', background: '#fff9e6', ink: '#84621e', line: '#e5d9ae' },
];
export const QUIZ = [
  { title: '终于放假了，你最想做什么？', choices: ['发现一家好吃的小店', '留一点只属于自己的时间', '陪重要的人慢慢聊天', '试试从没玩过的新东西', '关掉闹钟，好好睡一觉', '约上朋友一起出门'] },
  { title: '朋友聚会里，你通常是？', choices: ['认真研究菜单的人', '安静观察，偶尔一语中的', '照顾大家感受的人', '突然讲出笑话的人', '舒服地听大家聊天', '让新朋友也融入的人'] },
  { title: '忙碌的一天结束，什么能让你恢复？', choices: ['一顿热气腾腾的晚餐', '不被打扰的独处空间', '一句温柔的关心', '一件毫无道理的快乐小事', '窝在柔软的毯子里', '和喜欢的人分享今天'] },
  { title: '收到礼物时，你最在意什么？', choices: ['它能让日常变得更满足', '对方记住了我的独特喜好', '藏在礼物里的那份心意', '拆开时意想不到的惊喜', '它带来的自在和舒适', '能和对方一起创造回忆'] },
  { title: '理想中的陪伴，更像哪一种？', choices: ['一起吃饭，一起认真生活', '各忙各的，但知道彼此在', '可以放心说心事', '一起把普通日子过成冒险', '一起发呆也很舒服', '开心和喜欢都大声表达'] },
];

export function matchCat(answers) {
  if (!Array.isArray(answers) || answers.length !== QUIZ.length || answers.some((id) => !CAT_IDS.includes(id))) return null;
  return [...CAT_IDS].sort((a, b) => answers.filter((id) => id === b).length - answers.filter((id) => id === a).length)[0];
}

export function parseProfile(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { /* Fall back to the default preferences. */ }
  const cat = (id) => CAT_IDS.includes(id) ? id : null;
  return {
    favoriteCatId: cat(value?.favoriteCatId),
    quizCatId: cat(value?.quizCatId),
    theme: THEMES.some((theme) => theme.id === value?.theme) ? value.theme : 'pink',
    sloganCatId: cat(value?.sloganCatId) ?? CATS[0].id,
    showFavorite: value?.showFavorite !== false,
  };
}

export function getBadges(stats) {
  return [
    { id: 'first', name: '第一份偏爱', description: '完成首次应援', icon: 'heart', unlocked: stats.votes > 0 },
    { id: 'full', name: '三份刚刚好', description: '任意一天送完三票', icon: 'ticket', unlocked: stats.hasFullDay },
    { id: 'days', name: '常来看看', description: '累计应援三个日期', icon: 'calendar-heart', unlocked: stats.days >= 3 },
    { id: 'all', name: '全员心动', description: '累计支持六只猫咪', icon: 'paw-print', unlocked: stats.uniqueCats === 6 },
  ];
}

export function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthCells(month) {
  const [year, number] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells = Array(offset).fill(null);
  for (let day = 1; day <= length; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
