import { readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import * as os from "node:os";
import { dirname } from "node:path";
import { expect, it } from "vitest";
import { decodeVectorTile, type DecodedVectorTile } from "../../src/geo/mvt/decode.ts";
import { tileBounds } from "../../src/geo/mvt/math.ts";
import { createTangentProjector } from "../../src/geo/coordinates/projector.ts";
import { normalizeOsm, type RawOsm } from "../../src/geo/normalize/osm.ts";
import { transportationRoadFeatures } from "../../src/geo/normalize/mvt-roads.ts";
import { buildingFeatures } from "../../src/geo/normalize/mvt-buildings.ts";
import { landAndWaterFeatures } from "../../src/geo/normalize/mvt-land.ts";
import { clipPolygonToBounds, clipPolylineToBounds } from "../../src/world/model/clip.ts";
import { validatePolygon, type Bounds2D, type RoadFeature, type WorldRegion, type WorldWarning } from "../../src/world/model/types.ts";
import { compileRegion } from "../../src/world/compiler/compiled.ts";

/**
 * DATA-09 parity: Overpass fixture vs OpenFreeMap z14 fixture on the same
 * Sant'Oronzo origin, same tangent projector, same canonical V0 box.
 * Produces a count/timing/bytes matrix, never asserts quality thresholds;
 * the GO decision lives in docs/analysis/MVT-LECCE-PARITY.md.
 */

const ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
const TILE = { z: 14, x: 9019, y: 6181 };
const EXTENT = 4096;
const V0_BOUNDS: Bounds2D = { minX: -300, minY: -300, maxX: 300, maxY: 300 };
const OVERPASS_FIXTURE = new URL("../../src/fixtures/geo/lecce-sant-oronzo-v0.raw.json", import.meta.url);
const MVT_FIXTURE = new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url);
const REPORT_PATH = new URL("../../docs/analysis/MVT-LECCE-PARITY.md", import.meta.url);

function fixtureBytes(url: URL): number {
  return statSync(url).size;
}

function measure<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

/** Clip a mapped MVT road set to the canonical V0 box exactly like normalizeOsm does for OSM. */
function clipRoads(roads: readonly RoadFeature[], bounds: Bounds2D, warnings: WorldWarning[]): RoadFeature[] {
  const clipped: RoadFeature[] = [];
  for (const road of roads) {
    for (const points of clipPolylineToBounds(road.centerline.points, bounds)) {
      if (points.length < 2) continue;
      clipped.push({ ...road, id: `${road.id}#p${clipped.length}`, centerline: { points } });
    }
  }
  void warnings;
  return clipped;
}

/** Build a WorldRegion from the decoded tile, clipped to the canonical V0 box. */
function mvtToRegion(decoded: DecodedVectorTile): { region: WorldRegion; warnings: WorldWarning[]; raw: { roads: number; buildings: number; land: number; water: number } } {
  const projector = createTangentProjector(ORIGIN);
  const warnings: WorldWarning[] = [];
  const layerFeatures = (name: string) => decoded.layers.find((layer) => layer.name === name)?.features ?? [];
  const rawRoads = transportationRoadFeatures(layerFeatures("transportation"), projector, TILE, EXTENT, warnings);
  const rawBuildings = buildingFeatures(layerFeatures("building"), projector, TILE, EXTENT, warnings);
  const { landAreas: rawLand, waterAreas: rawWater } = landAndWaterFeatures(
    [...layerFeatures("park"), ...layerFeatures("landuse"), ...layerFeatures("landcover"), ...layerFeatures("water")],
    projector, TILE, EXTENT, warnings,
  );
  const buildings = rawBuildings
    .map((building) => ({ ...building, footprint: clipPolygonToBounds(building.footprint, V0_BOUNDS) }))
    .filter((building) => building.footprint !== undefined && validatePolygon(building.footprint).length === 0)
    .map((building) => ({ ...building, footprint: building.footprint! }));
  const landAreas = rawLand
    .map((area) => ({ ...area, area: clipPolygonToBounds(area.area, V0_BOUNDS) }))
    .filter((area) => area.area !== undefined && validatePolygon(area.area).length === 0)
    .map((area) => ({ ...area, area: area.area! }));
  const waterAreas = rawWater
    .map((area) => ({ ...area, area: clipPolygonToBounds(area.area, V0_BOUNDS) }))
    .filter((area) => area.area !== undefined && validatePolygon(area.area).length === 0)
    .map((area) => ({ ...area, area: area.area! }));
  const roads = clipRoads(rawRoads, V0_BOUNDS, warnings);
  const tileGeo = tileBounds(TILE.z, TILE.x, TILE.y);
  const corners = projector.project({ latitude: tileGeo.south, longitude: tileGeo.west });
  const far = projector.project({ latitude: tileGeo.north, longitude: tileGeo.east });
  const tileAreaKm2 = Math.abs(far.x - corners.x) * Math.abs(far.y - corners.y) / 1e6;
  const region: WorldRegion = {
    id: "mvt-z14",
    geoOrigin: ORIGIN,
    bounds: V0_BOUNDS,
    buildings,
    roads,
    landAreas,
    waterAreas,
    barriers: [], // gap: OpenMapTiles z14 carries no barrier layer usable by OpenGTA
    trees: [],    // gap: no tree/amenity layer mapped in the PoC
    warnings,
  };
  return { region, warnings, raw: { roads: rawRoads.length, buildings: rawBuildings.length, land: rawLand.length, water: rawWater.length }, };
}

