import type { ChunkKey } from "./grid.ts";

export type ChunkState = "ABSENT" | "REQUESTED" | "COMPILING" | "READY" | "ACTIVE" | "INACTIVE";

export interface ChunkRecord<T> {
  readonly key: ChunkKey;
  readonly id: string;
  readonly state: ChunkState;
  readonly value?: T;
  readonly error?: unknown;
}

export interface ChunkLoadOptions { readonly priority?: 0 | 1 | 2 }
export interface ChunkLoadContext extends ChunkLoadOptions { readonly signal: AbortSignal }
export type ChunkLoader<T> = (key: ChunkKey, context: ChunkLoadContext) => Promise<T>;

export interface ChunkLifecycle<T> {
  load(key: ChunkKey, options?: ChunkLoadOptions): Promise<ChunkRecord<T>>;
  reload(key: ChunkKey, options?: ChunkLoadOptions): Promise<ChunkRecord<T>>;
  cancel(key: ChunkKey): void;
  release(key: ChunkKey): void;
  dispose(): void;
  activate(key: ChunkKey): void;
  deactivate(key: ChunkKey): void;
  get(key: ChunkKey): Readonly<ChunkRecord<T>> | undefined;
  records(): readonly ChunkRecord<T>[];
}

interface Entry<T> {
  record: ChunkRecord<T>;
  generation: number;
  inFlight?: Promise<ChunkRecord<T>>;
  controllers: Set<AbortController>;
}

function idForKey(key: ChunkKey): string {
  if (!Number.isInteger(key.x) || !Number.isInteger(key.y)) throw new Error("chunk key must contain integers");
  return `chunk:${key.x}:${key.y}`;
}

function copyKey(key: ChunkKey): ChunkKey {
  return { x: key.x, y: key.y };
}

export function createChunkLifecycle<T>(loader: ChunkLoader<T>): ChunkLifecycle<T> {
  const entries = new Map<string, Entry<T>>();
  let disposed = false;
  const cancel = (key: ChunkKey): void => {
    for (const controller of entries.get(idForKey(key))?.controllers ?? []) controller.abort();
  };

  const getEntry = (key: ChunkKey): Entry<T> | undefined => entries.get(idForKey(key));
  const setRecord = (entry: Entry<T>, state: ChunkState, value?: T, error?: unknown): void => {
    entry.record = { ...entry.record, state, value, error };
  };

  const start = (key: ChunkKey, force: boolean, options: ChunkLoadOptions = {}): Promise<ChunkRecord<T>> => {
    if (disposed) return Promise.reject(new Error("Chunk lifecycle disposed"));
    const id = idForKey(key);
    const existing = entries.get(id);
    if (existing && !force && (existing.inFlight || existing.record.state !== "ABSENT")) {
      return existing.inFlight ?? Promise.resolve(existing.record);
    }

    const entry: Entry<T> = existing ?? {
      record: { key: copyKey(key), id, state: "ABSENT" },
      generation: 0,
      controllers: new Set(),
    };
    entry.generation += 1;
    const generation = entry.generation;
    const previousState = entry.record.state;
    const previousValue = entry.record.value;
    const canRestore = previousState === "ACTIVE" || previousState === "READY" || previousState === "INACTIVE";
    setRecord(entry, "REQUESTED", previousValue, undefined);
    entries.set(id, entry);
    const controller = new AbortController();
    entry.controllers.add(controller);
    const current = () => entries.get(id) === entry && entry.generation === generation;
    let onAbort!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => {
        if (current()) setRecord(entry, canRestore ? previousState : "ABSENT", previousValue);
        reject(new DOMException("Chunk load aborted", "AbortError"));
      };
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });

    const work = Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        if (current()) setRecord(entry, "COMPILING", previousValue, undefined);
        return loader(copyKey(key), { signal: controller.signal, priority: options.priority });
      })
      .then((value) => {
        if (!current() || controller.signal.aborted) return entry.record;
        setRecord(entry, canRestore ? previousState : "READY", value, undefined);
        return entry.record;
      })
      .catch((error: unknown) => {
        if (!current() || controller.signal.aborted) return entry.record;
        setRecord(entry, canRestore ? previousState : "ABSENT", previousValue, error);
        throw error;
      });
    const request = Promise.race([work, aborted]).finally(() => {
      controller.signal.removeEventListener("abort", onAbort);
      entry.controllers.delete(controller);
    });
    entry.inFlight = request;
    request.then(() => {
      if (entry.generation === generation) entry.inFlight = undefined;
    }, () => {
      if (entry.generation === generation) entry.inFlight = undefined;
    });
    return request;
  };

  return {
    load(key, options) {
      return start(key, false, options);
    },
    reload(key, options) {
      return start(key, true, options);
    },
    cancel,
    release(key) { cancel(key); entries.delete(idForKey(key)); },
    dispose() {
      disposed = true;
      for (const entry of entries.values()) cancel(entry.record.key);
      entries.clear();
    },
    activate(key) {
      const entry = getEntry(key);
      if (!entry || (entry.record.state !== "READY" && entry.record.state !== "ACTIVE" && entry.record.state !== "INACTIVE")) {
        throw new Error(`chunk ${idForKey(key)} is not ready`);
      }
      setRecord(entry, "ACTIVE", entry.record.value, undefined);
    },
    deactivate(key) {
      const entry = getEntry(key);
      if (!entry || entry.record.state !== "ACTIVE") throw new Error(`chunk ${idForKey(key)} is not active`);
      setRecord(entry, "INACTIVE", entry.record.value, undefined);
    },
    get(key) {
      return getEntry(key)?.record;
    },
    records() {
      return [...entries.values()].map((entry) => entry.record);
    },
  };
}
