import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initStore } from '../src/store/recipeStore.js';
import { initCache } from '../src/services/cache.js';

// Full HTTP integration: real router + service + in-memory store/cache, no mocks.
// Runs in DEMO mode (no ANTHROPIC_API_KEY) so generate is deterministic & offline.
let app;
beforeAll(async () => {
  delete process.env.MONGODB_URI;
  delete process.env.REDIS_URL;
  await initStore();
  await initCache();
  app = createApp();
});

describe('GET /api/health', () => {
  it('reports demo mode with in-memory store and cache', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', mode: 'demo', store: 'memory', cache: 'memory' });
  });
});

describe('POST /api/recipes/generate validation', () => {
  it('400 when ingredients missing/empty', async () => {
    const res = await request(app).post('/api/recipes/generate').send({ ingredients: [] });
    expect(res.status).toBe(400);
  });
  it('400 when over the ingredient cap', async () => {
    const res = await request(app)
      .post('/api/recipes/generate')
      .send({ ingredients: Array.from({ length: 31 }, (_, i) => `i${i}`) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/max 30/i);
  });
  it('400 when diet is not a subset of the allowed set', async () => {
    const res = await request(app).post('/api/recipes/generate').send({ ingredients: ['egg'], diet: ['paleo'] });
    expect(res.status).toBe(400);
  });
});

describe('generate → save → list → delete', () => {
  it('generates, then serves the repeat from cache', async () => {
    const payload = { ingredients: ['egg', 'rice'], mealType: 'dinner' };
    const first = await request(app).post('/api/recipes/generate').send(payload);
    expect(first.status).toBe(200);
    expect(first.body.generationId).toBeTruthy();
    expect(first.body.cached).toBe(false);

    const second = await request(app).post('/api/recipes/generate').send(payload);
    expect(second.body.cached).toBe(true);
  });

  it('saves (201, idempotent), lists, and deletes (200 then 404)', async () => {
    const gen = await request(app).post('/api/recipes/generate').send({ ingredients: ['carrot'] });
    const recipe = gen.body;

    const saved = await request(app).post('/api/recipes').send(recipe);
    expect(saved.status).toBe(201);
    expect(saved.body.id).toBeTruthy();

    const again = await request(app).post('/api/recipes').send(recipe);
    expect(again.body.id).toBe(saved.body.id); // idempotent on generationId

    const list = await request(app).get('/api/recipes');
    expect(list.body.some((r) => r.id === saved.body.id)).toBe(true);

    expect((await request(app).delete(`/api/recipes/${saved.body.id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/recipes/${saved.body.id}`)).status).toBe(404);
  });

  it('400 when saving a payload without generationId/title', async () => {
    const res = await request(app).post('/api/recipes').send({ title: 'orphan' });
    expect(res.status).toBe(400);
  });
});

describe('cache endpoints', () => {
  it('GET /api/cache/stats returns entry count + TTL', async () => {
    const res = await request(app).get('/api/cache/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.entries).toBe('number');
    expect(res.body.ttlSeconds).toBeGreaterThan(0);
  });
  it('DELETE /api/cache flushes and reports how many were cleared', async () => {
    const res = await request(app).delete('/api/cache');
    expect(res.status).toBe(200);
    expect(typeof res.body.cleared).toBe('number');
  });
});

describe('rate limiting', () => {
  it('returns 429 once the per-window limit is exceeded', async () => {
    // Fresh app => fresh limiter, so this test does not disturb the others.
    const freshApp = createApp();
    let sawTooMany = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(freshApp).post('/api/recipes/generate').send({ ingredients: ['egg'] });
      if (res.status === 429) { sawTooMany = true; break; }
    }
    expect(sawTooMany).toBe(true);
  });
});
