import { expect, it } from "vitest";
import { createRuntimeSession } from "./runtime-session.ts";
import { createPhysicsAdapter } from "../physics/rapier/adapter.ts";
import { createGeoDataSource } from "../world/runtime/source.ts";
import { liveWorld, liveOrigin } from "../../tests/fixtures/live-world.ts";
import type { CompiledChunkV0 } from "../world/compiler/compiled.ts";

function renderer() {
  let chunks: readonly CompiledChunkV0[] = [];
  return { render(next: readonly CompiledChunkV0[]) { chunks = next; }, cameraBounds: () => ({ minX: -200, maxX: 200, minY: -100, maxY: 100 }), updateVehicle() {}, dispose() { chunks = []; }, chunks: () => chunks };
}

it("starts before the window finishes and disposes a pending source", async () => {
  let calls = 0;
  const source = createGeoDataSource(async () => ++calls === 1 ? liveWorld : new Promise(() => {}));
  const physics = await createPhysicsAdapter([]);
  const scene = renderer();
  const session = createRuntimeSession({ source, origin: liveOrigin, renderer: scene, physics });
  const initial = session.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(session.snapshot().state).toBe("ready");
  const before = session.vehicle()!.position.x;
  session.step({ throttle: 1, steer: 0, brake: 0 });
  expect(session.vehicle()!.position.x).toBeGreaterThan(before);
  await session.dispose(); await initial;
  expect(scene.chunks()).toEqual([]);
  expect(physics.colliderCount()).toBe(0);
});

it("rolls physics back if the renderer rejects an application", async () => {
  const physics = await createPhysicsAdapter([]);
  const scene = renderer();
  scene.render = (chunks) => { if (chunks.length) throw new Error("render failed"); };
  const session = createRuntimeSession({ source: createGeoDataSource(async () => liveWorld), origin: liveOrigin, renderer: scene, physics });
  await session.start();
  expect(session.snapshot().state).toBe("error");
  expect(session.snapshot().runtime.active).toEqual([]);
  expect(physics.colliderCount()).toBe(0);
  await session.dispose();
});

it("distinguishes empty geography from source failure", async () => {
  for (const failure of [false, true]) {
    const physics = await createPhysicsAdapter([]);
    const source = createGeoDataSource(async () => { if (failure) throw new Error("offline"); return { elements: [] }; });
    const session = createRuntimeSession({ source, origin: liveOrigin, renderer: renderer(), physics });
    await session.start();
    expect(session.snapshot().state).toBe(failure ? "error" : "empty");
    expect(session.vehicle()).toBeUndefined();
    await session.dispose();
  }
});

it("streams across three borders and returns through the warm cache with bounded resources", async () => {
  let calls = 0;
  const physics = await createPhysicsAdapter([]);
  const scene = renderer();
  let position = { x: 0, y: 0 };
  scene.updateVehicle = (next?: { x: number; y: number }) => { if (next) position = next; };
  scene.cameraBounds = () => ({ minX: position.x - 200, maxX: position.x + 200, minY: position.y - 100, maxY: position.y + 100 });
  const session = createRuntimeSession({ source: createGeoDataSource(async () => { calls++; return liveWorld; }), origin: liveOrigin, renderer: scene, physics });
  await session.start();
  let now = 0;
  for (let step = 0; step < 2900; step++) {
    session.step({ throttle: 1, steer: 0, brake: 0 });
    now += 1000 / 60;
    await session.stream(now);
  }
  expect(session.vehicle()!.position.x).toBeGreaterThan(900);
  expect(session.snapshot().runtime.records).toBeLessThanOrEqual(9);
  expect(session.snapshot().runtime.cacheSize).toBeLessThanOrEqual(9);
  expect(calls).toBeGreaterThan(4);
  const requests = calls;
  for (let step = 0; step < 2100; step++) {
    session.step({ throttle: -1, steer: 0, brake: 0 });
    now += 1000 / 60; await session.stream(now);
  }
  expect(session.vehicle()!.position.x).toBeLessThan(900);
  expect(calls).toBe(requests);
  await session.dispose();
});

it("stops at a disconnected neighbor and resumes without resetting after explicit retry", async () => {
  let unavailable = true; let failures = 0;
  const physics = await createPhysicsAdapter([]);
  const scene = renderer(); let position = { x: 0, y: 0 };
  scene.updateVehicle = (next?: { x: number; y: number }) => { if (next) position = next; };
  scene.cameraBounds = () => ({ minX: position.x - 180, maxX: position.x + 180, minY: 0, maxY: 100 });
  const source = createGeoDataSource(async (request) => {
    if (unavailable && request.regionId.endsWith("chunk:1:0")) { failures++; throw new Error("disconnected"); }
    return liveWorld;
  });
  const session = createRuntimeSession({ source, origin: liveOrigin, renderer: scene, physics });
  await session.start();
  let now = 0;
  for (let i = 0; i < 1500; i++) { session.step({ throttle: 1, steer: 0, brake: 0 }); now += 1000 / 60; await session.stream(now); }
  expect(session.vehicle()!.position.x).toBeLessThanOrEqual(297.75);
  expect(session.snapshot()).toMatchObject({ state: "degraded", blocked: true });
  expect(failures).toBe(1);
  unavailable = false;
  const before = session.vehicle()!.position.x;
  await session.retryMissing();
  expect(session.vehicle()!.position.x).toBe(before);
  for (let i = 0; i < 600; i++) session.step({ throttle: 1, steer: 0, brake: 0 });
  expect(session.vehicle()!.position.x).toBeGreaterThan(400);
  await session.dispose();
});
