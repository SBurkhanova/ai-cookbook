import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateRecipe } from '../src/services/anthropicClient.js';

// Coverage gap: the live Claude call path (only runs when ANTHROPIC_API_KEY is
// set) was uncovered. We mock fetch to exercise it without a key or network.
const validJson = JSON.stringify({ title: 'Egg Fried Rice', ingredients: ['egg'], steps: ['cook'] });

describe('generateRecipe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns a deterministic demo recipe without touching the network when no key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await generateRecipe({ ingredients: ['zucchini'], mealType: 'lunch' });
    expect(r._demo).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls the Anthropic endpoint with auth headers and parses the reply (mocked fetch)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ text: validJson }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const r = await generateRecipe({ ingredients: ['egg'] });
    expect(r.title).toBe('Egg Fried Rice');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('api.anthropic.com');
    expect(opts.headers['x-api-key']).toBe('sk-test');
    expect(opts.headers['anthropic-version']).toBeTruthy();
  });

  it('throws UPSTREAM_ERROR on a non-2xx response (failure path)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 529 }));
    let code;
    try { await generateRecipe({ ingredients: ['egg'] }); } catch (e) { code = e.code; }
    expect(code).toBe('UPSTREAM_ERROR');
  });
});
