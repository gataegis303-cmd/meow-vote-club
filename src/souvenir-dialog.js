import { createSouvenirImage, souvenirFilename } from './souvenir.js';
import { CATS } from './cats.js';

export function setupSouvenirDialog(getData, notify, savePreferences = () => {}) {
  const dialog = document.querySelector('#souvenir-dialog');
  const preview = document.querySelector('#souvenir-preview');
  const placeholder = document.querySelector('#souvenir-placeholder');
  const stage = document.querySelector('#souvenir-stage');
  const status = document.querySelector('#souvenir-status');
  const download = document.querySelector('#souvenir-download');
  const retry = document.querySelector('#souvenir-retry');
  const slogan = document.querySelector('#souvenir-slogan');
  const showFavorite = document.querySelector('#souvenir-show-favorite');
  slogan.innerHTML = CATS.map((cat) => `<option value="${cat.id}">${cat.motto}</option>`).join('');
  let snapshot;
  let trigger;
  let objectURL;
  let generation = 0;

  function clearPreview() {
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null;
    preview.removeAttribute('src');
    preview.hidden = true;
    download.removeAttribute('href');
    download.removeAttribute('download');
    download.hidden = true;
  }

  async function generate() {
    const retryHadFocus = document.activeElement === retry;
    const current = ++generation;
    clearPreview();
    retry.hidden = true;
    placeholder.hidden = false;
    placeholder.querySelector('span').textContent = '正在装好今天的偏爱…';
    status.textContent = '纪念卡生成中…';
    stage.setAttribute('aria-busy', 'true');
    try {
      const blob = await createSouvenirImage(snapshot);
      if (current !== generation || !dialog.open) return;
      objectURL = URL.createObjectURL(blob);
      preview.src = objectURL;
      preview.alt = `${snapshot.day} 的应援纪念：${snapshot.cats.map((cat) => cat.name).join('、')}`;
      await preview.decode();
      if (current !== generation || !dialog.open) return;
      preview.hidden = false;
      placeholder.hidden = true;
      download.href = objectURL;
      download.download = souvenirFilename(snapshot);
      download.hidden = false;
      status.textContent = `${snapshot.day.replaceAll('-', '.')} · ${snapshot.cats.map((cat) => cat.name).join('、')}`;
      if (retryHadFocus) download.focus({ preventScroll: true });
    } catch {
      if (current !== generation || !dialog.open) return;
      clearPreview();
      placeholder.querySelector('span').textContent = '偏爱还在，稍后再试一次。';
      status.textContent = '纪念卡暂时没有生成，请重新试一次。';
      retry.hidden = false;
      if (retryHadFocus) retry.focus({ preventScroll: true });
    } finally {
      if (current === generation) stage.setAttribute('aria-busy', 'false');
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button?.dataset.action === 'souvenir') {
      snapshot = getData();
      if (!snapshot) {
        notify('今天的三份偏爱还没有集齐。', false);
        return;
      }
      trigger = button;
      dialog.querySelector(`input[name="souvenir-theme"][value="${snapshot.theme}"]`).checked = true;
      slogan.value = snapshot.sloganCatId;
      showFavorite.checked = snapshot.showFavorite;
      document.querySelector('#souvenir-favorite-control').hidden = !snapshot.favorite;
      dialog.showModal();
      generate();
    } else if (button?.dataset.close === 'souvenir') dialog.close();
  });
  retry.addEventListener('click', generate);
  dialog.querySelector('.souvenir-customization').addEventListener('change', () => {
    if (!snapshot) return;
    const preferences = {
      theme: dialog.querySelector('input[name="souvenir-theme"]:checked').value,
      sloganCatId: slogan.value, showFavorite: showFavorite.checked,
    };
    snapshot = { ...snapshot, ...preferences };
    savePreferences(preferences);
    generate();
  });
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    generation += 1;
    clearPreview();
    snapshot = null;
    stage.setAttribute('aria-busy', 'false');
    const target = trigger?.isConnected ? trigger : document.querySelector('[data-action="souvenir"]') ?? document.querySelector('[data-action="rules"]');
    target?.focus({ preventScroll: true });
  });
}
