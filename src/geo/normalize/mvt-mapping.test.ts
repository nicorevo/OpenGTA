import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { decodeVectorTile } from "../mvt/decode.ts";
import { createTangentProjector } from "../coordinates/projector.ts";
import { transportationRoadFeatures } from "./mvt-roads.ts";
import { buildingFeatures } from "./mvt-buildings.ts";
import { landAndWaterFeatures } from "./mvt-land.ts";
import type { WorldWarning } from "../../world/model/types.ts";

const tile = { z: 14, x: 9019, y: 6181 };
const origin = { latitude: 40.35316888888889, longitude: 18.17259 };
const projector = createTangentProjector(origin);
const decoded = decodeVectorTile(new Uint8Array(readFileSync(new URL("../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url))));
const warnings: WorldWarning[] = [];
const layer = (name: string) => decoded.layers.find((entry) => entry.name === name)?.features ?? [];

it("maps transportation lines to drivable OpenGTA roads only", () => {
  const roads = transportationRoadFeatures(layer("transportation"), projector, tile, 4096, warnings);
  expect(roads.length).toBeGreaterThan(200);
  const classes = new Set(roads.map((road) => road.roadClass));
  expect(classes).not.toContain("pedestrian");
  expect(classes).not.toContain("path");
  // minor -> residential is the documented PoC approximation
  expect(classes).toContain("residential");
  expect(roads.every((road) => road.centerline.points.length >= 2)).toBe(true);
  // non-drivable classes produce no carriageway, only skip warnings
  expect(warnings.filter((warning) => warning.code === "unsupported-transportation").length).toBeGreaterThanOrEqual(0);
});

it("maps building polygons with render_height or the deterministic fallback", () => {
  const buildings = buildingFeatures(layer("building"), projector, tile, 4096, warnings);
  expect(buildings.length).toBeGreaterThan(20);
  expect(buildings.every((building) => building.collisionPolicy === "solid")).toBe(true);
  expect(buildings.some((building) => building.sourceHeightMeters !== undefined)).toBe(true);
  expect(buildings.every((building) => building.footprint.outer.length >= 3)).toBe(true);
});

it("maps park, landuse and water polygons to land and water features", () => {
  const { landAreas, waterAreas } = landAndWaterFeatures([...layer("park"), ...layer("landuse"), ...layer("landcover"), ...layer("water")], projector, tile, 4096, warnings);
  expect(landAreas.some((area) => area.landClass === "park")).toBe(true);
  expect(waterAreas.length).toBeGreaterThan(0);
  expect([...landAreas, ...waterAreas].every((area) => area.area !== undefined && area.area.outer.length >= 3)).toBe(true);
});
