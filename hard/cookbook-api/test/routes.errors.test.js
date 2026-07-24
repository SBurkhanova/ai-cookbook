import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Coverage gap: the route error branches (422/502/500) never fire in demo mode
// because nothing throws. Mock the service so we can force each failure and
// assert the HTTP contract the frontend relies on.
vi.mock('../src/services/recipeService.js', () => ({
  generate: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));

import { createApp } from '../src/app.js';
import * as recipes from '../src/services/recipeService.js';

let app;
beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
});

describe('generate error mapping', () => {
  it('maps RECIPE_MODEL_ERROR to 422 (model refused)', async () => {
    recipes.generate.mockRejectedValue(Object.assign(new Error('Cannot generate.'), { code: 'RECIPE_MODEL_ERROR' }));
    const res = await request(app).post('/api/recipes/generate').send({ ingredients: ['motor oil'] });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Cannot generate/);
  });

  it('maps any other error to a clean 502 (never a hung request)', async () => {
    recipes.generate.mockRejectedValue(Object.assign(new Error('parse fail'), { code: 'RECIPE_PARSE_ERROR' }));
    const res = await request(app).post('/api/recipes/generate').send({ ingredients: ['egg'] });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/try again/i);
  });

  it('de-dupes the diet array before calling the service (line-level gap)', async () => {
    recipes.generate.mockResolvedValue({ title: 'ok' });
    await request(app).post('/api/recipes/generate').send({ ingredients: ['egg'], diet: ['vegan', 'vegan'] });
    expect(recipes.generate).toHaveBeenCalledWith(expect.objectContaining({ diet: ['vegan'] }));
  });
});

describe('save error mapping', () => {
  it('maps a store failure to 500', async () => {
    recipes.save.mockRejectedValue(new Error('db down'));
    const res = await request(app).post('/api/recipes').send({ generationId: 'g1', title: 'T' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Could not save/i);
  });
});
