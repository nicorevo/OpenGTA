import { TileSourceError } from "../../../geo/mvt/errors.ts";

function abortError(): TileSourceError {
  return new TileSourceError("aborted", "tile fetch aborted");
}

/**
 * FIFO admission gate: at most `maxConcurrent` works run at the same time;
 * the excess queues and is admitted in request order. Admission is synchronous
 * so concurrent callers cannot all slip past the gate before any slot is
 * claimed. A waiter that aborts while queued is rejected and leaves the queue,
 * so it never holds a slot.
 */
export class FetchLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(readonly maxConcurrent: number) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent <= 0) throw new RangeError("Invalid fetch concurrency limit");
  }

  get activeCount(): number { return this.active; }

  run<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(abortError());
    if (this.active < this.maxConcurrent) return this.start(work);
    return this.waitForSlot(signal).then(() => this.start(work));
  }

  private start<T>(work: () => Promise<T>): Promise<T> {
    this.active += 1;
    return work().finally(() => {
      this.active -= 1;
      const wake = this.waiters.shift();
      if (wake) wake();
    });
  }

  private waitForSlot(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (as: "resolve" | "reject") => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        if (as === "resolve") resolve(); else reject(abortError());
      };
      const wake = () => settle("resolve");
      const onAbort = () => {
        const index = this.waiters.indexOf(wake);
        if (index >= 0) this.waiters.splice(index, 1);
        settle("reject");
      };
      signal.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(wake);
    });
  }
}
