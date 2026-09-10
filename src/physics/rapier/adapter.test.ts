import { describe, expect, it } from "vitest";
import { createChunkGrid } from "../../world/chunk/grid.ts";
import { isPoseAvailable } from "../../world/chunk/availability.ts";
import { createPhysicsAdapter } from "./adapter.ts";

describe("Rapier vehicle integration", () => {
  it("contains every physical step and permits reverse and recovery", async () => {
    const physics = await createPhysicsAdapter([]);
    let state = physics.createVehicle({ x: 296, y: 40, heading: 0 });
    let edge = 297.75;
    const guard = (pose: { position: { x: number } }) => pose.position.x <= edge;
    for (let i = 0; i < 300; i++) {
      state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 }, guard);
      expect(state.position.x).toBeLessThanOrEqual(edge);
    }
    expect(state.blockedByAvailability).toBe(true);
    const stopped = state.position.x;
    for (let i = 0; i < 60; i++) state = physics.stepVehicle(state, { throttle: -1, steer: 0, brake: 0 }, guard);
    expect(state.position.x).toBeLessThan(stopped);
    edge = 600;
    for (let i = 0; i < 300; i++) state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 }, guard);
    expect(state.position.x).toBeGreaterThan(300);
    physics.dispose();
  });

  it("confines a diagonal push into a corner to the applied cell", async () => {
    const physics = await createPhysicsAdapter([]);
    const grid = createChunkGrid(300);
    const active = [{ x: 0, y: 0 }];
    let state = physics.createVehicle({ x: 292, y: 292, heading: Math.PI / 4 });
    for (let i = 0; i < 300; i++) {
      state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 }, (pose) => isPoseAvailable(grid, pose, active));
      expect(isPoseAvailable(grid, state, active)).toBe(true);
    }
    expect(state.blockedByAvailability).toBe(true);
    expect(state.position.x).toBeGreaterThan(292);
    expect(state.position.x).toBeLessThan(297.9);
    expect(state.position.y).toBeLessThan(297.9);
    const stopped = state.position;
    for (let i = 0; i < 60; i++) state = physics.stepVehicle(state, { throttle: -1, steer: 0, brake: 0 }, (pose) => isPoseAvailable(grid, pose, active));
    expect(Math.hypot(state.position.x - stopped.x, state.position.y - stopped.y)).toBeGreaterThan(0.1);
    physics.dispose();
  });

  it("restores the previous valid pose if Rapier pushes it outside after a collision", async () => {
    const physics = await createPhysicsAdapter([{ kind: "segment", featureId: "wall", a: { x: 0, y: -10 }, b: { x: 0, y: 10 } }]);
    const initial = physics.createVehicle({ x: 1.9, y: 0, heading: 0 });
    let checks = 0;
    const next = physics.stepVehicle(initial, { throttle: 0, steer: 0, brake: 0 }, (pose) => { checks++; return pose.position.x <= 1.95; });
    expect(checks).toBeGreaterThanOrEqual(2);
    expect(next.position.x).toBeLessThanOrEqual(1.95);
    expect(next.body.translation().x).toBeLessThanOrEqual(1.95);
    physics.dispose();
  });
  it("updates static chunks without replacing the vehicle and removes shared feature fragments independently", async () => {
    const physics = await createPhysicsAdapter([]);
    const vehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 });
    const wall = (x: number) => [{ kind: "segment" as const, featureId: "shared", a: { x, y: -10 }, b: { x, y: 10 } }];
    const a = wall(10); const b = wall(20);
    physics.setChunk("a", a); physics.setChunk("b", b); physics.setChunk("b", b);
    expect(physics.colliderCount()).toBe(3);
    expect(physics.isPoseFree({ position: { x: 10, y: 0 }, heading: 0 })).toBe(false);
    expect(physics.isPoseFree(vehicle)).toBe(true);
    physics.removeChunk("a"); physics.removeChunk("a");
    expect(physics.colliderCount()).toBe(2);
    expect(physics.isPoseFree({ position: { x: 10, y: 0 }, heading: 1 })).toBe(true);
    physics.setChunk("b", wall(30));
    expect(physics.colliderCount()).toBe(2);
    expect(physics.world.getRigidBody(vehicle.body.handle)).toBe(vehicle.body);
    expect(vehicle.body.translation()).toMatchObject({ x: 0, y: 0 });
    expect(() => physics.setChunk("b", [{ kind: "circle", featureId: "bad", center: { x: NaN, y: 0 }, radiusMeters: 1 }])).toThrow();
    expect(physics.colliderCount()).toBe(2);
    expect(physics.isPoseFree({ position: { x: 30, y: 0 }, heading: 0 })).toBe(false);
    physics.dispose(); physics.dispose();
    expect(physics.colliderCount()).toBe(0);
  });
  it("keeps a dynamic vehicle outside a static wall", async () => {
    const physics = await createPhysicsAdapter([{
      kind: "polygon",
      featureId: "wall",
      polygon: { outer: [{ x: 2, y: -5 }, { x: 3, y: -5 }, { x: 3, y: 5 }, { x: 2, y: 5 }], holes: [] },
    }]);
    let state = physics.createVehicle({ x: 0, y: 0, heading: 0 });
    for (let i = 0; i < 120; i += 1) state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
    expect(state.position.x).toBeLessThan(2);
  });

  it("lets the vehicle drive into the open notch of a concave building", async () => {
    const physics = await createPhysicsAdapter([{
      kind: "polygon",
      featureId: "courtyard-block",
      polygon: {
        outer: [
          { x: 2, y: -6 }, { x: 10, y: -6 }, { x: 10, y: 6 }, { x: 2, y: 6 },
          { x: 2, y: 3 }, { x: 8, y: 3 }, { x: 8, y: -3 }, { x: 2, y: -3 },
        ],
        holes: [],
      },
    }]);
    let state = physics.createVehicle({ x: 0, y: 0, heading: 0 });
    for (let i = 0; i < 90; i += 1) state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
    expect(state.position.x).toBeGreaterThan(3);
    expect(state.position.x).toBeLessThan(8);
  });

  it("creates walls for both the outer and courtyard rings", async () => {
    const physics = await createPhysicsAdapter([{
      kind: "polygon",
      featureId: "courtyard",
      polygon: {
        outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
        holes: [[{ x: 2, y: 2 }, { x: 2, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 2 }]],
      },
    }]);

    expect(physics.colliderCount()).toBe(2);
  });

  it("instantiates segment collision shapes", async () => {
    const physics = await createPhysicsAdapter([{
      kind: "segment",
      featureId: "fence",
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
    }]);

    expect(physics.colliderCount()).toBe(1);
  });
});
