import { describe, it, expect } from 'vitest';
import { parseRecipeResponse, buildUserPrompt } from '../src/services/anthropicClient.js';

const valid = JSON.stringify({
  title: 'Test', servings: '2', time: '20 min', difficulty: 'Easy',
  ingredients: ['a'], steps: ['x'], tips: 'y',
});

describe('parseRecipeResponse', () => {
  it('parses a plain JSON object', () => {
    expect(parseRecipeResponse(valid).title).toBe('Test');
  });

  it('strips a ```json fence (case a)', () => {
    const fenced = '```json\n' + valid + '\n```';
    expect(parseRecipeResponse(fenced).title).toBe('Test');
  });

  it('extracts JSON wrapped in chatty text', () => {
    expect(parseRecipeResponse('Here you go: ' + valid + ' Enjoy!').title).toBe('Test');
  });

  it('throws RECIPE_PARSE_ERROR on truncated/garbage output (case b)', () => {
    expect(() => parseRecipeResponse('{ "title": "oops", "steps": [')).toThrowError(/unparseable/);
    try { parseRecipeResponse('not json at all'); } catch (e) { expect(e.code).toBe('RECIPE_PARSE_ERROR'); }
  });

  it('throws RECIPE_MODEL_ERROR on an {error} payload (case c)', () => {
    try {
      parseRecipeResponse('{"error":"Cannot generate a recipe from these ingredients."}');
    } catch (e) {
      expect(e.code).toBe('RECIPE_MODEL_ERROR');
      expect(e.message).toMatch(/Cannot generate/);
    }
  });
});

describe('buildUserPrompt', () => {
  it('includes ingredients and optional filters', () => {
    const p = buildUserPrompt({ ingredients: ['egg', 'rice'], mealType: 'dinner', cookTime: '30 minutes' });
    expect(p).toMatch(/egg, rice/);
    expect(p).toMatch(/dinner/);
    expect(p).toMatch(/30 minutes/);
  });

  it('includes dietary restrictions when provided', () => {
    const p = buildUserPrompt({ ingredients: ['tofu'], diet: ['vegan', 'gluten-free'] });
    expect(p).toMatch(/Dietary restrictions/);
    expect(p).toMatch(/vegan, gluten-free/);
  });

  it('omits dietary restrictions when none given', () => {
    expect(buildUserPrompt({ ingredients: ['egg'] })).not.toMatch(/Dietary/);
  });
});
