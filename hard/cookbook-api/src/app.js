import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipesRouter } from './routes/recipes.js';
import { cacheRouter } from './routes/cache.js';
import { store } from './store/recipeStore.js';
import { cache } from './services/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  // CORS allowlist (only needed when the UI is served from a different origin).
  const origin = process.env.CLIENT_ORIGIN;
  if (origin) {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'content-type');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: process.env.ANTHROPIC_API_KEY ? 'live' : 'demo',
      store: store.kind(),
      cache: cache.kind(),
    });
  });

  app.use('/api/recipes', recipesRouter);
  app.use('/api/cache', cacheRouter);

  // Serve the built UI from the public folder (single-process convenience).
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}
