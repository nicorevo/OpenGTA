/**
 * Error surface of the internal MVT decoder.
 *
 * Categories follow the migration document (sections 50-51): a resource budget
 * that is exceeded is `response-too-large`, a tile that does not respect the
 * MVT/protobuf structure is `invalid-tile`, and a cancellation is `aborted`.
 * All three are recoverable: the caller degrades the session, it never crashes.
 */
export type TileSourceErrorCode = "response-too-large" | "invalid-tile" | "aborted";

export class TileSourceError extends Error {
  constructor(readonly code: TileSourceErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "TileSourceError";
  }
}
