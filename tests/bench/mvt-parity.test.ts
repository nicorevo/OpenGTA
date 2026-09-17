import { readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import * as os from "node:os";
import { dirname } from "node:path";
import { expect, it } from "vitest";
import { decodeVectorTile } from "../../src/geo/mvt/decode.ts";
import { tileBounds } from "../../src/geo/mvt/math.ts";
import { createTangentProjector } from "../../src/geo/coordinates/projector.ts";
import { normalizeOsm, type RawOsm } from "../../src/geo/normalize/osm.ts";
import { compileRegion } from "../../src/world/compiler/compiled.ts";
import type { WorldRegion } from "../../src/world/model/types.ts";
import { mvtToRegion, ORIGIN, TILE } from "./mvt-assemble.ts";

/**
 * DATA-09 parity: Overpass fixture vs OpenFreeMap z14 fixture on the same
 * Sant'Oronzo origin, same tangent projector, same canonical V0 box.
 * Produces a count/timing/bytes matrix, never asserts quality thresholds;
 * the GO decision lives in docs/analysis/MVT-LECCE-PARITY.md.
 */

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
      windowKm2: (() => {
        const tileGeo = tileBounds(TILE.z, TILE.x, TILE.y);
        const nw = projector.project({ latitude: tileGeo.north, longitude: tileGeo.west });
        const se = projector.project({ latitude: tileGeo.south, longitude: tileGeo.east });
        const width = Math.min(300, se.x) - Math.max(-300, nw.x);
        const height = Math.min(300, nw.y) - Math.max(-300, se.y);
        return (width * height) / 1e6;
      })(),
      ...Object.fromEntries(Object.entries(roadClassCounts(mapped.value.region)).map(([key, value]) => [`class_${key}`, value])),
    },
  };
}

function reportMarkdown(matrix: ParityMatrix): string {
  const o = matrix.overpass;
  const m = matrix.mvt;
  const density = (count: number, area: number) => (area > 0 ? count / area : Number.NaN);
  // The seam-correct normalizer (DATA-12) counts only the tile's own area:
  // the MVT window is the box intersected with tile 9019, so densities use
  // the real window area, not the full 600 x 600 m box.
  const mvtWindowKm2 = m.windowKm2;
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
    ["Finestra effettiva km² (box ∩ tile 9019)", "n/d (box intero)", mvtWindowKm2.toFixed(4)],
    ["Densità roads/km²", density(o.roads, o.areaKm2).toFixed(1), density(m.roads, mvtWindowKm2).toFixed(1)],
    ["Densità buildings/km²", density(o.buildings, o.areaKm2).toFixed(1), density(m.buildings, mvtWindowKm2).toFixed(1)],
    ["Densità collisioni/km²", density(o.collisions, o.areaKm2).toFixed(1), density(m.collisions, mvtWindowKm2).toFixed(1)],
  ];
  const env = Object.entries(matrix.environment).map(([key, value]) => `- **${key}**: ${value}`).join("\n");
  const classes = (source: Record<string, number>) => Object.entries(source).filter(([key]) => key.startsWith("class_")).sort().map(([key, value]) => `  - ${key.replace("class_", "")}: ${value}`).join("\n");
  const table = rows.map(([metric, a, b]) => `| ${metric} | ${a} | ${b} |`).join("\n");
  return `# MVT Parity Lecce — Overpass vs OpenFreeMap z14

Generated: ${matrix.environment.date}. Decisione: vedi sezione dedicata.

## Ambiente

${env}

## Matrice di parity (stessa origine Sant'Oronzo; MVT = box V0 ∩ area propria del tile 9019)

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
- La striscia ovest del box V0 appartiene al tile 9018, non incluso nella
  fixture: i conteggi MVT la escludono (normalizer seam-aware, DATA-12).

## Decisione

**GO VISUAL ONLY** per la source pubblica OpenFreeMap z14.

Motivazione, sui numeri della matrice (stessa origine Sant'Oronzo):

- La pipeline MVT è completa e deterministica end-to-end (decode → mapping →
  clip → compileRegion): nessun crash, 29 warning di sola classificazione non
  mappata, conteggi identici su run ripetute. **Non è NO-GO.**
- Finestra MVT: il normalizer seam-aware (DATA-12) conta solo l'area propria
  del tile 9019 (box ∩ tile, ~400 m di larghezza): la striscia ovest del box
  appartiene al tile 9018, non presente nella fixture. Conteggi esclusi per
  dichiarazione, non per perdita.
- Il confronto crudo roads 389 vs 75 va letto con le classi: la baseline
  Overpass include 248 path/pedestrian non carrabili, esclusi dal mapping MVT
  per design. Carrabili: **141 vs 75 (53%)**; residential 122 vs 58 (48%) —
  a z14 strade minori del centro mancano.
- Il layer visuale regge: **buildings 164 vs 127 (77%)**, land 24 vs 10,
  water assente in entrambi. Densità buildings 580 vs ~530/km².
- Costi: la tile z14 copre ~12× l'area del box con il 38% dei byte
  (~32× meno byte/km² su scala tile; 839.963 B su 0,28 km² vs 321.055 B su
  3,47 km²) e **~4× meno ms/km²** (normalize ≈18 ms vs decode+map ≈52 ms
  per l'intera tile).
- Il gameplay NON è pronto con z14 pubblico: collisioni 241 vs 127 (**53%**),
  barriere 33 vs 0 e alberi 11 vs 0 (gap dichiarati). La guida funzionerebbe
  su strade principali, ma con collisioni incomplete e rete minore bucata.
  Le label ci sono per i nomi stradali (join transportation_name) e i
  parchi; mancano i nomi di edifici/poi (non presenti nel tile a z14).
- Percorso di upgrade dichiarato: un dataset self-hosted/PMTiles a z16
  (DATA-15..18) riporterebbe minor roads, barriere e poi senza toccare
  canonical/compiler; questa matrice resta la baseline di confronto.

Conseguenza operativa: il feature flag DATA-11 parte come
\`provider=openfreemap-mvt\` sperimentale, mai default; la decisione GO per il
gameplay è demandata a una parity futura su dataset a zoom superiore.
`;
}

it("builds the complete Overpass vs MVT parity matrix", () => {
  const matrix = runParity();
  for (const [key, value] of Object.entries(matrix.overpass)) expect(Number.isFinite(value), `overpass ${key}`).toBe(true);
  for (const [key, value] of Object.entries(matrix.mvt)) expect(Number.isFinite(value), `mvt ${key}`).toBe(true);
  expect(matrix.overpass.elements).toBeGreaterThan(0);
  expect(matrix.mvt.rawRoads).toBeGreaterThan(0);
  // The report is an explicit action, not a side effect of the gate:
  // OPENGTA_WRITE_BENCH_REPORT=1 npm run test:bench
  if (process.env.OPENGTA_WRITE_BENCH_REPORT === "1") {
    const markdown = reportMarkdown(matrix);
    mkdirSync(dirname(REPORT_PATH.pathname), { recursive: true });
    writeFileSync(REPORT_PATH, markdown);
    console.log(`\n${markdown}`);
  }
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
