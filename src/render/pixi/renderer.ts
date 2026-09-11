import { Application, Container, Graphics, Text } from "pixi.js";
import type { CompiledChunkV0, CompiledLabel } from "../../world/compiler/compiled.ts";
import type { Bounds2D, Polygon2D } from "../../world/model/types.ts";
import { createPresentationState, toggleLabels, type PresentationState } from "./presentation.ts";
import { groupRoadsByWidth, sortBuildingsForPainter, type RoadStrokeGroup } from "./scene-order.ts";

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
  updateVehicle(position: { x: number; y: number }, heading: number): void;
  toggleLabels(): boolean;
  cameraBounds(): Bounds2D;
  dispose(): void;
}
const VEHICLE_LENGTH_METERS = 4.2;
const VEHICLE_WIDTH_METERS = 1.8;
const VEHICLE_VISUAL_SCALE = 2.6;
const ROAD_FILL = 0x53515a;
const ROAD_EDGE = 0x302e38;
const ROAD_CASING_MIN_PX = 0.75;
const ROAD_CASING_MAX_PX = 2.5;
const ROAD_CASING_RATIO = 0.12;

/** Keeps the asphalt readable: a fixed casing would swallow narrow alleys. */
function roadCasingPx(roadPx: number): number { return Math.min(ROAD_CASING_MAX_PX, Math.max(ROAD_CASING_MIN_PX, roadPx * ROAD_CASING_RATIO)); }

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
function strokeRoadNetwork(graphics: Graphics, groups: readonly RoadStrokeGroup<CompiledRoad>[], scale: number, color: number, padPx: (roadPx: number) => number): void {
  for (const group of groups) {
    const roadPx = Math.max(1, group.widthMeters * scale);
    queueCenterlines(graphics, group.roads, scale);
    graphics.stroke({ color, width: roadPx + padPx(roadPx) * 2, cap: "round", join: "round" });
  }
}
function readableLabelAngle(angle: number): number { let result = -angle; if (result > Math.PI / 2) result -= Math.PI; if (result < -Math.PI / 2) result += Math.PI; return result; }
function visibleLabels(labels: readonly CompiledLabel[]): CompiledLabel[] { const places = labels.filter((label) => label.kind === "place").slice(0, 16); const roads = labels.filter((label) => label.kind === "road").slice(0, 16); return [...places, ...roads]; }

type CompiledBuilding = CompiledChunkV0["buildings"][number];
function buildingDepthKey(building: CompiledBuilding): number {
  const points = building.roof.outer;
  if (points.length === 0) return 0;
  let sum = 0;
  for (const point of points) sum += point.y - point.x;
  return sum / points.length;
}

interface ChunkPresentation {
  readonly chunk: CompiledChunkV0;
  readonly ground: Graphics;
  readonly roadCasing: Graphics;
  readonly roadSurface: Graphics;
  readonly corridor: Graphics;
  readonly buildings: Graphics;
  readonly labels: Container;
  // Order keys reproduce the global painter order across chunk containers:
  // wide roads and south-east buildings paint later, matching scene-order.ts.
  readonly roadOrder: number;
  readonly buildingOrder: number;
}

