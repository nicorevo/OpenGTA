import { Application, Assets, Container, Graphics, Text, type Texture } from "pixi.js";
import type { CompiledChunkV0, CompiledLabel } from "../../world/compiler/compiled.ts";
import type { Bounds2D, Polygon2D, Vec2 } from "../../world/model/types.ts";
import { createPresentationState, toggleLabels, type PresentationState } from "./presentation.ts";
import { groupRoadsByStyleAndWidth, sortBuildingsForPainter, type ClassedRoadGroup } from "./scene-order.ts";
import { clampZoom, lodForZoom, zoomFactor, type LodTier, type ZoomLevel } from "../../app/camera.ts";
import { lodProfileForTier, type LodPresentationProfile, type RoadDetailLevel } from "../lod-profile.ts";

import taxiImageUrl from "./assets/taxi-gta1.png?inline";
import { createTaxiSprite } from "./taxi.ts";

export interface CameraState { readonly zoomLevel: ZoomLevel; readonly zoomFactor: number; readonly bounds: Bounds2D }
export interface PixiRenderer {
  readonly app: Application;
  /** Full-set rebuild: V0 offline entry point and explicit refresh. */
  render(chunk: CompiledChunkV0 | readonly CompiledChunkV0[]): void;
  /** Incremental upsert of one chunk presentation (add or content revision). */
  setChunk(chunk: CompiledChunkV0): void;
  /** Destroys only the presentation of the given chunk id. */
  removeChunk(chunkId: string): void;
  /** Read-only diagnostics for tests and the debug overlay. */
  presentationCounts(): { chunkPresentations: number; graphicsObjects: number };
  /** LOD observability: how the current tier shaped the presentations. */
  presentationDiagnostics(): { culledFeatures: number; facades: number; roadCasing: boolean; sidewalks: boolean; roadMarkings: boolean; labels: number };
  /** Discrete zoom: presentation-only, vehicle world pose and physics untouched. */
  setZoom(level: ZoomLevel): void;
  zoomIn(): ZoomLevel;
  zoomOut(): ZoomLevel;
  cameraState(): CameraState;
  updateVehicle(position: { x: number; y: number }, heading: number, velocity?: { x: number; y: number }): void;
  toggleLabels(): boolean;
  cameraBounds(): Bounds2D;
  dispose(): void;
}
const VEHICLE_LENGTH_METERS = 4.2;
const VEHICLE_WIDTH_METERS = 1.8;
// G2D-01: visual multiplier of the real taxi size, calibrated together with
// the driving preset (spec range 1.0-1.3): at 640x480 the sprite reads
// ~37x17 px and a 6 m road holds more than two car widths.
const VEHICLE_VISUAL_SCALE = 1.2;
const LABEL_TEXT_STYLE = { fontFamily: "Arial", fontSize: 10, fontWeight: "normal", fill: 0x000000, stroke: { color: 0xffffff, width: 2 } } as const;
const ROAD_CASING_MIN_PX = 0.75;
const ROAD_CASING_MAX_PX = 2.5;
const ROAD_CASING_RATIO = 0.12;

/** Keeps the asphalt readable: a fixed casing would swallow narrow alleys. */
function roadCasingPx(roadPx: number): number { return Math.min(ROAD_CASING_MAX_PX, Math.max(ROAD_CASING_MIN_PX, roadPx * ROAD_CASING_RATIO)); }

// Close-zoom (GTA-1 look) street detail: derived from the road centerline +
// width already in the compiled chunk, so no new data source is needed.
const SIDEWALK_WIDTH_METERS = 1.8;
const SIDEWALK_FILL = 0x9a9a92;
const MARKING_DASH_METERS = 2.5;
const MARKING_GAP_METERS = 2.5;
const MARKING_WIDTH_METERS = 0.18;
const MARKING_FILL = 0xffffff;
const MIN_MARKING_PX = 1.5;

/** Per-side pavement band width in screen px for a given view scale. */
export function sidewalkPadPx(scale: number): number { return SIDEWALK_WIDTH_METERS * scale; }
/** Tier gate: pavement shows from the medium tier up; far keeps the bare body. */
export function sidewalkEnabled(roadDetail: RoadDetailLevel): boolean { return roadDetail !== "body"; }
/** Tier gate: dashed lane markings are a near-tier-only detail. */
export function roadMarkingsEnabled(roadDetail: RoadDetailLevel): boolean { return roadDetail !== "body"; }

