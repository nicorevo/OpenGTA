import { Graphics, Point } from "pixi.js";
import { describe, expect, it } from "vitest";
import { drawF1Vehicle, drawPolygon } from "./renderer.ts";

describe("Pixi polygon rendering", () => {
  it("keeps canonical holes transparent", () => {
    const graphics = new Graphics();

    drawPolygon(graphics, {
      outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      holes: [[{ x: 2, y: 2 }, { x: 2, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 2 }]],
    }, 1, 0, 0xffffff);

    expect(graphics.containsPoint(new Point(1, -1))).toBe(true);
    expect(graphics.containsPoint(new Point(5, -5))).toBe(false);
  });
});

describe("F1 vehicle rendering", () => {
  const L = 10;
  const W = 4.5;
  const car = () => { const g = new Graphics(); drawF1Vehicle(g, L, W); return g; };

  it("fills the cockpit, front/rear wings and all four wheels", () => {
    const g = car();
    expect(g.containsPoint(new Point(0, 0))).toBe(true);        // cockpit / body center
    expect(g.containsPoint(new Point(L * 0.45, 0))).toBe(true); // front wing
    expect(g.containsPoint(new Point(-L * 0.45, 0))).toBe(true); // rear wing
    expect(g.containsPoint(new Point(L * 0.24, W * 0.47))).toBe(true);   // front wheel
    expect(g.containsPoint(new Point(-L * 0.33, -W * 0.47))).toBe(true); // rear wheel
  });

  it("stays within the vehicle footprint", () => {
    const g = car();
    expect(g.containsPoint(new Point(L / 2 + 1, 0))).toBe(false);  // beyond the nose
    expect(g.containsPoint(new Point(0, W / 2 + 1))).toBe(false);  // beyond the side
    expect(g.containsPoint(new Point(20, 20))).toBe(false);        // far outside
  });
});
