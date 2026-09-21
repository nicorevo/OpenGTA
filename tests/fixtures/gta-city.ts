import type { Container } from "pixi.js";
import { compileRegion, type CompiledChunkV0 } from "../../src/world/compiler/compiled.ts";
import { partitionCompiledChunk } from "../../src/world/compiler/partition.ts";
import { createChunkGrid, type ChunkKey } from "../../src/world/chunk/grid.ts";
import { zoomFactor } from "../../src/app/camera.ts";
import type { WorldRegion } from "../../src/world/model/types.ts";

/**
 * G2D-00: quartiere sintetico ripetibile per il look GTA 2D.
 *
 * La scena usa il compiler e il renderer reali, nessuna rete esterna. Tutte le
 * coordinate sono metri nel piano del chunk (x est, y nord). Il quartiere
 * contiene: incrocio X a (0,0), incrocio T a (120,80), bivio Y a (200,-60),
 * una curva a S, un vicolo tra due palazzi, due palazzi rettangolari di altezze
 * diverse, un palazzo concavo (a L), uno con cortile e un edificio che
 * attraversa il confine di partizione a x=60 (variante chunk-boundary).
 *
 * Camera, taxi e seed sono fissati: la posa e' GTA_CITY_CAMERA_POSE, la scala
 * visiva deriva dal preset di guida (zoom 3, fattore 6.0) del renderer, il seed e' il
 * stableStringHash(featureId:profileId) deterministico del renderer (nessuna
 * casualita' a runtime).
 */

export const gtaCityOrigin = Object.freeze({ latitude: 40.35, longitude: 18.17 });
export const GTA_CITY_GRID_CELL_METERS = 60;
export const GTA_CITY_CAMERA_POSE = Object.freeze({ x: 20, y: 10, heading: 0 });
export const GTA_CITY_SEED_POLICY = "deterministico: stableStringHash(featureId:profileId) del renderer; nessuna casualita' a runtime";
export const GTA_CITY_LIGHTING = "flat: nessuna sorgente luminosa dinamica; colori piatti del preset GTA";
export const GTA_CITY_TAXI_SPAWN = Object.freeze({ x: -80, y: 0, heading: 0 });

const rect = (minX: number, minY: number, width: number, height: number) => ({
  outer: [{ x: minX, y: minY }, { x: minX + width, y: minY }, { x: minX + width, y: minY + height }, { x: minX, y: minY + height }],
  holes: [] as const,
});

