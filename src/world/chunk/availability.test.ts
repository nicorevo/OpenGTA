import { expect, it } from "vitest";
import { createChunkGrid } from "./grid.ts";
import { isPoseAvailable, keysForVehicle } from "./availability.ts";

it("requires all four origin cells for a rotated footprint", () => {
  const grid = createChunkGrid(300);
  const pose = { position: { x: 0, y: 0 }, heading: Math.PI / 4 };
  const keys = keysForVehicle(grid, pose);
  expect(keys).toHaveLength(4);
  expect(isPoseAvailable(grid, pose, keys.slice(1))).toBe(false);
  expect(isPoseAvailable(grid, pose, keys)).toBe(true);
});

it("detects an internal missing cell, not only missing corners", () => {
  const grid = createChunkGrid(1);
  const pose = { position: { x: -0.5, y: -0.5 }, heading: 0 };
  const keys = keysForVehicle(grid, pose);
  expect(isPoseAvailable(grid, pose, keys.filter((key) => key.x !== -1 || key.y !== -1))).toBe(false);
});

it("includes the conservative margin at the available edge", () => {
  const grid = createChunkGrid(300);
  const pose = { position: { x: 297.9, y: 50 }, heading: 0 };
  expect(isPoseAvailable(grid, pose, [{ x: 0, y: 0 }], 0)).toBe(true);
  expect(isPoseAvailable(grid, pose, [{ x: 0, y: 0 }], 0.25)).toBe(false);
});

it("requires every cell of a footprint straddling a shared edge", () => {
  const grid = createChunkGrid(300);
  const pose = { position: { x: 299, y: 50 }, heading: 0 };
  const keys = keysForVehicle(grid, pose);
  expect(keys).toHaveLength(2);
  expect(isPoseAvailable(grid, pose, keys.slice(1))).toBe(false);
  expect(isPoseAvailable(grid, pose, keys)).toBe(true);
});

it("treats negative coordinates with the same footprint rules", () => {
  const grid = createChunkGrid(300);
  const pose = { position: { x: -1.5, y: -50 }, heading: 0 };
  const keys = keysForVehicle(grid, pose);
  expect(keys.some((key) => key.x === -1)).toBe(true);
  expect(keys.some((key) => key.x === 0)).toBe(true);
  expect(isPoseAvailable(grid, pose, keys.slice(1))).toBe(false);
});