export async function createPixiRenderer(canvas: HTMLCanvasElement): Promise<PixiRenderer> {
  const app = new Application();
  await app.init({ canvas, background: 0x91a477, antialias: true, preference: "webgl", resizeTo: canvas.parentElement ?? window });
  const world = new Container(); app.stage.addChild(world);
  const staticLayer = new Container(); world.addChild(staticLayer);
  // Layer containers preserve the global order ground < road casing < road
  // surface < corridor mask < buildings < labels; per-chunk children inside
  // each layer are zIndexed by their painter key so add/remove stays local.
  const groundLayer = new Container(); groundLayer.sortableChildren = true;
  const roadCasingLayer = new Container(); roadCasingLayer.sortableChildren = true;
  const roadSurfaceLayer = new Container(); roadSurfaceLayer.sortableChildren = true;
  const corridorLayer = new Container();
  const buildingsLayer = new Container(); buildingsLayer.sortableChildren = true;
  buildingsLayer.setMask({ mask: corridorLayer, inverse: true });
  const labelLayer = new Container();
  staticLayer.addChild(groundLayer, roadCasingLayer, roadSurfaceLayer, corridorLayer, buildingsLayer, labelLayer);
  const worldScale = 1;
  const length = VEHICLE_LENGTH_METERS * VEHICLE_VISUAL_SCALE;
  const width = VEHICLE_WIDTH_METERS * VEHICLE_VISUAL_SCALE;
  const vehicle = new Graphics();
  vehicle.roundRect(-length / 2, -width / 2, length, width, width * 0.2).fill(0xd1495b);
  vehicle.moveTo(length / 2, 0).lineTo(length / 2 - width * 0.35, -width * 0.35).lineTo(length / 2 - width * 0.35, width * 0.35).closePath().fill(0xf6bd60).stroke({ color: 0x8c2636, width: 0.6 });
  world.addChild(vehicle);
  const presentations = new Map<string, ChunkPresentation>();
  let disposed = false;
  let position = { x: 0, y: 0 };
  const viewScale = () => Math.max(1, Math.min(app.screen.width, app.screen.height)) / 360;
  const updateCamera = () => {
    const scale = viewScale(); world.scale.set(scale);
    world.position.set(app.screen.width / 2 - position.x * scale, app.screen.height / 2 + position.y * scale);
  };
  app.ticker.add(updateCamera);
  let presentation: PresentationState = createPresentationState();

  const buildPresentation = (chunk: CompiledChunkV0): ChunkPresentation => {
    const ground = new Graphics();
    chunk.ground.forEach((area) => drawPolygon(ground, area.area, worldScale, 0, area.styleKey.startsWith("water:") ? 0x668ca3 : area.styleKey.includes("park") ? 0x70915a : 0x8b9d70));
    const roadGroups = groupRoadsByWidth(chunk.roads);
    const roadCasing = new Graphics();
    const roadSurface = new Graphics();
    strokeRoadNetwork(roadCasing, roadGroups, worldScale, ROAD_EDGE, roadCasingPx);
    strokeRoadNetwork(roadSurface, roadGroups, worldScale, ROAD_FILL, () => 0);
    const corridor = new Graphics();
    strokeRoadNetwork(corridor, roadGroups, worldScale, 0xffffff, roadCasingPx);
    const buildings = new Graphics();
    for (const building of sortBuildingsForPainter(chunk.buildings)) {
      const depth = Math.min(24, Math.max(3, building.visualHeightMeters * worldScale * 0.6));
      const offset = { x: -depth * 0.707, y: depth * 0.707 };
      const facade = {
        outer: building.roof.outer.map((point) => ({ x: point.x + offset.x / worldScale, y: point.y + offset.y / worldScale })),
        holes: building.roof.holes.map((hole) => hole.map((point) => ({ x: point.x + offset.x / worldScale, y: point.y + offset.y / worldScale }))),
      };
      drawPolygon(buildings, facade, worldScale, depth, 0x806c61);
      drawPolygon(buildings, building.roof, worldScale, 0, building.styleKey.includes("historic") ? 0xa86f5d : 0xb18d77);
    }
    const labels = new Container();
    const roadOrder = chunk.roads.reduce((max, road) => Math.max(max, road.widthMeters), 0);
    const buildingOrder = chunk.buildings.reduce((max, building) => Math.max(max, buildingDepthKey(building)), 0);
    return { chunk, ground, roadCasing, roadSurface, corridor, buildings, labels, roadOrder, buildingOrder };
  };

  const destroyPresentation = (entry: ChunkPresentation): void => {
    groundLayer.removeChild(entry.ground); roadCasingLayer.removeChild(entry.roadCasing); roadSurfaceLayer.removeChild(entry.roadSurface);
    corridorLayer.removeChild(entry.corridor); buildingsLayer.removeChild(entry.buildings); labelLayer.removeChild(entry.labels);
    entry.ground.destroy({ children: true }); entry.roadCasing.destroy({ children: true }); entry.roadSurface.destroy({ children: true });
    entry.corridor.destroy({ children: true }); entry.buildings.destroy({ children: true }); entry.labels.destroy({ children: true });
  };

  const insertPresentation = (entry: ChunkPresentation): void => {
    entry.ground.zIndex = 0;
    entry.roadCasing.zIndex = entry.roadOrder; entry.roadSurface.zIndex = entry.roadOrder;
    entry.buildings.zIndex = entry.buildingOrder;
    groundLayer.addChild(entry.ground);
    roadCasingLayer.addChild(entry.roadCasing); roadSurfaceLayer.addChild(entry.roadSurface);
    corridorLayer.addChild(entry.corridor);
    buildingsLayer.addChild(entry.buildings);
    labelLayer.addChild(entry.labels);
    groundLayer.sortChildren(); roadCasingLayer.sortChildren(); roadSurfaceLayer.sortChildren(); buildingsLayer.sortChildren();
  };

  const rebuildLabels = (): void => {
    labelLayer.removeChildren();
    const chunks = [...presentations.values()].map((entry) => entry.chunk);
    const labels = visibleLabels(chunks.flatMap((chunk) => chunk.labels));
    for (const entry of presentations.values()) entry.labels.removeChildren();
    for (const label of labels) {
      const owner = [...presentations.values()].find((entry) => entry.chunk.labels.includes(label));
      if (!owner) continue;
      const text = new Text({ text: label.text, style: { fontFamily: "Arial", fontSize: label.kind === "place" ? 11 : 9, fontWeight: "bold", fill: label.kind === "place" ? 0x2d2928 : 0xf3e7c6 } });
      text.anchor.set(0.5); text.position.set(label.position.x * worldScale, -label.position.y * worldScale); text.rotation = readableLabelAngle(label.angle); owner.labels.addChild(text);
    }
    labelLayer.visible = presentation.labelsVisible;
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
      return { chunkPresentations: presentations.size, graphicsObjects: presentations.size * 5 };
    },
    updateVehicle(nextPosition, heading) { if (disposed) return; position = { ...nextPosition }; updateCamera(); vehicle.position.set(position.x, -position.y); vehicle.rotation = -heading; },
    cameraBounds() { const halfX = app.screen.width / viewScale() / 2; const halfY = app.screen.height / viewScale() / 2; return { minX: position.x - halfX, maxX: position.x + halfX, minY: position.y - halfY, maxY: position.y + halfY }; },
    dispose() { if (disposed) return; disposed = true; presentations.clear(); app.ticker.remove(updateCamera); app.destroy(false, { children: true }); },
    toggleLabels() { presentation = toggleLabels(presentation); labelLayer.visible = presentation.labelsVisible; return presentation.labelsVisible; },
  };

  function setChunkRemoval(chunkId: string): void {
    const entry = presentations.get(chunkId);
    if (!entry) return;
    presentations.delete(chunkId);
    destroyPresentation(entry);
    rebuildLabels();
  }
}
