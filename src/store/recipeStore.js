// Recipe storage with two interchangeable drivers, both idempotent on
// generationId: MongoDB (when MONGODB_URI is set) or in-memory (default).

import { randomUUID } from 'node:crypto';

let driver = null;

export async function initStore() {
  const uri = process.env.MONGODB_URI;
  driver = uri ? await mongoDriver(uri) : createMemoryDriver();
  return driver.kind;
}

export const store = {
  save: (recipe) => driver.save(recipe),
  list: () => driver.list(),
  remove: (id) => driver.remove(id),
  kind: () => driver?.kind || 'uninitialized',
};

async function mongoDriver(uri) {
  const { MongoClient, ObjectId } = await import('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection('recipes');
  await col.createIndex({ generationId: 1 }, { unique: true });
  const out = (doc) => doc && { ...doc, id: doc._id.toString(), _id: undefined };

  return {
    kind: 'mongodb',
    async save(recipe) {
      const now = new Date().toISOString();
      const { _id, id, ...clean } = recipe;
      const res = await col.findOneAndUpdate(
        { generationId: recipe.generationId },
        { $setOnInsert: { ...clean, createdAt: now, updatedAt: now } },
        { upsert: true, returnDocument: 'after' }
      );
      return out(res);
    },
    async list() {
      return (await col.find().sort({ createdAt: -1 }).toArray()).map(out);
    },
    async remove(id) {
      if (!ObjectId.isValid(id)) return false;
      return (await col.deleteOne({ _id: new ObjectId(id) })).deletedCount > 0;
    },
  };
}

// Exported for unit tests.
export function createMemoryDriver() {
  const byGeneration = new Map();
  const order = [];
  return {
    kind: 'memory',
    async save(recipe) {
      const existing = byGeneration.get(recipe.generationId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const { _id, id, ...clean } = recipe;
      const saved = { ...clean, id: randomUUID(), createdAt: now, updatedAt: now };
      byGeneration.set(recipe.generationId, saved);
      order.unshift(saved.id);
      return saved;
    },
    async list() {
      return order.map((id) => [...byGeneration.values()].find((r) => r.id === id)).filter(Boolean);
    },
    async remove(id) {
      for (const [gen, r] of byGeneration) {
        if (r.id === id) {
          byGeneration.delete(gen);
          order.splice(order.indexOf(id), 1);
          return true;
        }
      }
      return false;
    },
  };
}
