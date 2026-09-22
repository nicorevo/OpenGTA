import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Service-level persisted value cache (VPS-10, spec 54 levels 2-3). The core
 * caches (VPS-04) are in-memory and revision-keyed; this is the service
 * wrapper that persists them to disk with a TTL, so a restart does not
 * re-fetch and re-analyze an unchanged cell. One JSON file per key
 * ({expiresAt, value}); writes are atomic (tmp + rename). Synchronous by
 * design: the entries are small and this keeps the pipeline cache interface
 * (EvidenceCache/ProfileCache) intact.
 */
export interface FileValueCache {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  clear(): void;
  /** Absolute file path for a key (debugging and tests). */
  fileFor(key: string): string;
  readonly size: number;
}

export interface FileValueCacheOptions {
  readonly dir: string;
  /** Entries older than this are treated as misses (and re-stored). */
  readonly ttlMs: number;
  /** Injectable clock (tests); defaults to Date.now. */
  readonly now?: () => number;
}

interface StoredEntry {
  readonly expiresAt: number;
  readonly value: unknown;
}

export function createFileValueCache(options: FileValueCacheOptions): FileValueCache {
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) {
    throw new RangeError(`ttlMs must be a positive finite number, got ${options.ttlMs}`);
  }
  const now = options.now ?? Date.now;
  const dir = options.dir;
  mkdirSync(dir, { recursive: true });

  const fileFor = (key: string): string =>
    join(dir, `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`);

  const read = (key: string): StoredEntry | undefined => {
    const file = fileFor(key);
    if (!existsSync(file)) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8")) as StoredEntry;
    } catch {
      return undefined; // corrupt file: treat as a miss, never crash the service
    }
    const entry = parsed as StoredEntry;
    if (typeof entry?.expiresAt !== "number") return undefined;
    if (now() >= entry.expiresAt) return undefined;
    return entry;
  };

  return {
    get<T>(key: string): T | undefined {
      return read(key)?.value as T | undefined;
    },
    set(key, value) {
      const file = fileFor(key);
      const entry: StoredEntry = { expiresAt: now() + options.ttlMs, value };
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(entry));
      renameSync(tmp, file);
    },
    has(key) {
      return read(key) !== undefined;
    },
    clear() {
      for (const name of readdirSync(dir)) {
        if (name.endsWith(".json")) {
          unlinkSync(join(dir, name));
        }
      }
    },
    fileFor,
    get size() {
      return readdirSync(dir).filter((name) => name.endsWith(".json")).length;
    },
  };
}
