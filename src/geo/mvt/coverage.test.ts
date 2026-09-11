import { expect, it } from "vitest";
import { tilesForBounds } from "./coverage.ts";

const lecce = { minLatitude: 40.3518, minLongitude: 18.1712, maxLatitude: 40.3545, maxLongitude: 18.174 };

it("covers the Lecce 300 m bounds at z14 with the expected tiles", () => {
  // The 300 m box around Piazza Sant'Oronzo straddles the x=9018/9019 edge.
  const tiles = tilesForBounds(lecce, 14);
  expect(tiles).toHaveLength(2);
  expect(tiles).toContainEqual({ z: 14, x: 9018, y: 6181 });
  expect(tiles).toContainEqual({ z: 14, x: 9019, y: 6181 });
});

it("covers a bounds crossing tile edges with every intersecting tile", () => {
  const wide = { ...lecce, maxLongitude: 18.19 };
  const tiles = tilesForBounds(wide, 14);
  expect(tiles).toContainEqual({ z: 14, x: 9018, y: 6181 });
  expect(tiles).toContainEqual({ z: 14, x: 9019, y: 6181 });
  expect(tiles).toContainEqual({ z: 14, x: 9020, y: 6181 });
  expect(new Set(tiles.map((tile) => `${tile.x}/${tile.y}`)).size).toBe(tiles.length);
});

it("clamps polar latitudes to the Web Mercator range", () => {
  const polar = { minLatitude: -89, minLongitude: -180, maxLatitude: 89, maxLongitude: 180 };
  const tiles = tilesForBounds(polar, 1);
  expect(tiles.length).toBe(4);
  expect(tiles.every((tile) => tile.z === 1 && tile.x >= 0 && tile.x < 2 && tile.y >= 0 && tile.y < 2)).toBe(true);
});

it("rejects non-finite bounds", () => {
  expect(() => tilesForBounds({ ...lecce, minLatitude: Number.NaN }, 14)).toThrow(/finite/);
});
