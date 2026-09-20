import { Point, Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createTaxiSprite } from "./taxi.ts";

describe("taxi reference sprite", () => {
  const texture = () => new Texture({ source: new TextureSource({ width: 192, height: 93 }) });

  it("preserves the reference proportions inside the vehicle footprint", () => {
    const sprite = createTaxiSprite(texture(), 12.6, 5.4);
    expect(sprite.width / sprite.height).toBeCloseTo(192 / 93);
    expect(sprite.width).toBeLessThanOrEqual(12.6);
    expect(sprite.height).toBeCloseTo(5.4);
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.anchor.y).toBe(0.5);
  });

  it("points the reference hood toward the positive x driving direction", () => {
    const sprite = createTaxiSprite(texture(), 12.6, 5.4);
    const front = sprite.toGlobal(new Point(-96, 0));
    const rear = sprite.toGlobal(new Point(96, 0));
    expect(front.x).toBeGreaterThan(0);
    expect(rear.x).toBeLessThan(0);
    expect(front.y).toBeCloseTo(0);
  });
});
