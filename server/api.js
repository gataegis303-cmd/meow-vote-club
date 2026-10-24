import { createStore, ApiError } from './store.js';

const messages = {
  SESSION_REQUIRED: '匿名身份不可用，请允许 Cookie 后重新连接。',
  INVALID_CAT: '没有找到这只猫咪。', INVALID_BODY: '请求格式不正确。',
  INVALID_MONTH: '月份格式不正确。', DAY_CHANGED: '已经是新的一天，请查看更新后的票额。',
  DUPLICATE: '今天已经为这只猫咪应援。', LIMIT: '今天的三份偏爱已全部送达。',
  FORBIDDEN: '请求来源不被允许。', NOT_FOUND: '接口不存在。',
  TOO_LARGE: '请求内容过大。', INTERNAL: '服务暂时不可用，请稍后重试。',
};

function readToken(req) {
  const entry = (req.headers.cookie ?? '').split(';').map((item) => item.trim()).find((item) => item.startsWith('meowSession='));
  return entry?.slice('meowSession='.length);
}

async function readBody(req) {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new ApiError('INVALID_BODY');
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 1024) throw new ApiError('TOO_LARGE', 413);
  }
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ApiError('INVALID_BODY'); }
}

export function createApi(options = {}) {
  const store = createStore(options);
  function send(res, status, value, headers = {}) {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', ...headers,
    });
    res.end(JSON.stringify(value));
  }
  async function handler(req, res, next) {
    if (!req.url?.startsWith('/api/')) {
      if (next) return next();
      return send(res, 404, { error: { code: 'NOT_FOUND', message: messages.NOT_FOUND } });
    }
    try {
      const host = req.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new ApiError('FORBIDDEN', 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ApiError('FORBIDDEN', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError('FORBIDDEN', 403);
      const url = new URL(req.url, `http://${host}`);
      const token = readToken(req);
      if (req.method === 'POST' && url.pathname === '/api/session') {
        const body = await readBody(req);
        if (Object.keys(body).length) throw new ApiError('INVALID_BODY');
        if (store.hasSession(token)) return send(res, 200, { ok: true });
        const created = store.createSession();
        return send(res, 200, { ok: true }, {
          'set-cookie': `meowSession=${created}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`,
        });
      }
      if (req.method === 'GET' && url.pathname === '/api/snapshot') return send(res, 200, store.snapshot(token));
      if (req.method === 'GET' && url.pathname === '/api/me/history') return send(res, 200, store.history(token, url.searchParams.get('month')));
      if (req.method === 'POST' && url.pathname === '/api/votes') {
        const body = await readBody(req);
        if (Object.keys(body).length !== 2 || typeof body.catId !== 'string' || typeof body.expectedDay !== 'string') throw new ApiError('INVALID_BODY');
        return send(res, 200, store.vote(token, body.catId, body.expectedDay));
      }
      throw new ApiError('NOT_FOUND', 404);
    } catch (error) {
      const known = error instanceof ApiError;
      if (!known) console.error('Voting service request failed:', error.code ?? error.name);
      const code = known ? error.code : 'INTERNAL';
      send(res, known ? error.status : 500, { error: { code, message: messages[code] } });
    }
  }
  return { store, handler, close: () => store.close() };
}
