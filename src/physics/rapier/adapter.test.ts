import { describe, expect, it } from "vitest";
import { createPhysicsAdapter } from "./adapter.ts";

describe("Rapier vehicle integration", () => {
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
