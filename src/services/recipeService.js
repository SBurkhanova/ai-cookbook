// Business logic: turns a request into a recipe and manages saved recipes.
// Keeps routes thin and keeps the Claude/cache/store details out of HTTP handling.

import { randomUUID } from 'node:crypto';
import { generateRecipe } from './anthropicClient.js';
import { cache, buildCacheKey } from './cache.js';
import { store } from '../store/recipeStore.js';

export async function generate({ ingredients, mealType, cookTime, diet }) {
  // Caching layer: identical requests reuse the generated recipe (no Claude call).
  const key = buildCacheKey({ ingredients, mealType, cookTime, diet });
  let recipe = await cache.get(key);
  let cached = true;
  if (!recipe) {
    recipe = await generateRecipe({ ingredients, mealType, cookTime, diet });
    await cache.set(key, recipe);
    cached = false;
  }
  // Request metadata is the source of truth — not Claude's output.
  // generationId is minted per request; `cached` is transient UI info.
  return {
    ...recipe,
    mealType: mealType || null,
    cookTimeLimit: cookTime || null,
    diet: diet || [],
    generationId: randomUUID(),
    cached,
  };
}

export function save(recipe) {
  const { cached, ...clean } = recipe; // never persist the transient cache flag
  return store.save(clean);
}

export function list() {
  return store.list();
}

export function remove(id) {
  return store.remove(id);
}