export const gtaCityRegion: WorldRegion = {
  id: "gta-city-v0",
  geoOrigin: gtaCityOrigin,
  bounds: { minX: -120, minY: -120, maxX: 280, maxY: 160 },
  landAreas: [
    { id: "terreno", kind: "land", area: rect(-120, -120, 400, 280), landClass: "generic" },
    { id: "parco", kind: "land", area: rect(150, -20, 45, 25), landClass: "park", tags: { name: "Parco Verde" } },
  ],
  roads: [
    // Incrocio X a (0,0).
    { id: "via-ovest", kind: "road", centerline: { points: [{ x: -100, y: 0 }, { x: 100, y: 0 }] }, roadClass: "residential", widthMeters: 6, tags: { name: "Viale Centrale" } },
    { id: "via-nord", kind: "road", centerline: { points: [{ x: 0, y: -100 }, { x: 0, y: 100 }] }, roadClass: "residential", widthMeters: 6, tags: { name: "Corso Nord" } },
    // Incrocio T a (120,80): ramo orizzontale e stub verticale.
    { id: "via-tee", kind: "road", centerline: { points: [{ x: 60, y: 80 }, { x: 180, y: 80 }] }, roadClass: "residential", widthMeters: 6, tags: { name: "Via del Tee" } },
    { id: "via-tee-stub", kind: "road", centerline: { points: [{ x: 120, y: 80 }, { x: 120, y: 140 }] }, roadClass: "residential", widthMeters: 6 },
    // Bivio Y a (200,-60): due rami che confluiscono in uno stelo.
    { id: "via-fork-a", kind: "road", centerline: { points: [{ x: 140, y: -100 }, { x: 200, y: -60 }] }, roadClass: "secondary", widthMeters: 7 },
    { id: "via-fork-b", kind: "road", centerline: { points: [{ x: 260, y: -100 }, { x: 200, y: -60 }] }, roadClass: "secondary", widthMeters: 7 },
    { id: "via-fork-stem", kind: "road", centerline: { points: [{ x: 200, y: -60 }, { x: 200, y: -10 }] }, roadClass: "secondary", widthMeters: 7 },
    // Curva a S, senza contatto con gli altri tracciati.
    { id: "via-curva", kind: "road", centerline: { points: [{ x: 100, y: 40 }, { x: 120, y: 55 }, { x: 150, y: 68 }, { x: 180, y: 72 }, { x: 210, y: 66 }, { x: 230, y: 52 }, { x: 240, y: 30 }] }, roadClass: "residential", widthMeters: 6 },
    // Vicolo stretto tra due palazzi (per G2D-04/06: riduzione marciapiede, niente mezzeria).
    { id: "via-alley", kind: "road", centerline: { points: [{ x: -90, y: 60 }, { x: -20, y: 60 }] }, roadClass: "service", widthMeters: 3.5, tags: { name: "Vicolo Stretto" } },
  ],
  buildings: [
    { id: "bld-bassa", kind: "building", footprint: rect(33, 25, 14, 10), buildingType: "residential", sourceHeightMeters: 6, collisionPolicy: "solid" },
    { id: "bld-alta", kind: "building", footprint: rect(31, -41, 18, 12), buildingType: "commercial", sourceHeightMeters: 24, collisionPolicy: "solid" },
    // Sagoma a L: concava, con tacca nell'angolo nord-est.
    { id: "bld-concava", kind: "building", footprint: { outer: [{ x: -60, y: 15 }, { x: -20, y: 15 }, { x: -20, y: 28 }, { x: -34, y: 28 }, { x: -34, y: 50 }, { x: -60, y: 50 }], holes: [] }, buildingType: "residential", sourceHeightMeters: 12, collisionPolicy: "solid" },
    // Cortile interno: foro con avvolgimento opposto al contorno.
    { id: "bld-cortile", kind: "building", footprint: { outer: [{ x: -46, y: -54 }, { x: -24, y: -54 }, { x: -24, y: -36 }, { x: -46, y: -36 }], holes: [[{ x: -42, y: -50 }, { x: -42, y: -40 }, { x: -28, y: -40 }, { x: -28, y: -50 }]] }, buildingType: "civic", sourceHeightMeters: 15, collisionPolicy: "solid" },
    // Attraversa il solo confine di partizione x=60 (cella 60 m): variante chunk-boundary.
    { id: "bld-seam", kind: "building", footprint: rect(45, 10, 30, 13), buildingType: "commercial", sourceHeightMeters: 10, collisionPolicy: "solid" },
    // I due palazzi che stringono il vicolo.
    { id: "bld-vicolo-nord", kind: "building", footprint: rect(-88, 62, 30, 14), buildingType: "residential", sourceHeightMeters: 8, collisionPolicy: "solid" },
    { id: "bld-vicolo-sud", kind: "building", footprint: rect(-80, 42, 30, 16), buildingType: "residential", sourceHeightMeters: 7, collisionPolicy: "solid" },
  ],
  waterAreas: [],
  barriers: [],
  trees: [],
  warnings: [],
};

/** Compila il quartiere con la pipeline reale (un chunk per l'intera regione). */
export function compileGtaCity(): { chunks: readonly CompiledChunkV0[]; diagnostics: ReturnType<typeof compileRegion>["diagnostics"] } {
  return compileRegion(gtaCityRegion);
}

/** Variante chunk-boundary: il chunk compilato viene partizionato sulla griglia reale. */
export function partitionGtaCityChunks(chunk: CompiledChunkV0, cellSizeMeters: number = GTA_CITY_GRID_CELL_METERS): readonly CompiledChunkV0[] {
  const grid = createChunkGrid(cellSizeMeters);
  const bounds = chunk.spatial.bounds;
  const keys: ChunkKey[] = [];
  for (let x = Math.floor(bounds.minX / cellSizeMeters); x <= Math.floor(bounds.maxX / cellSizeMeters); x += 1)
    for (let y = Math.floor(bounds.minY / cellSizeMeters); y <= Math.floor(bounds.maxY / cellSizeMeters); y += 1) keys.push({ x, y });
  return partitionCompiledChunk(chunk, grid, keys);
}

export interface GtaCityFixtureSnapshot {
  readonly pose: { x: number; y: number; heading: number };
  readonly zoomLevel: number;
  readonly cameraBounds: { minX: number; minY: number; maxX: number; maxY: number };
  readonly viewScalePxPerMeter: number;
  readonly vehiclePx: { length: number; width: number };
  readonly roadPx: { widthMeters: number; widthPx: number };
  readonly gpu: { rendererType: string; unmasked: string; software: boolean };
  readonly compileMs: number;
  readonly renderMs: number;
  readonly compiled: { buildings: number; roads: number; ground: number; warnings: string[] };
  readonly drivable: boolean;
  readonly drivableError?: string;
}
export interface GtaCityFixtureDebug extends GtaCityFixtureSnapshot {
  // Mutabili: cambiano mentre il boot completa (ready) e il check fisico gira.
  ready: boolean;
  drivable: boolean;
  resize(width: number, height: number): void;
  snapshot(): GtaCityFixtureSnapshot;
  dispose(): void;
}