interface ParityMatrix {
  environment: Record<string, string>;
  overpass: Record<string, number>;
  mvt: Record<string, number>;
}

function runParity(): ParityMatrix {
  const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const environment = {
    date: new Date().toISOString(),
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    ramMiB: String(Math.round(os.totalmem() / 1e6)),
    commit,
    overpassFixture: "lecce-sant-oronzo-v0.raw.json (300 m box, network unreachable from this environment)",
    mvtFixture: "lecce-z14-openfreemap.pbf (tile 14/9019/6181, public z14 ceiling)",
  };

  const projector = createTangentProjector(ORIGIN);
  const overpassBytes = fixtureBytes(OVERPASS_FIXTURE);
  const mvtBytes = fixtureBytes(MVT_FIXTURE);

  // Overpass path: fixture JSON -> normalizeOsm -> compileRegion.
  const rawOsm = JSON.parse(readFileSync(OVERPASS_FIXTURE, "utf8")) as RawOsm;
  const normalized = measure(() => normalizeOsm(rawOsm, projector, ORIGIN, "overpass-fixture"));
  const compiledOverpass = measure(() => compileRegion(normalized.value));
  const overpassChunk = compiledOverpass.value.chunks[0];

  // MVT path: fixture PBF -> decode -> mapping -> clip -> compileRegion.
  const decoded = measure(() => decodeVectorTile(new Uint8Array(readFileSync(MVT_FIXTURE))));
  const mapped = measure(() => mvtToRegion(decoded.value));
  const compiledMvt = measure(() => compileRegion(mapped.value.region));
  const mvtChunk = compiledMvt.value.chunks[0];

  const roadClassCounts = (region: WorldRegion) => {
    const counts: Record<string, number> = {};
    for (const road of region.roads) counts[road.roadClass] = (counts[road.roadClass] ?? 0) + 1;
    return counts;
  };

  return {
    environment,
    overpass: {
      elements: rawOsm.elements.length,
      bytes: overpassBytes,
      roads: normalized.value.roads.length,
      buildings: normalized.value.buildings.length,
      land: normalized.value.landAreas.length,
      water: normalized.value.waterAreas.length,
      barriers: normalized.value.barriers.length,
      trees: normalized.value.trees.length,
      warnings: normalized.value.warnings.length,
      compiledRoads: overpassChunk.roads.length,
      compiledBuildings: overpassChunk.buildings.length,
      compiledGround: overpassChunk.ground.length,
      collisions: overpassChunk.collisions.length,
      labels: overpassChunk.labels.length,
      normalizeMs: normalized.ms,
      compileMs: compiledOverpass.ms,
      areaKm2: Math.PI * 300 * 300 / 1e6,
      ...Object.fromEntries(Object.entries(roadClassCounts(normalized.value)).map(([key, value]) => [`class_${key}`, value])),
    },
    mvt: {
      tileFeatureCount: decoded.value.featureCount,
      bytes: mvtBytes,
      rawRoads: mapped.value.raw.roads,
      rawBuildings: mapped.value.raw.buildings,
      rawLand: mapped.value.raw.land,
      rawWater: mapped.value.raw.water,
      roads: mapped.value.region.roads.length,
      buildings: mapped.value.region.buildings.length,
      land: mapped.value.region.landAreas.length,
      water: mapped.value.region.waterAreas.length,
      barriers: 0,
      trees: 0,
      warnings: mapped.value.region.warnings.length,
      compiledRoads: mvtChunk.roads.length,
      compiledBuildings: mvtChunk.buildings.length,
      compiledGround: mvtChunk.ground.length,
      collisions: mvtChunk.collisions.length,
      labels: mvtChunk.labels.length,
      decodeMs: decoded.ms,
      mapMs: mapped.ms,
      compileMs: compiledMvt.ms,
      tileAreaKm2: (() => {
        const tileGeo = tileBounds(TILE.z, TILE.x, TILE.y);
        const a = projector.project({ latitude: tileGeo.south, longitude: tileGeo.west });
        const b = projector.project({ latitude: tileGeo.north, longitude: tileGeo.east });
        return Math.abs(b.x - a.x) * Math.abs(b.y - a.y) / 1e6;
      })(),
      ...Object.fromEntries(Object.entries(roadClassCounts(mapped.value.region)).map(([key, value]) => [`class_${key}`, value])),
    },
  };
}

