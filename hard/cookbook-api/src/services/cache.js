// Caching layer for recipe generation (Challenge 3).
// Two interchangeable drivers: Redis when REDIS_URL is set, in-memory otherwise.
// Keyed by a normalized request so identical generate requests skip the Claude call.

const TTL_SECONDS = 60 * 60; // 1 hour
const PREFIX = 'cookbook:cache:';

let driver = null;

// Stable key: ingredients lowercased, trimmed, de-duped, sorted; plus filters + diet.
export function buildCacheKey({ ingredients = [], mealType, cookTime, diet = [] }) {
  const norm = [...new Set(ingredients.map((s) => String(s).trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join('|');
  const dietNorm = [...new Set(diet.map((d) => String(d).trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join(',');
  return `${norm}::${mealType || ''}::${cookTime || ''}::${dietNorm}`;
}

export async function initCache() {
  const url = process.env.REDIS_URL;
  driver = url ? await redisDriver(url) : createMemoryDriver();
  return driver.kind;
}

export const cache = {
  get: (k) => driver.get(k),
  set: (k, v) => driver.set(k, v),
  stats: () => driver.stats(),
  clear: () => driver.clear(),
  kind: () => driver?.kind || 'uninitialized',
};

async function redisDriver(url) {
  const { createClient } = await import('redis');
  const client = createClient({ url });
  client.on('error', (e) => console.error('redis error:', e.message));
  await client.connect();
  return {
    kind: 'redis',
    async get(key) {
      const v = await client.get(PREFIX + key);
      return v ? JSON.parse(v) : null;
    },
    async set(key, value) {
      await client.set(PREFIX + key, JSON.stringify(value), { EX: TTL_SECONDS });
    },
    async stats() {
      let entries = 0;
      for await (const _ of client.scanIterator({ MATCH: PREFIX + '*', COUNT: 100 })) entries++;
      return { kind: 'redis', entries, ttlSeconds: TTL_SECONDS };
    },
    async clear() {
      const keys = [];
      for await (const k of client.scanIterator({ MATCH: PREFIX + '*', COUNT: 100 })) keys.push(k);
      if (keys.length) await client.del(keys);
      return keys.length;
    },
  };
}

// Exported for unit tests.
export function createMemoryDriver() {
  const map = new Map(); // key -> { value, expires }
  const prune = () => {
    const t = Date.now();
    for (const [k, e] of map) if (e.expires <= t) map.delete(k);
  };
  return {
    kind: 'memory',
    async get(key) {
      prune();
      return map.get(key)?.value ?? null;
    },
    async set(key, value) {
      map.set(key, { value, expires: Date.now() + TTL_SECONDS * 1000 });
    },
    async stats() {
      prune();
      return { kind: 'memory', entries: map.size, ttlSeconds: TTL_SECONDS };
    },
    async clear() {
      const n = map.size;
      map.clear();
      return n;
    },
  };
}
