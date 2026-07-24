import { Router } from 'express';
import { cache } from '../services/cache.js';

export const cacheRouter = Router();

// GET /api/cache/stats — how many recipes are cached, and the TTL.
cacheRouter.get('/stats', async (_req, res) => {
  res.json(await cache.stats());
});

// DELETE /api/cache — flush the cache; returns how many entries were removed.
cacheRouter.delete('/', async (_req, res) => {
  res.json({ cleared: await cache.clear() });
});
