import { describe, it, expect } from 'vitest';
import { createMemoryDriver } from '../src/store/recipeStore.js';

const recipe = (generationId, title = 'R') => ({
  generationId, title, difficulty: 'Easy', ingredients: ['a'], steps: ['x'],
});

describe('memory store', () => {
  it('saves and returns a recipe with a server-minted id', async () => {
    const s = createMemoryDriver();
    const saved = await s.save(recipe('g1'));
    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeTruthy();
  });

  it('is idempotent on generationId (double-save -> one entry, same id)', async () => {
    const s = createMemoryDriver();
    const r = recipe('g1');
    const a = await s.save(r);
    const b = await s.save(r);
    expect(a.id).toBe(b.id);
    expect((await s.list()).length).toBe(1);
  });

  it('lists newest first', async () => {
    const s = createMemoryDriver();
    await s.save(recipe('g1', 'first'));
    await s.save(recipe('g2', 'second'));
    const list = await s.list();
    expect(list.map((r) => r.title)).toEqual(['second', 'first']);
  });

  it('removes by id and returns false for unknown id', async () => {
    const s = createMemoryDriver();
    const saved = await s.save(recipe('g1'));
    expect(await s.remove(saved.id)).toBe(true);
    expect((await s.list()).length).toBe(0);
    expect(await s.remove('nope')).toBe(false);
  });
});