// --- GTA world palette: map the class/styleKey already present in the chunk to a
// color. Muted, earthy tones that read as a stylised game map (not a light web
// map). Keeping them as pure functions makes the theme swappable and testable. ---
const GROUND_FILL: Record<string, number> = {
  park: 0x6f9a4e, grass: 0x7f9d5c, forest: 0x4f7a3a, residential: 0x8a9a6a,
  commercial: 0x8f8f86, industrial: 0x8a8a84, pedestrian: 0x9a958a, parking: 0x7d7d78,
  sand: 0xd8c48a, bare: 0xa8895f, generic: 0x8b9d70, unknown: 0x8b9d70,
};
const GROUND_WATER = 0x5b86a6;
const GROUND_BASE = 0x8b9d70;

export function groundFill(kind: "water" | "land", cls: string): number {
  if (kind === "water") return GROUND_WATER;
  return GROUND_FILL[cls] ?? GROUND_BASE;
}

/** The class portion of a "<kind>:<class>" styleKey (e.g. "road:primary" -> "primary"). */
export function styleClass(styleKey: string): string {
  const at = styleKey.indexOf(":");
  return at >= 0 ? styleKey.slice(at + 1) : styleKey;
}

const ROAD_STYLE: Record<string, { fill: number; casing: number }> = {
  motorway: { fill: 0x3a3840, casing: 0x242228 },
  trunk: { fill: 0x3a3840, casing: 0x242228 },
  primary: { fill: 0x45424b, casing: 0x2c2a31 },
  secondary: { fill: 0x514f58, casing: 0x302e38 },
  tertiary: { fill: 0x514f58, casing: 0x302e38 },
  residential: { fill: 0x56545d, casing: 0x33313a },
  service: { fill: 0x56545d, casing: 0x33313a },
};
const ROAD_BASE = { fill: 0x53515a, casing: 0x302e38 };
export function roadStyle(cls: string): { fill: number; casing: number } {
  return ROAD_STYLE[cls] ?? ROAD_BASE;
}

const ROOF_PALETTE = [0xb18d77, 0xa86f5d, 0x9c8468, 0x8f7f8a, 0x9a7a5a, 0x7d7a86, 0xc2a074, 0x96714f];
const FACADE_PALETTE = [0x806c61, 0x6f5d52, 0x756a63, 0x6a5f6b, 0x7a6a58, 0x64616c, 0x94795a, 0x7a5a42];
const TYPE_STYLE: Record<string, { roof: number; facade: number }> = {
  historic: { roof: 0xa86f5d, facade: 0x8a5f52 },
  religious: { roof: 0xb8a86e, facade: 0x94865c },
  civic: { roof: 0x93a0ad, facade: 0x6f7a86 },
  industrial: { roof: 0x8d8d94, facade: 0x6e6e74 },
  commercial: { roof: 0x9d9188, facade: 0x7d726a },
};
export function buildingStyle(cls: string, seed: number): { roof: number; facade: number } {
  const pinned = TYPE_STYLE[cls];
  if (pinned) return pinned;
  const i = Math.abs(seed) % ROOF_PALETTE.length;
  return { roof: ROOF_PALETTE[i], facade: FACADE_PALETTE[i] };
}

