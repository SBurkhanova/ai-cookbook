import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

// Coverage gap: the CORS allowlist (app.js) only activates when CLIENT_ORIGIN
// is set, which never happens in the default integration run.
afterEach(() => {
  delete process.env.CLIENT_ORIGIN;
});

describe('CORS allowlist (CLIENT_ORIGIN set)', () => {
  it('answers a preflight OPTIONS with 204 and the allow-origin header', async () => {
    process.env.CLIENT_ORIGIN = 'https://cookbook.example';
    const app = createApp();
    const res = await request(app).options('/api/recipes');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://cookbook.example');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('adds the allow-origin header to normal responses too', async () => {
    process.env.CLIENT_ORIGIN = 'https://cookbook.example';
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['access-control-allow-origin']).toBe('https://cookbook.example');
  });
});