function reportMarkdown(matrix: ParityMatrix): string {
  const o = matrix.overpass;
  const m = matrix.mvt;
  const density = (count: number, area: number) => (area > 0 ? count / area : Number.NaN);
  const rows: [string, string, string][] = [
    ["Elementi grezzi / feature decodificate", String(o.elements), String(m.tileFeatureCount)],
    ["Bytes fixture", String(o.bytes), String(m.bytes)],
    ["Roads nel box V0 (±300 m)", String(o.roads), String(m.roads)],
    ["Roads raw (tile intero)", "n/d (box 300 m)", String(m.rawRoads)],
    ["Buildings nel box V0", String(o.buildings), String(m.buildings)],
    ["Buildings raw (tile intero)", "n/d", String(m.rawBuildings)],
    ["Land nel box V0", String(o.land), String(m.land)],
    ["Water nel box V0", String(o.water), String(m.water)],
    ["Barriers (gap dichiarato)", String(o.barriers), "0 (gap dichiarato)"],
    ["Trees (gap dichiarato)", String(o.trees), "0 (gap dichiarato)"],
    ["Warning normalizzazione", String(o.warnings), String(m.warnings)],
    ["Roads compilati", String(o.compiledRoads), String(m.compiledRoads)],
    ["Buildings compilati", String(o.compiledBuildings), String(m.compiledBuildings)],
    ["Ground compilati", String(o.compiledGround), String(m.compiledGround)],
    ["Collisioni", String(o.collisions), String(m.collisions)],
    ["Label", String(o.labels), String(m.labels)],
    ["Decode/normalize ms", String(o.normalizeMs.toFixed(1)), `${m.decodeMs.toFixed(1)} + ${m.mapMs.toFixed(1)} (decode+map)`],
    ["Compile ms", o.compileMs.toFixed(1), m.compileMs.toFixed(1)],
    ["Area km²", o.areaKm2.toFixed(4), m.tileAreaKm2.toFixed(4)],
    ["Densità roads/km²", density(o.roads, o.areaKm2).toFixed(1), density(m.roads, o.areaKm2).toFixed(1)],
    ["Densità buildings/km²", density(o.buildings, o.areaKm2).toFixed(1), density(m.buildings, o.areaKm2).toFixed(1)],
    ["Densità collisioni/km²", density(o.collisions, o.areaKm2).toFixed(1), density(m.collisions, o.areaKm2).toFixed(1)],
  ];
  const env = Object.entries(matrix.environment).map(([key, value]) => `- **${key}**: ${value}`).join("\n");
  const classes = (source: Record<string, number>) => Object.entries(source).filter(([key]) => key.startsWith("class_")).sort().map(([key, value]) => `  - ${key.replace("class_", "")}: ${value}`).join("\n");
  const table = rows.map(([metric, a, b]) => `| ${metric} | ${a} | ${b} |`).join("\n");
  return `# MVT Parity Lecce — Overpass vs OpenFreeMap z14

Generated: ${matrix.environment.date}. Decisione: vedi sezione dedicata.

## Ambiente

${env}

## Matrice di parity (stessa origine Sant'Oronzo, stesso box V0 ±300 m)

| Metrica | Overpass (fixture 300 m) | OpenFreeMap z14 |\n| --- | --- | --- |
${table}

## Classi stradali nel box V0

Overpass:
${classes(matrix.overpass) || "  - (nessuna)"}

OpenFreeMap:
${classes(matrix.mvt) || "  - (nessuna)"}

## Gap dichiarati

- OpenFreeMap z14 non espone barriere utilizzabili dal modello OpenGTA
  (layer barrier assente nel profilo pubblico): collisioni da barrier = 0.
- Alberi/punti notevoli non mappati nel PoC: trees = 0.
- Overpass misurato solo su fixture: la rete Overpass non è raggiungibile
  da questo ambiente (verificato in DATA-01).
- OpenFreeMap pubblico ha soffitto z14: z15/z16 restituiscono tile vuote.

## Decisione

<!-- decisione -->
`;
}

it("builds the complete Overpass vs MVT parity matrix and writes the report", () => {
  const matrix = runParity();
  for (const [key, value] of Object.entries(matrix.overpass)) expect(Number.isFinite(value), `overpass ${key}`).toBe(true);
  for (const [key, value] of Object.entries(matrix.mvt)) expect(Number.isFinite(value), `mvt ${key}`).toBe(true);
  expect(matrix.overpass.elements).toBeGreaterThan(0);
  expect(matrix.mvt.rawRoads).toBeGreaterThan(0);
  const markdown = reportMarkdown(matrix);
  mkdirSync(dirname(REPORT_PATH.pathname), { recursive: true });
  writeFileSync(REPORT_PATH, markdown);
  console.log(`\n${markdown}`);
});

it("is deterministic across two mapping runs of the same tile", () => {
  const decoded = decodeVectorTile(new Uint8Array(readFileSync(MVT_FIXTURE)));
  const first = mvtToRegion(decoded);
  const second = mvtToRegion(decodeVectorTile(new Uint8Array(readFileSync(MVT_FIXTURE))));
  expect(second.region.roads.length).toBe(first.region.roads.length);
  expect(second.region.buildings.length).toBe(first.region.buildings.length);
  expect(second.region.landAreas.length).toBe(first.region.landAreas.length);
  expect(second.region.waterAreas.length).toBe(first.region.waterAreas.length);
});
