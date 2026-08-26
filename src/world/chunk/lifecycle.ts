import type { ChunkKey } from "./grid.ts";

export type ChunkState = "ABSENT" | "REQUESTED" | "COMPILING" | "READY" | "ACTIVE" | "INACTIVE";

export interface ChunkRecord<T> {
  readonly key: ChunkKey;
  readonly id: string;
  readonly state: ChunkState;
  readonly value?: T;
  readonly error?: unknown;
}

export type ChunkLoader<T> = (key: ChunkKey) => Promise<T>;

export interface ChunkLifecycle<T> {
  load(key: ChunkKey): Promise<ChunkRecord<T>>;
  reload(key: ChunkKey): Promise<ChunkRecord<T>>;
  activate(key: ChunkKey): void;
  deactivate(key: ChunkKey): void;
  get(key: ChunkKey): Readonly<ChunkRecord<T>> | undefined;
  records(): readonly ChunkRecord<T>[];
}

interface Entry<T> {
  record: ChunkRecord<T>;
  generation: number;
  inFlight?: Promise<ChunkRecord<T>>;
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

  const getEntry = (key: ChunkKey): Entry<T> | undefined => entries.get(idForKey(key));
  const setRecord = (entry: Entry<T>, state: ChunkState, value?: T, error?: unknown): void => {
    entry.record = { ...entry.record, state, value, error };
  };

  const start = (key: ChunkKey, force: boolean): Promise<ChunkRecord<T>> => {
    const id = idForKey(key);
    const existing = entries.get(id);
    if (existing && !force && (existing.inFlight || existing.record.state !== "ABSENT")) {
      return existing.inFlight ?? Promise.resolve(existing.record);
    }

    const entry: Entry<T> = existing ?? {
      record: { key: copyKey(key), id, state: "ABSENT" },
      generation: 0,
    };
    entry.generation += 1;
    const generation = entry.generation;
    const previousState = entry.record.state;
    const previousValue = entry.record.value;
    const canRestore = previousState === "ACTIVE" || previousState === "READY" || previousState === "INACTIVE";
    setRecord(entry, "COMPILING", previousValue, undefined);
    entries.set(id, entry);

    let loaded: Promise<T>;
    try {
      loaded = loader(copyKey(key));
    } catch (error: unknown) {
      loaded = Promise.reject(error);
    }
    const request = Promise.resolve(loaded)
      .then((value) => {
        if (entry.generation !== generation) return entry.record;
        setRecord(entry, canRestore ? previousState : "READY", value, undefined);
        return entry.record;
      })
      .catch((error: unknown) => {
        if (entry.generation !== generation) return entry.record;
        setRecord(entry, canRestore ? previousState : "ABSENT", previousValue, error);
        throw error;
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
    load(key) {
      return start(key, false);
    },
    reload(key) {
      return start(key, true);
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
