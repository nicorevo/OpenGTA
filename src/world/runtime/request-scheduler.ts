import { GeoDataSourceError } from "./source-error.ts";

export interface AcquireOptions { readonly signal?: AbortSignal; readonly priority?: 0 | 1 | 2 }
export interface SchedulerOptions {
  readonly timeoutMs?: number;
  readonly minIntervalMs?: number;
  readonly maxQueued?: number;
  readonly queueTimeoutMs?: number;
  readonly now?: () => number;
}
export interface AttemptContext {
  readonly signal: AbortSignal;
  readonly deadline: number;
  attempt(): Promise<void>;
  deferUntil(timestamp: number): void;
}

export function createRequestScheduler(options: SchedulerOptions = {}) {
  const timeout = options.timeoutMs ?? 15_000;
  const interval = options.minIntervalMs ?? 0;
  const maxQueued = options.maxQueued ?? 32;
  const queueTimeout = options.queueTimeoutMs ?? 120_000;
  const now = options.now ?? Date.now;
  if (![timeout, queueTimeout].every((n) => Number.isFinite(n) && n > 0) || !Number.isFinite(interval) || interval < 0 || !Number.isInteger(maxQueued) || maxQueued < 1) throw new RangeError("Invalid source scheduler limits");
  interface Job { priority: number; readonly order: number; readonly signal?: AbortSignal; start(): Promise<void>; cancel(error: GeoDataSourceError): void }
  const queue: Job[] = [];
  let active = false;
  let sequence = 0;
  let nextStart = -Infinity;
  let admissionTimer: ReturnType<typeof setTimeout> | undefined;
  const pump = () => {
    if (active || !queue.length) return;
    if (nextStart > now()) {
      if (admissionTimer === undefined) admissionTimer = setTimeout(() => { admissionTimer = undefined; pump(); }, nextStart - now());
      return;
    }
    queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
    const job = queue.shift()!;
    active = true;
    void job.start().finally(() => { active = false; pump(); });
  };
  return {
    promote(signal: AbortSignal, priority: 0 | 1 | 2) {
      for (const job of queue) if (job.signal === signal) job.priority = Math.min(job.priority, priority);
    },
    run<T>(task: (context: AttemptContext) => Promise<T>, input: AcquireOptions = {}): Promise<T> {
      if (input.signal?.aborted) return Promise.reject(new GeoDataSourceError("aborted", "Geo request aborted"));
      if (![0, 1, 2].includes(input.priority ?? 2)) return Promise.reject(new GeoDataSourceError("invalid-request", "Invalid request priority"));
      if (queue.length >= maxQueued) return Promise.reject(new GeoDataSourceError("queue-full", "Geo request queue is full"));
      return new Promise<T>((resolve, reject) => {
        const controller = new AbortController();
        let finished = false;
        let deadline = Infinity;
        let activeTimer: ReturnType<typeof setTimeout> | undefined;
        let waitTimer: ReturnType<typeof setTimeout> | undefined;
        let wake: (() => void) | undefined;
        let rejectAborted!: (error: unknown) => void;
        const aborted = new Promise<never>((_, fail) => { rejectAborted = fail; });
        // Queued jobs can abort before start() attaches the race.
        void aborted.catch(() => {});
        const cleanup = () => {
          clearTimeout(queueTimer); clearTimeout(activeTimer); clearTimeout(waitTimer);
          input.signal?.removeEventListener("abort", onAbort);
        };
        const finish = (value: T | undefined, error?: unknown, failed = false) => {
          if (finished) return;
          finished = true; cleanup();
          if (failed) reject(error); else resolve(value as T);
        };
        const cancel = (error: GeoDataSourceError) => {
          if (finished) return;
          const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1);
          if (!queue.length) { clearTimeout(admissionTimer); admissionTimer = undefined; }
          controller.abort(error); rejectAborted(error); wake?.(); finish(undefined, error, true);
        };
        const onAbort = () => cancel(new GeoDataSourceError("aborted", "Geo request aborted"));
        const context: AttemptContext = {
          signal: controller.signal,
          get deadline() { return deadline; },
          deferUntil(timestamp) { nextStart = Math.max(nextStart, timestamp); },
          async attempt() {
            controller.signal.throwIfAborted();
            const wait = Math.max(0, nextStart - now());
            if (now() + wait >= deadline) throw new GeoDataSourceError("timeout", "geo data source request timed out");
            if (wait > 0) await new Promise<void>((done) => { wake = done; waitTimer = setTimeout(done, wait); });
            wake = undefined;
            controller.signal.throwIfAborted();
            if (deadline === Infinity) {
              clearTimeout(queueTimer);
              deadline = now() + timeout;
              activeTimer = setTimeout(() => cancel(new GeoDataSourceError("timeout", "geo data source request timed out")), timeout);
            }
            if (now() >= deadline) throw new GeoDataSourceError("timeout", "geo data source request timed out");
            nextStart = now() + interval;
          },
        };
        const job: Job = {
          priority: input.priority ?? 2, order: sequence++, signal: input.signal, cancel,
          async start() {
            try {
              const value = await Promise.race([(async () => { await context.attempt(); controller.signal.throwIfAborted(); return task(context); })(), aborted]);
              finish(value);
            } catch (error) { finish(undefined, error, true); }
            finally { controller.abort(); }
          },
        };
        const queueTimer = setTimeout(() => cancel(new GeoDataSourceError("queue-timeout", "Geo queue wait timed out")), queueTimeout);
        input.signal?.addEventListener("abort", onAbort, { once: true });
        queue.push(job); pump();
      });
    },
  };
}
