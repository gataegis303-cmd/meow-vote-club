import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createApi } from './api.js';

const root = resolve('dist');
const api = createApi({ databasePath: process.env.MEOW_DB ?? resolve('data/votes.sqlite') });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) return api.handler(req, res);
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${root}${sep}`) || !mime[extname(file)] || !(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'content-type': mime[extname(file)], 'x-content-type-options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = Number(process.env.PORT ?? 4173);
server.listen(port, '127.0.0.1', () => console.log(`Meow Vote Club: http://127.0.0.1:${server.address().port}`));
function stop() { server.close(() => { api.close(); process.exit(0); }); }
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
