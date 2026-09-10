export interface ChunkCacheKey {
  readonly chunkId: string;
  readonly compilerVersion: string;
  readonly namespace?: string;
}

export interface ChunkCache<T> {
  readonly size: number;
  get(key: ChunkCacheKey): T | undefined;
  set(key: ChunkCacheKey, value: T): void;
  evict(key: ChunkCacheKey): boolean;
  clear(): void;
}

interface CacheEntry<T> {
  readonly key: ChunkCacheKey;
  readonly value: T;
}

function cacheKey(key: ChunkCacheKey): string {
  if (!key.chunkId || !key.compilerVersion) throw new Error("chunk cache key must identify chunk and compiler version");
  return JSON.stringify([key.namespace ?? "legacy", key.chunkId, key.compilerVersion]);
}

export function createChunkCache<T>(capacity: number): ChunkCache<T> {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error("chunk cache capacity must be a positive integer");
  const entries = new Map<string, CacheEntry<T>>();

  return {
    get size() {
      return entries.size;
    },
    get(key) {
      const id = cacheKey(key);
      const entry = entries.get(id);
      if (!entry) return undefined;
      entries.delete(id);
      entries.set(id, entry);
      return entry.value;
    },
    set(key, value) {
      const id = cacheKey(key);
      entries.delete(id);
      entries.set(id, { key: { ...key }, value });
      while (entries.size > capacity) entries.delete(entries.keys().next().value as string);
    },
    evict(key) {
      return entries.delete(cacheKey(key));
    },
    clear() {
      entries.clear();
    },
  };
}
