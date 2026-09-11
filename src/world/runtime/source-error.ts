export type GeoDataErrorCode = "invalid-request" | "http" | "network" | "provider-error" | "invalid-response" | "timeout" | "aborted" | "queue-full" | "queue-timeout" | "response-too-large" | "load-error";

export class GeoDataSourceError extends Error {
  constructor(readonly code: GeoDataErrorCode, message: string, readonly status?: number, cause?: unknown, readonly retryAt?: number) {
    super(message, { cause });
    this.name = "GeoDataSourceError";
  }
}
