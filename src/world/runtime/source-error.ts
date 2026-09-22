export type GeoDataErrorCode = "invalid-request" | "http" | "network" | "provider-error" | "invalid-response" | "timeout" | "aborted" | "queue-full" | "queue-timeout" | "response-too-large" | "load-error";

export class GeoDataSourceError extends Error {
  readonly code: GeoDataErrorCode;
  readonly status?: number;
  readonly retryAt?: number;

  constructor(code: GeoDataErrorCode, message: string, status?: number, cause?: unknown, retryAt?: number) {
    super(message, { cause });
    this.name = "GeoDataSourceError";
    this.code = code;
    this.status = status;
    this.retryAt = retryAt;
  }
}
