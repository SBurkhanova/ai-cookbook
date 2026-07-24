import { describe, it, expect, beforeEach, vi } from 'vitest';

// Isolate the service from its collaborators: the model client, the cache,
// and the store are all mocked, so these tests assert ORCHESTRATION logic only.
vi.mock('../src/services/anthropicClient.js', () => ({
  generateRecipe: vi.fn(),
}));
vi.mock('../src/services/cache.js', () => ({
  buildCacheKey: vi.fn(() => 'CACHE_KEY'),
  cache: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../src/store/recipeStore.js', () => ({
  store: { save: vi.fn(), list: vi.fn(), remove: vi.fn() },
}));

import * as service from '../src/services/recipeService.js';
import { generateRecipe } from '../src/services/anthropicClient.js';
import { cache } from '../src/services/cache.js';
import { store } from '../src/store/recipeStore.js';

const modelRecipe = { title: 'Egg Fried Rice', difficulty: 'Easy', ingredients: ['egg'], steps: ['cook'] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('service.generate', () => {
  it('on a cache MISS: calls the model, populates the cache, and marks cached=false', async () => {
    cache.get.mockResolvedValue(null);
    generateRecipe.mockResolvedValue(modelRecipe);

    const out = await service.generate({ ingredients: ['egg'], mealType: 'dinner', cookTime: '30 minutes', diet: ['vegan'] });

    expect(generateRecipe).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('CACHE_KEY', modelRecipe);
    expect(out.cached).toBe(false);
    expect(out.title).toBe('Egg Fried Rice');
    // Metadata is sourced from the REQUEST, not the model output:
    expect(out.mealType).toBe('dinner');
    expect(out.cookTimeLimit).toBe('30 minutes');
    expect(out.diet).toEqual(['vegan']);
    expect(out.generationId).toBeTruthy();
  });

  it('on a cache HIT: does NOT call the model and marks cached=true', async () => {
    cache.get.mockResolvedValue(modelRecipe);

    const out = await service.generate({ ingredients: ['egg'], diet: [] });

    expect(generateRecipe).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(out.cached).toBe(true);
  });

  it('mints a DISTINCT generationId per call even for identical input (edge case)', async () => {
    cache.get.mockResolvedValue(modelRecipe);
    const a = await service.generate({ ingredients: ['egg'], diet: [] });
    const b = await service.generate({ ingredients: ['egg'], diet: [] });
    expect(a.generationId).not.toBe(b.generationId);
  });

  it('defaults diet to [] when the request omits it', async () => {
    cache.get.mockResolvedValue(modelRecipe);
    const out = await service.generate({ ingredients: ['egg'] });
    expect(out.diet).toEqual([]);
  });
});

describe('service.save', () => {
  it('strips the transient `cached` flag before persisting', async () => {
    store.save.mockImplementation(async (r) => ({ ...r, id: 'x' }));
    await service.save({ generationId: 'g1', title: 'T', cached: true });
    const persisted = store.save.mock.calls[0][0];
    expect(persisted).not.toHaveProperty('cached');
    expect(persisted.title).toBe('T');
  });
});

describe('service.list / service.remove delegate to the store', () => {
  it('list() returns the store contents', async () => {
    store.list.mockResolvedValue([{ id: '1' }]);
    expect(await service.list()).toEqual([{ id: '1' }]);
  });

  it('remove() passes the id through and returns the store result', async () => {
    store.remove.mockResolvedValue(true);
    expect(await service.remove('abc')).toBe(true);
    expect(store.remove).toHaveBeenCalledWith('abc');
  });
});
