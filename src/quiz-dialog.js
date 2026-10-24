import { CATS } from './cats.js';
import { QUIZ, matchCat } from './experience.js';
import { icon, portrait } from './views.js';

export function setupQuizDialog({ getProfile, setProfile, openDetail, drawIcons }) {
  const dialog = document.querySelector('#quiz-dialog');
  const content = document.querySelector('#quiz-content');
  let answers = [];
  let step = 0;
  let result = null;
  let trigger;

  function render() {
    const cat = CATS.find((item) => item.id === result);
    content.innerHTML = `<button class="dialog-close icon-button" data-close="quiz" aria-label="关闭同频测试" data-tip="关闭">${icon('x')}</button>
      <span class="eyebrow">${cat ? 'YOUR LITTLE SOULMATE' : `FIND YOUR CAT / 0${step + 1} OF 05`}</span>
      <h2 id="quiz-title">${cat ? `你与${cat.name}，有点同频` : '遇见同频的小猫'}</h2>
      ${cat ? `<div class="quiz-result tone-${cat.color}">${portrait(cat)}<span class="personality">${cat.personality}</span><p>“${cat.motto}”</p><small>趣味匹配，仅供娱乐，不是心理测评。</small></div>
        <div class="quiz-result-actions"><button class="primary-button" data-quiz-favorite="${cat.id}" ${getProfile().favoriteCatId === cat.id ? 'disabled' : ''}>${icon('star')}${getProfile().favoriteCatId === cat.id ? '已是本命猫' : '设为本命猫'}</button><button class="subtle-button" data-quiz-detail="${cat.id}">认识 ${cat.name}${icon('arrow-right')}</button><button class="subtle-button" data-quiz-restart>${icon('rotate-cw')}重新测试</button></div>` :
        `<div class="quiz-progress" role="progressbar" aria-label="答题进度" aria-valuemin="1" aria-valuemax="${QUIZ.length}" aria-valuenow="${step + 1}" aria-valuetext="第 ${step + 1} 题，共 ${QUIZ.length} 题">${QUIZ.map((_, i) => `<span class="${i <= step ? 'filled' : ''}"></span>`).join('')}</div>
        <fieldset class="quiz-question"><legend>${QUIZ[step].title}</legend><div class="quiz-choices">${QUIZ[step].choices.map((choice, index) => `<label><input type="radio" name="quiz-answer" value="${CATS[index].id}" ${answers[step] === CATS[index].id ? 'checked' : ''} /><span>${choice}</span></label>`).join('')}</div></fieldset>
        <footer class="quiz-footer"><button class="subtle-button" data-quiz-back ${step === 0 ? 'disabled' : ''}>${icon('chevron-left')}上一题</button><span>趣味测试 · 不消耗应援票</span><button class="primary-button" data-quiz-next ${answers[step] ? '' : 'disabled'}>${step === 4 ? '看看结果' : '下一题'}${icon('arrow-right')}</button></footer>`}`;
    drawIcons();
  }

  function show(button) {
    trigger = button;
    result = getProfile().quizCatId;
    answers = [];
    step = 0;
    render();
    dialog.showModal();
  }
  content.addEventListener('change', (event) => {
    if (event.target.name !== 'quiz-answer') return;
    answers[step] = event.target.value;
    content.querySelector('[data-quiz-next]').disabled = false;
  });
  content.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-quiz-next')) {
      if (!answers[step]) return;
      if (step === 4) {
        result = matchCat(answers);
        setProfile({ quizCatId: result });
      } else step += 1;
      render();
      (content.querySelector('input') ?? content.querySelector('[data-quiz-favorite]'))?.focus();
    } else if (button.hasAttribute('data-quiz-back')) {
      step = Math.max(0, step - 1);
      render();
      content.querySelector('input')?.focus();
    } else if (button.hasAttribute('data-quiz-restart')) {
      step = 0;
      answers = [];
      result = null;
      render();
      content.querySelector('input')?.focus();
    } else if (button.dataset.quizFavorite) {
      setProfile({ favoriteCatId: button.dataset.quizFavorite });
      render();
      content.querySelector('[data-quiz-detail]')?.focus();
    } else if (button.dataset.quizDetail) {
      const id = button.dataset.quizDetail;
      dialog.close();
      openDetail(id, document.querySelector('[data-action="quiz"]'));
    }
  });
  dialog.addEventListener('close', () => {
    (trigger?.isConnected ? trigger : document.querySelector('[data-action="quiz"]'))?.focus({ preventScroll: true });
  });
  return { show };
}
