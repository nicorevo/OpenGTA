import { expect, it, vi } from "vitest";
import { readBoundedJson } from "./response-reader.ts";

it.each([undefined, "1", "999999"])("bounds actual UTF-8 bytes with Content-Length %s", async (length) => {
  const bytes = new TextEncoder().encode(JSON.stringify({ value: "\u00e8".repeat(20) }));
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 20)); c.enqueue(bytes.slice(20)); }, cancel() { cancelled = true; } }), { headers: length ? { "content-length": length } : {} });
  const parse = vi.spyOn(JSON, "parse");
  await expect(readBoundedJson(response, new AbortController().signal, bytes.length - 1)).rejects.toMatchObject({ code: "response-too-large" });
  const parsedPayload = parse.mock.calls.some(([text]) => text === new TextDecoder().decode(bytes));
  parse.mockRestore();
  expect(parsedPayload).toBe(false);
  expect(cancelled).toBe(true);
});

it("accepts an exact byte budget and rejects invalid or missing streams", async () => {
  const body = '{"elements":[]}';
  await expect(readBoundedJson(new Response(body), new AbortController().signal, body.length)).resolves.toEqual({ elements: [] });
  for (const text of ["", "not JSON"]) await expect(readBoundedJson(new Response(text), new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
  await expect(readBoundedJson(new Response(null), new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
});

it("cancels a pending reader on abort and releases the lock", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const controller = new AbortController();
  const work = readBoundedJson(response, controller.signal).catch((e) => e);
  controller.abort();
  expect(await work).toMatchObject({ code: "aborted" });
  expect(cancelled).toBe(true); expect(response.body?.locked).toBe(false);
});

it("reports a failing stream as invalid-response and releases the reader", async () => {
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode('{"half')); controller.error(new Error("stream broken")); },
  }));
  // An errored stream rejects reader.cancel() by spec without invoking the
  // underlying cancel: the stream already released itself.
  await expect(readBoundedJson(response, new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
  expect(response.body?.locked).toBe(false);
});

it("validates the byte budget before reading", async () => {
  for (const budget of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expect(readBoundedJson(new Response('{"elements":[]}'), new AbortController().signal, budget)).rejects.toThrow(RangeError);
  }
});
