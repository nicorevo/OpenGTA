/**
 * Error surface of the internal MVT decoder.
 *
 * Categories follow the migration document (sections 50-51): a resource budget
 * that is exceeded is `response-too-large`, a tile that does not respect the
 * MVT/protobuf structure is `invalid-tile`, and a cancellation is `aborted`.
 * All three are recoverable: the caller degrades the session, it never crashes.
 */
export type TileSourceErrorCode = "response-too-large" | "invalid-tile" | "aborted" | "network" | "http" | "timeout";

export class TileSourceError extends Error {
  readonly code: TileSourceErrorCode;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;
  constructor(code: TileSourceErrorCode, message: string, options?: { cause?: unknown; status?: number; retryAfterMs?: number }) {
    super(message, { cause: options?.cause });
    this.name = "TileSourceError";
    this.code = code;
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }
}
