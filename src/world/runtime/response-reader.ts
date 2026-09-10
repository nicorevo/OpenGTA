import { GeoDataSourceError } from "./source-error.ts";

export const DEFAULT_RESPONSE_BYTES = 8 * 1024 * 1024;

export async function readBoundedJson(response: { readonly body: ReadableStream<Uint8Array> | null; readonly status: number }, signal: AbortSignal, maxBytes = DEFAULT_RESPONSE_BYTES): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError("Invalid response byte budget");
  if (!response.body) throw new GeoDataSourceError("invalid-response", "OSM response has no readable body", response.status);
  const reader = response.body.getReader();
  let rejectAbort!: (error: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(new GeoDataSourceError("aborted", "Geo response read aborted", response.status));
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  let complete = false;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0; let text = "";
    while (true) {
      const part = await Promise.race([reader.read(), aborted]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new GeoDataSourceError("response-too-large", "OSM response exceeds byte budget", response.status);
      text += decoder.decode(part.value, { stream: true });
    }
    if (signal.aborted) throw new GeoDataSourceError("aborted", "Geo response read aborted", response.status);
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    complete = true;
    return value;
  } catch (cause) {
    if (cause instanceof GeoDataSourceError) throw cause;
    throw new GeoDataSourceError("invalid-response", "OSM response could not be decoded", response.status, cause);
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
