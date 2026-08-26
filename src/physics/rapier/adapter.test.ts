import { describe, expect, it } from "vitest";
import { createPhysicsAdapter } from "./adapter.ts";

describe("Rapier vehicle integration", () => {
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
