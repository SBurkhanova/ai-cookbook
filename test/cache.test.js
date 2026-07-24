import { describe, it, expect } from 'vitest';
import { createMemoryDriver, buildCacheKey } from '../src/services/cache.js';

describe('buildCacheKey', () => {
  it('normalizes order, case, and whitespace', () => {
    const a = buildCacheKey({ ingredients: ['Chicken', ' garlic '], mealType: 'dinner' });
    const b = buildCacheKey({ ingredients: ['garlic', 'chicken'], mealType: 'dinner' });
    expect(a).toBe(b);
  });

  it('de-dupes repeated ingredients', () => {
    expect(buildCacheKey({ ingredients: ['egg', 'egg'] })).toBe(buildCacheKey({ ingredients: ['egg'] }));
  });

  it('distinguishes different filters', () => {
    expect(buildCacheKey({ ingredients: ['egg'], mealType: 'breakfast' }))
      .not.toBe(buildCacheKey({ ingredients: ['egg'], mealType: 'dinner' }));
  });

  it('distinguishes different diets but ignores diet order', () => {
    const vegan = buildCacheKey({ ingredients: ['egg'], diet: ['vegan'] });
    const none = buildCacheKey({ ingredients: ['egg'] });
    expect(vegan).not.toBe(none);
    const a = buildCacheKey({ ingredients: ['egg'], diet: ['vegan', 'gluten-free'] });
    const b = buildCacheKey({ ingredients: ['egg'], diet: ['gluten-free', 'vegan'] });
    expect(a).toBe(b);
  });
});

describe('memory cache driver', () => {
  it('returns null on miss and the value on hit', async () => {
    const c = createMemoryDriver();
    expect(await c.get('k')).toBeNull();
    await c.set('k', { title: 'X' });
    expect((await c.get('k')).title).toBe('X');
  });

  it('reports entry count and clears', async () => {
    const c = createMemoryDriver();
    await c.set('a', { n: 1 });
    await c.set('b', { n: 2 });
    expect((await c.stats()).entries).toBe(2);
    expect(await c.clear()).toBe(2);
    expect((await c.stats()).entries).toBe(0);
  });
});
