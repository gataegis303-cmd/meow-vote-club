import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { createApi } from './server/api.js';

function votingService() {
  const install = (server) => {
    const api = createApi({ databasePath: process.env.MEOW_DB ?? resolve('data/votes.sqlite') });
    server.middlewares.use(api.handler);
    server.httpServer?.once('close', () => api.close());
  };
  return { name: 'meow-voting-service', configureServer: install, configurePreviewServer: install };
}

export default defineConfig({
  plugins: [votingService()],
  server: {
    host: '127.0.0.1',
    fs: { deny: ['**/.git/**', '**/.env*', '**/*.{crt,pem}', '**/data/**', '**/*.sqlite*'] },
  },
  preview: { host: '127.0.0.1' },
});
