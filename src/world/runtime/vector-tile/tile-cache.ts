import { TileSourceError } from "../../../geo/mvt/errors.ts";

interface InFlight<T> { readonly status: "inflight"; readonly promise: Promise<T> }
interface Cached<T> { readonly status: "done"; readonly value: T }
type Entry<T> = InFlight<T> | Cached<T>;

function abortError(): TileSourceError {
  return new TileSourceError("aborted", "tile fetch aborted");
}

/**
 * Resolves with the shared promise result, or rejects immediately with an
 * abort error when this consumer's signal aborts. The shared work keeps
 * running for the other consumers: an abort never cancels a shared fetch.
 */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
  });
}

/**
 * In-flight dedup + LRU cache for decoded tiles. Concurrent demands for the
 * same key share a single produce (one fetch, one decode); completed values
 * are served until evicted. LRU order follows store time; failed produces are
 * removed, so the next demand retries the fetch instead of caching an error.
 * In-flight entries are never evicted: capacity only bounds completed values.
 */
export class TileCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new RangeError("Invalid tile cache capacity");
  }

  get size(): number { return this.entries.size; }

  get(key: string, signal: AbortSignal, produce: () => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(abortError());
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.status === "done") {
        this.entries.delete(key); this.entries.set(key, existing);
        return Promise.resolve(existing.value);
      }
      return raceAbort(existing.promise, signal);
    }
    const promise = this.fetchAndStore(key, produce);
    this.entries.set(key, { status: "inflight", promise });
    return raceAbort(promise, signal);
  }

  private async fetchAndStore(key: string, produce: () => Promise<T>): Promise<T> {
    try {
      const value = await produce();
      this.makeRoom();
      this.entries.delete(key);
      this.entries.set(key, { status: "done", value });
      return value;
    } catch (error) {
      this.entries.delete(key);
      throw error;
    }
  }

  private makeRoom(): void {
    while (this.entries.size >= this.capacity) {
      const oldestDone = [...this.entries.entries()].find(([, entry]) => entry.status === "done");
      if (!oldestDone) return;
      this.entries.delete(oldestDone[0]);
    }
  }
}