function readGpuInfo(canvas: HTMLCanvasElement, renderer: { app: { renderer: { type: number } } }): GtaCityFixtureSnapshot["gpu"] {
  let unmasked = "";
  try {
    const gl = canvas.getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    unmasked = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch { /* best effort: la stringa resta vuota */ }
  const type = renderer.app.renderer.type;
  const rendererType = type === 1 ? "webgl" : type === 2 ? "webgpu" : `type-${type}`;
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(unmasked);
  return { rendererType, unmasked, software };
}

/**
 * Avvia la scena GTA 2D sull'harness e pubblica `window.__opengtaGtaCityDebug`
 * con snapshot ripetibili (camera fissa, dimensioni misurate, tempi e GPU).
 * Usato sia dalla spec E2E sia dalla verifica visiva manuale
 * (`/tests/e2e/harness.html?fixture=gta-city`).
 */
export async function bootGtaCityFixture(canvas: HTMLCanvasElement): Promise<void> {
  const { createPixiRenderer } = await import("../../src/render/pixi/renderer.ts");
  const { createPhysicsAdapter } = await import("../../src/physics/rapier/adapter.ts");
  const { chunks, diagnostics } = compileRegion(gtaCityRegion);
  const compileMs = diagnostics.stageDurationsMs.compile ?? 0;
  const renderer = await createPixiRenderer(canvas);
  const renderStarted = performance.now();
  renderer.render(chunks);
  const renderMs = performance.now() - renderStarted;
  const pose = { ...GTA_CITY_CAMERA_POSE };
  renderer.updateVehicle(pose, pose.heading);
  const gpu = readGpuInfo(canvas, renderer);
  const road = chunks[0].roads.find((entry) => entry.featureId === "via-ovest");
  if (!road) throw new Error("gta-city fixture: via-ovest non compilata");
  const compiled = { buildings: chunks[0].buildings.length, roads: chunks[0].roads.length, ground: chunks[0].ground.length, warnings: [...diagnostics.warnings] };
  let physics: Awaited<ReturnType<typeof createPhysicsAdapter>> | undefined;
  let drivableError: string | undefined;

  const debug: GtaCityFixtureDebug = {
    ready: false,
    pose,
    zoomLevel: renderer.cameraState().zoomLevel,
    cameraBounds: renderer.cameraBounds(),
    viewScalePxPerMeter: 1,
    vehiclePx: { length: 0, width: 0 },
    roadPx: { widthMeters: road.widthMeters, widthPx: 0 },
    gpu,
    compileMs,
    renderMs,
    compiled,
    drivable: false,
    resize(width, height) { renderer.app.renderer.resize(width, height); },
    snapshot() {
      // Riapplica la posa fissa e forza un frame: misura scale e bounds correnti.
      renderer.updateVehicle(pose, pose.heading);
      renderer.app.render();
      const scale = Math.max(1, Math.min(renderer.app.screen.width, renderer.app.screen.height)) / 360 * zoomFactor(renderer.cameraState().zoomLevel);
      const vehicle = renderer.app.stage.children[0].children.at(-1) as Container | undefined;
      const bounds = vehicle?.getBounds();
      return {
        pose: { ...pose },
        zoomLevel: renderer.cameraState().zoomLevel,
        cameraBounds: renderer.cameraBounds(),
        viewScalePxPerMeter: scale,
        vehiclePx: { length: bounds?.width ?? 0, width: bounds?.height ?? 0 },
        roadPx: { widthMeters: road.widthMeters, widthPx: road.widthMeters * scale },
        gpu,
        compileMs,
        renderMs,
        compiled,
        drivable: debug.drivable,
        ...(drivableError ? { drivableError } : {}),
      };
    },
    dispose() {
      renderer.dispose();
      try { physics?.dispose(); } catch { /* teardown best-effort */ }
    },
  };
  Object.defineProperty(window, "__opengtaGtaCityDebug", { configurable: true, value: debug });
  debug.ready = true;

  // Percorso guidabile: il taxi parte all'inizio di Viale Centrale con solo
  // acceleratore; la fisica reale deve portarlo dritto lungo la strada.
  physics = await createPhysicsAdapter([]);
  try {
    physics.setChunk("gta-city", chunks[0].collisions);
    let state = physics.createVehicle({ ...GTA_CITY_TAXI_SPAWN });
    for (let step = 0; step < 420; step += 1) state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
    debug.drivable = state.position.x > -30 && Math.abs(state.position.y) < 3;
  } catch (error) {
    drivableError = error instanceof Error ? error.message : String(error);
  } finally {
    try { physics.dispose(); } catch { /* teardown best-effort */ }
    physics = undefined;
  }
}