/** FNV-1a 32-bit of the whole-meter position: stable per building, tile-independent. */
export function positionSeed(x: number, y: number): number {
  const key = `${Math.round(x)}:${Math.round(y)}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Point at an arc length (world meters) along a polyline, by linear interp. */
function pointAtLength(points: readonly Vec2[], cum: readonly number[], length: number): Vec2 {
  if (length <= 0) return points[0];
  if (length >= cum[cum.length - 1]) return points[points.length - 1];
  let edge = 0;
  while (edge < cum.length - 2 && cum[edge + 1] < length) edge += 1;
  const t = (length - cum[edge]) / (cum[edge + 1] - cum[edge]);
  const a = points[edge]; const b = points[edge + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Walk a centerline and emit fixed-length dashes (world meters) as point pairs.
 * PixiJS v8 `stroke()` has no native dash, so the renderer strokes each short
 * segment. Deterministic and independent of screen scale (zoom scales the draw).
 */
export function dashSegments(points: readonly Vec2[], dashMeters: number, gapMeters: number): Vec2[][] {
  const segments: Vec2[][] = [];
  if (points.length < 2 || dashMeters <= 0 || gapMeters < 0) return segments;
  const cum: number[] = [0];
  for (let i = 0; i < points.length - 1; i += 1) cum.push(cum[i] + Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y));
  const total = cum[cum.length - 1];
  const period = dashMeters + gapMeters;
  for (let start = 0; start < total; start += period) {
    const end = Math.min(start + dashMeters, total);
    if (end - start < 1e-6) break;
    segments.push([pointAtLength(points, cum, start), pointAtLength(points, cum, end)]);
    if (end === total) break;
  }
  return segments;
}

export function drawPolygon(graphics: Graphics, polygon: Polygon2D, scale: number, height: number, color: number): void {
  if (polygon.outer.length < 3) return;
  const screenRing = (ring: readonly { x: number; y: number }[]) => ring.map((point) => ({
    x: point.x * scale,
    y: -point.y * scale,
  }));
  graphics.poly(screenRing(polygon.outer)).fill(color);
  if (polygon.holes.length > 0) {
    for (const hole of polygon.holes) graphics.poly(screenRing(hole));
    graphics.cut();
  }
  if (height > 0) graphics.poly(screenRing(polygon.outer)).stroke({ color: 0x27232c, width: 1 });
}

type CompiledRoad = CompiledChunkV0["roads"][number];
function queueCenterlines(graphics: Graphics, roads: readonly CompiledRoad[], scale: number): void {
  for (const road of roads) {
    const points = road.centerline;
    if (points.length < 2) continue;
    graphics.moveTo(points[0].x * scale, -points[0].y * scale);
    for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index].x * scale, -points[index].y * scale);
  }
}
function strokeRoadNetwork(graphics: Graphics, groups: readonly ClassedRoadGroup<CompiledRoad>[], scale: number, color: number | ((group: ClassedRoadGroup<CompiledRoad>) => number), padPx: (roadPx: number) => number): void {
  for (const group of groups) {
    const roadPx = Math.max(1, group.widthMeters * scale);
    queueCenterlines(graphics, group.roads, scale);
    graphics.stroke({ color: typeof color === "function" ? color(group) : color, width: roadPx + padPx(roadPx) * 2, cap: "round", join: "round" });
  }
}
/** Strokes a thin dashed center line along every road (near-tier detail). */
function drawCenterDashes(graphics: Graphics, groups: readonly ClassedRoadGroup<CompiledRoad>[], scale: number, viewPxPerMeter: number): void {
  let queued = 0;
  for (const group of groups) {
    for (const road of group.roads) {
      for (const segment of dashSegments(road.centerline, MARKING_DASH_METERS, MARKING_GAP_METERS)) {
        graphics.moveTo(segment[0].x * scale, -segment[0].y * scale);
        graphics.lineTo(segment[1].x * scale, -segment[1].y * scale);
        queued += 1;
      }
    }
  }
  // worldScale is 1: geometry is in meters, the container transform applies the px
  // scale. Keep the center line a fixed world length (0.18 m) but never thinner than
  // ~1.5 px on screen, so it reads at the medium (normal-play) tier, not only at near.
  if (queued > 0) {
    const width = Math.max(MARKING_WIDTH_METERS * scale, MIN_MARKING_PX / viewPxPerMeter);
    graphics.stroke({ color: MARKING_FILL, width, cap: "round", join: "round" });
  }
}
function readableLabelAngle(angle: number): number { let result = -angle; if (result > Math.PI / 2) result -= Math.PI; if (result < -Math.PI / 2) result += Math.PI; return result; }
function visibleLabels(labels: readonly CompiledLabel[], profile: LodPresentationProfile): CompiledLabel[] {
  return labels.filter((label) => label.priority >= profile.labelMinPriority);
}

type CompiledBuilding = CompiledChunkV0["buildings"][number];
function buildingDepthKey(building: CompiledBuilding): number {
  const points = building.roof.outer;
  if (points.length === 0) return 0;
  let sum = 0;
  for (const point of points) sum += point.y - point.x;
  return sum / points.length;
}
function polygonArea(outer: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let index = 0; index < outer.length; index += 1) {
    const a = outer[index]; const b = outer[(index + 1) % outer.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

interface ChunkPresentation {
  readonly chunk: CompiledChunkV0;
  readonly ground: Graphics;
  readonly sidewalk: Graphics;
  readonly roadCasing: Graphics;
  readonly roadSurface: Graphics;
  readonly corridor: Graphics;
  readonly roadMarking: Graphics;
  readonly buildings: Graphics;
  readonly labels: Container;
  // Order keys reproduce the global painter order across chunk containers:
  // wide roads and south-east buildings paint later, matching scene-order.ts.
  readonly roadOrder: number;
  readonly buildingOrder: number;
  culledFeatures: number;
  facades: number;
  hasRoadCasing: boolean;
  hasSidewalk: boolean;
  hasRoadMarkings: boolean;
}

export async function createPixiRenderer(canvas: HTMLCanvasElement): Promise<PixiRenderer> {
  const app = new Application();
  await app.init({ canvas, background: 0x91a477, antialias: true, preference: "webgl", resizeTo: canvas.parentElement ?? window });
  const world = new Container(); app.stage.addChild(world);
  const staticLayer = new Container(); world.addChild(staticLayer);
  // Layer containers preserve the global order ground < sidewalk < road casing
  // < road surface < corridor mask < road markings < buildings < labels; the
  // per-chunk children inside each layer are zIndexed by their painter key so
  // add/remove stays local.
  const groundLayer = new Container(); groundLayer.sortableChildren = true;
  const sidewalkLayer = new Container(); sidewalkLayer.sortableChildren = true;
  const roadCasingLayer = new Container(); roadCasingLayer.sortableChildren = true;
  const roadSurfaceLayer = new Container(); roadSurfaceLayer.sortableChildren = true;
  const corridorLayer = new Container();
  const roadMarkingLayer = new Container(); roadMarkingLayer.sortableChildren = true;
  const buildingsLayer = new Container(); buildingsLayer.sortableChildren = true;
  buildingsLayer.setMask({ mask: corridorLayer, inverse: true });
  const labelLayer = new Container();
  staticLayer.addChild(groundLayer, sidewalkLayer, roadCasingLayer, roadSurfaceLayer, corridorLayer, roadMarkingLayer, buildingsLayer, labelLayer);
  const worldScale = 1;
  const length = VEHICLE_LENGTH_METERS * VEHICLE_VISUAL_SCALE;
  const width = VEHICLE_WIDTH_METERS * VEHICLE_VISUAL_SCALE;
  const vehicle = new Container();
  // Soft ground shadow under the car: this is what stops the sprite from
  // reading as floating. Drawn first so it sits beneath the body, and shifted
  // a little against the lean in updateVehicle so the car looks planted.
  const vehicleShadow = new Graphics();
  vehicleShadow
    .roundRect(-length * 0.46, -width * 0.43, length * 0.92, width * 0.86, width * 0.30)
    .fill({ color: 0x000000, alpha: 0.16 });
  // The body lives in its own group so the drift flex (skew) bends the whole
  // car, not just the painted body.
  const vehicleBodyGroup = new Container();
  const taxiTexture = await Assets.load<Texture>(taxiImageUrl);
  const vehicleBody = createTaxiSprite(taxiTexture, length, width);
  vehicleBodyGroup.addChild(vehicleBody);
  vehicle.addChild(vehicleShadow, vehicleBodyGroup);
  world.addChild(vehicle);
  const presentations = new Map<string, ChunkPresentation>();
  let disposed = false;
  let position = { x: 0, y: 0 };
  let zoomLevel: ZoomLevel = 2;
  const viewScale = () => Math.max(1, Math.min(app.screen.width, app.screen.height)) / 360 * zoomFactor(zoomLevel);
  const updateCamera = () => {
    const scale = viewScale(); world.scale.set(scale);
    world.position.set(app.screen.width / 2 - position.x * scale, app.screen.height / 2 + position.y * scale);
  };
  app.ticker.add(updateCamera);
  let presentation: PresentationState = createPresentationState();
  let currentProfileTier: LodTier = lodForZoom(2);
  let currentProfile: LodPresentationProfile = lodProfileForTier(currentProfileTier);

  const applyTier = (): void => {
    const chunks = [...presentations.values()].map((entry) => entry.chunk);
    for (const entry of [...presentations.values()]) { presentations.delete(entry.chunk.id); destroyPresentation(entry); }
    for (const chunk of chunks) { const entry = buildPresentation(chunk); presentations.set(chunk.id, entry); insertPresentation(entry); }
    rebuildLabels();
  };
  const changeZoom = (level: ZoomLevel): void => {
    // The level must change BEFORE the tier rebuild: applyTier re-measures
    // culling with viewScale(), which reads zoomLevel. With the previous
    // order the far tier culled with the old level's scale (G2D-01).
    zoomLevel = level;
    const tier = lodForZoom(level);
    if (tier !== currentProfileTier) {
      currentProfileTier = tier;
      currentProfile = lodProfileForTier(tier);
      if (presentations.size > 0) applyTier();
    }
    updateCamera();
  };

  const buildPresentation = (chunk: CompiledChunkV0): ChunkPresentation => {
    const profile = currentProfile;
    let culledFeatures = 0; let facades = 0;
    const screenAreaPx2 = (outer: readonly { x: number; y: number }[]): number => Math.abs(polygonArea(outer)) * viewScale() * viewScale();
    const ground = new Graphics();
    for (const area of chunk.ground) {
      if (profile.cullMinAreaPx2 > 0 && screenAreaPx2(area.area.outer) < profile.cullMinAreaPx2) { culledFeatures += 1; continue; }
      drawPolygon(ground, area.area, worldScale, 0, groundFill(area.styleKey.startsWith("water:") ? "water" : "land", styleClass(area.styleKey)));
    }
    const roadGroups = groupRoadsByStyleAndWidth(chunk.roads);
    const sidewalk = new Graphics();
    if (sidewalkEnabled(profile.roadDetail)) strokeRoadNetwork(sidewalk, roadGroups, worldScale, SIDEWALK_FILL, () => sidewalkPadPx(worldScale));
    const roadCasing = new Graphics();
    const roadSurface = new Graphics();
    if (profile.roadDetail !== "body") strokeRoadNetwork(roadCasing, roadGroups, worldScale, (group) => roadStyle(styleClass(group.styleKey)).casing, roadCasingPx);
    strokeRoadNetwork(roadSurface, roadGroups, worldScale, (group) => roadStyle(styleClass(group.styleKey)).fill, () => 0);
    const corridor = new Graphics();
    strokeRoadNetwork(corridor, roadGroups, worldScale, 0xffffff, roadCasingPx);
    const roadMarking = new Graphics();
    if (roadMarkingsEnabled(profile.roadDetail)) drawCenterDashes(roadMarking, roadGroups, worldScale, viewScale());
    const buildings = new Graphics();
    for (const building of sortBuildingsForPainter(chunk.buildings)) {
      if (profile.cullMinAreaPx2 > 0 && screenAreaPx2(building.roof.outer) < profile.cullMinAreaPx2) { culledFeatures += 1; continue; }
      const outer = building.roof.outer;
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      for (const point of outer) { bMinX = Math.min(bMinX, point.x); bMinY = Math.min(bMinY, point.y); bMaxX = Math.max(bMaxX, point.x); bMaxY = Math.max(bMaxY, point.y); }
      const bstyle = buildingStyle(styleClass(building.styleKey), positionSeed((bMinX + bMaxX) / 2, (bMinY + bMaxY) / 2));
      const depth = Math.min(24, Math.max(3, building.visualHeightMeters * worldScale * 0.6)) * profile.facadeStrength;
      if (depth > 0) facades += 1;
      if (depth > 0) {
        const offset = { x: -depth * 0.707, y: depth * 0.707 };
        const facade = {
          outer: outer.map((point) => ({ x: point.x + offset.x / worldScale, y: point.y + offset.y / worldScale })),
          holes: building.roof.holes.map((hole) => hole.map((point) => ({ x: point.x + offset.x / worldScale, y: point.y + offset.y / worldScale }))),
        };
        drawPolygon(buildings, facade, worldScale, depth, bstyle.facade);
      }
      drawPolygon(buildings, building.roof, worldScale, 0, bstyle.roof);
    }
    const labels = new Container();
    const roadOrder = chunk.roads.reduce((max, road) => Math.max(max, road.widthMeters), 0);
    const buildingOrder = chunk.buildings.reduce((max, building) => Math.max(max, buildingDepthKey(building)), 0);
    return { chunk, ground, sidewalk, roadCasing, roadSurface, corridor, roadMarking, buildings, labels, roadOrder, buildingOrder, culledFeatures, facades, hasRoadCasing: profile.roadDetail !== "body", hasSidewalk: sidewalkEnabled(profile.roadDetail), hasRoadMarkings: roadMarkingsEnabled(profile.roadDetail) };
  };

  const destroyPresentation = (entry: ChunkPresentation): void => {
    groundLayer.removeChild(entry.ground); sidewalkLayer.removeChild(entry.sidewalk); roadCasingLayer.removeChild(entry.roadCasing); roadSurfaceLayer.removeChild(entry.roadSurface);
    corridorLayer.removeChild(entry.corridor); roadMarkingLayer.removeChild(entry.roadMarking); buildingsLayer.removeChild(entry.buildings); labelLayer.removeChild(entry.labels);
    entry.ground.destroy({ children: true }); entry.sidewalk.destroy({ children: true }); entry.roadCasing.destroy({ children: true }); entry.roadSurface.destroy({ children: true });
    entry.corridor.destroy({ children: true }); entry.roadMarking.destroy({ children: true }); entry.buildings.destroy({ children: true }); entry.labels.destroy({ children: true });
  };

  const insertPresentation = (entry: ChunkPresentation): void => {
    entry.ground.zIndex = 0;
    entry.sidewalk.zIndex = entry.roadOrder;
    entry.roadCasing.zIndex = entry.roadOrder; entry.roadSurface.zIndex = entry.roadOrder;
    entry.roadMarking.zIndex = entry.roadOrder;
    entry.buildings.zIndex = entry.buildingOrder;
    groundLayer.addChild(entry.ground);
    sidewalkLayer.addChild(entry.sidewalk);
    roadCasingLayer.addChild(entry.roadCasing); roadSurfaceLayer.addChild(entry.roadSurface);
    corridorLayer.addChild(entry.corridor);
    roadMarkingLayer.addChild(entry.roadMarking);
    buildingsLayer.addChild(entry.buildings);
    labelLayer.addChild(entry.labels);
    groundLayer.sortChildren(); sidewalkLayer.sortChildren(); roadCasingLayer.sortChildren(); roadSurfaceLayer.sortChildren(); roadMarkingLayer.sortChildren(); buildingsLayer.sortChildren();
  };

  // Each label belongs to exactly one chunk, so the per-chunk containers are
  // the owners: no cross-presentation lookup, and every removed Text is
  // destroyed (a bare removeChildren would leak its texture resources).
  const clearLabelChildren = (entry: ChunkPresentation): void => {
    for (const child of entry.labels.removeChildren()) child.destroy();
  };
  const rebuildLabels = (): void => {
    for (const entry of presentations.values()) clearLabelChildren(entry);
    labelLayer.visible = presentation.labelsVisible;
    if (!presentation.labelsVisible) return;
    for (const entry of presentations.values()) {
      for (const label of visibleLabels(entry.chunk.labels, currentProfile)) {
        const text = new Text({ text: label.text, style: LABEL_TEXT_STYLE });
        text.anchor.set(0.5);
        text.position.set(label.position.x * worldScale, -label.position.y * worldScale);
        text.rotation = readableLabelAngle(label.angle);
        entry.labels.addChild(text);
      }
    }
  };

  const setChunk = (chunk: CompiledChunkV0): void => {
    if (disposed) return;
    const previous = presentations.get(chunk.id);
    if (previous?.chunk === chunk) return; // unchanged content keeps its resources
    if (previous) { presentations.delete(chunk.id); destroyPresentation(previous); }
    const entry = buildPresentation(chunk);
    presentations.set(chunk.id, entry);
    insertPresentation(entry);
    rebuildLabels();
  };

  return {
    app,
    render(input) {
      if (disposed) return;
      const chunks: readonly CompiledChunkV0[] = Array.isArray(input) ? input : [input];
      const unique = new Map(chunks.map((chunk) => [chunk.id, chunk]));
      if (unique.size !== chunks.length) throw new Error("Duplicate rendered chunk id");
      for (const chunkId of [...presentations.keys()]) if (!unique.has(chunkId)) setChunkRemoval(chunkId);
      for (const chunk of chunks) setChunk(chunk);
      updateCamera();
    },
    setChunk,
    removeChunk(chunkId) { if (!disposed) setChunkRemoval(chunkId); },
    presentationCounts() {
      return { chunkPresentations: presentations.size, graphicsObjects: presentations.size * 7 };
    },
    presentationDiagnostics() {
      let culledFeatures = 0; let facades = 0; let roadCasing = true; let sidewalks = true; let roadMarkings = true; let labels = 0;
      for (const entry of presentations.values()) {
        culledFeatures += entry.culledFeatures;
        facades += entry.facades;
        roadCasing = roadCasing && entry.hasRoadCasing;
        sidewalks = sidewalks && entry.hasSidewalk;
        roadMarkings = roadMarkings && entry.hasRoadMarkings;
        // The diagnostic reports the LOD-filtered label set, not the created
        // Text nodes: while labels are hidden no Text is allocated, but the
        // profiled count must stay stable for HUD/LOD inspection.
        labels += visibleLabels(entry.chunk.labels, currentProfile).length;
      }
      return { culledFeatures, facades, roadCasing, sidewalks, roadMarkings, labels };
    },
    setZoom(level) { if (disposed) return; changeZoom(clampZoom(level)); },
    zoomIn() { changeZoom(clampZoom(zoomLevel + 1)); return zoomLevel; },
    zoomOut() { changeZoom(clampZoom(zoomLevel - 1)); return zoomLevel; },
    cameraState() {
      const halfX = app.screen.width / viewScale() / 2;
      const halfY = app.screen.height / viewScale() / 2;
      return { zoomLevel, zoomFactor: zoomFactor(zoomLevel), bounds: { minX: position.x - halfX, maxX: position.x + halfX, minY: position.y - halfY, maxY: position.y + halfY } };
    },
    updateVehicle(nextPosition, heading, velocity) {
      if (disposed) return;
      position = { ...nextPosition };
      updateCamera();
      vehicle.position.set(position.x, -position.y);
      vehicle.rotation = -heading;
      // Subtle body flex into the drift: a small shear driven by the sideways
      // (lateral) velocity the physics produces when the car slides in a turn.
      // Zero when going straight, so the sprite is undistorted at rest.
      if (velocity) {
        const forward = { x: Math.cos(heading), y: Math.sin(heading) };
        const right = { x: -forward.y, y: forward.x };
        const lateral = velocity.x * right.x + velocity.y * right.y;
        vehicleBodyGroup.skew.x = Math.max(-0.08, Math.min(0.08, -lateral / 26));
        // The ground shadow slides a touch the other way so the body reads as
        // planted and leaning on the road instead of floating over it.
        vehicleShadow.position.x = Math.max(-width * 0.12, Math.min(width * 0.12, lateral * 0.06));
      } else {
        vehicleBodyGroup.skew.x = 0;
        vehicleShadow.position.x = 0;
      }
    },
    cameraBounds() { const halfX = app.screen.width / viewScale() / 2; const halfY = app.screen.height / viewScale() / 2; return { minX: position.x - halfX, maxX: position.x + halfX, minY: position.y - halfY, maxY: position.y + halfY }; },
    dispose() { if (disposed) return; disposed = true; presentations.clear(); app.ticker.remove(updateCamera); app.destroy(false, { children: true }); },
    toggleLabels() { presentation = toggleLabels(presentation); rebuildLabels(); return presentation.labelsVisible; },
  };

  function setChunkRemoval(chunkId: string): void {
    const entry = presentations.get(chunkId);
    if (!entry) return;
    presentations.delete(chunkId);
    destroyPresentation(entry);
    rebuildLabels();
  }
}
