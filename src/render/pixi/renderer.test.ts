import { Graphics, Point } from "pixi.js";
import { describe, expect, it } from "vitest";
import { drawPolygon } from "./renderer.ts";

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
