import { parseState, STORAGE_KEY } from './voting.js';
import { PROFILE_KEY, parseProfile } from './experience.js';
import { DEMO_KEY, MODE_KEY, createSharedSource, createDemoSource } from './data-source.js';
import { shanghaiDay, zeroCounts, makeSnapshot } from '../shared/model.js';

export function createAppData(onChange) {
  let generation = 0;
  let operation = 0;
  let syncActive = null;
  let source;
  let sharedProfile;
  let demoProfile;
  let demoVotes;
  const model = { mode: 'shared', state: null, profile: null, status: 'loading', isPending: false, error: '', storageWarning: false };

  function read(storage, key) {
    try { return window[storage].getItem(key); }
    catch { model.storageWarning = true; return null; }
  }
  function write(storage, key, value) {
    try { window[storage].setItem(key, value); }
    catch { model.storageWarning = true; }
  }
  function persistDemo() {
    write('sessionStorage', DEMO_KEY, JSON.stringify({ votes: demoVotes, profile: demoProfile }));
  }
  sharedProfile = parseProfile(read('localStorage', PROFILE_KEY));
  const mode = read('sessionStorage', MODE_KEY);
  try {
    const saved = JSON.parse(read('sessionStorage', DEMO_KEY));
    if (saved?.votes?.version === 1) demoVotes = parseState(JSON.stringify(saved.votes));
    demoProfile = parseProfile(JSON.stringify(saved?.profile));
  } catch { demoProfile = parseProfile(null); }

  function selectSource(nextMode) {
    generation += 1;
    operation += 1;
    syncActive = null;
    model.mode = nextMode;
    model.state = null;
    model.profile = nextMode === 'demo' ? demoProfile : sharedProfile;
    model.error = '';
    model.status = 'loading';
    model.isPending = false;
    source = nextMode === 'demo' ? createDemoSource(
      () => demoVotes, (value) => { demoVotes = value; persistDemo(); },
    ) : createSharedSource();
    write('sessionStorage', MODE_KEY, nextMode);
  }
  selectSource(mode === 'demo' ? 'demo' : 'shared');

  function changed(reason = 'status') { onChange(reason); }
  async function sync(connect = false) {
    if (model.isPending || syncActive !== null) return;
    const ownGeneration = generation;
    const ownOperation = ++operation;
    syncActive = ownOperation;
    try {
      const next = await (connect ? source.connect() : source.snapshot());
      if (ownGeneration !== generation || ownOperation !== operation) return;
      const different = JSON.stringify(model.state) !== JSON.stringify(next) || model.status !== 'ready';
      model.state = next;
      model.status = 'ready';
      model.error = '';
      if (different) changed('snapshot');
    } catch (error) {
      if (ownGeneration !== generation || ownOperation !== operation) return;
      model.status = 'error';
      model.error = error.message === 'Failed to fetch' ? '连接中断，票数未在本地补记。请重新连接确认。' : error.message;
      changed();
    } finally {
      if (syncActive === ownOperation) syncActive = null;
    }
  }

  return {
    model,
    start: () => sync(true),
    refresh: () => sync(),
    reconnect: () => sync(true),
    get generation() { return generation; },
    get viewState() {
      return {
        ...(model.state ?? makeSnapshot(shanghaiDay(), {}, zeroCounts(), zeroCounts(), model.mode)),
        favoriteCatId: model.profile.favoriteCatId,
        isPending: model.isPending, isUnavailable: model.status !== 'ready',
      };
    },
    async vote(catId) {
      if (model.isPending || model.status !== 'ready') return { ok: false, ignored: true };
      const ownGeneration = generation;
      ++operation;
      syncActive = null;
      model.isPending = true;
      changed();
      try {
        const next = await source.vote(catId, model.state.day);
        if (ownGeneration !== generation) return { ok: false, ignored: true };
        model.state = next;
        model.isPending = false;
        model.error = '';
        model.status = 'ready';
        changed('snapshot');
        return { ok: true };
      } catch (error) {
        if (ownGeneration !== generation) return { ok: false, ignored: true };
        model.isPending = false;
        // A lost response may still represent a committed vote. Reconcile, never replay.
        await sync();
        if (ownGeneration !== generation) return { ok: false, ignored: true };
        return { ok: false, message: error.code ? error.message : '结果待确认，已重新查询票数；请勿连续重试。' };
      }
    },
    setMode(nextMode) {
      selectSource(nextMode);
      changed('mode');
      return sync(true);
    },
    resetDemo() {
      if (model.mode !== 'demo') return;
      generation += 1;
      operation += 1;
      model.isPending = false;
      source.reset();
      demoProfile = parseProfile(null);
      model.profile = demoProfile;
      persistDemo();
      changed('mode');
      return sync();
    },
    updateProfile(patch) {
      model.profile = parseProfile(JSON.stringify({ ...model.profile, ...patch }));
      if (model.mode === 'demo') {
        demoProfile = model.profile;
        persistDemo();
      } else {
        sharedProfile = model.profile;
        write('localStorage', PROFILE_KEY, JSON.stringify(sharedProfile));
      }
      changed('profile');
    },
    async history(month) {
      const ownGeneration = generation;
      const data = await source.history(month);
      if (ownGeneration !== generation) throw new Error('STALE_MODE');
      return data;
    },
    legacy() {
      return parseState(read('localStorage', STORAGE_KEY));
    },
    syncProfile() {
      sharedProfile = parseProfile(read('localStorage', PROFILE_KEY));
      if (model.mode === 'shared') {
        model.profile = sharedProfile;
        changed('profile');
      }
    },
  };
}
