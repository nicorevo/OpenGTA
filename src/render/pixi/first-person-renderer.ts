import { Application, Graphics, Container, Text } from "pixi.js";
import type { CompiledChunkV0 } from "../../world/compiler/compiled.ts";
import type { Vec2 } from "../../world/model/types.ts";
import { projectRoadPolygon, type ProjectedRoadPolygon } from "./first-person/road-projector.ts";
import { projectBuildings, type BuildingInput, type ProjectedBuildingBox } from "./first-person/building-projector.ts";
import { DEFAULT_CAMERA_CONFIG } from "./first-person/camera3d.ts";

export interface FirstPersonRenderer {
  readonly app: Application;
  render(chunks: CompiledChunkV0 | readonly CompiledChunkV0[]): void;
  updateVehicle(position: Vec2, heading: number): void;
  cameraState(): { position: Vec2; heading: number };
  diagnostics(): { chunks: number; roadItems: number; buildingItems: number };
  dispose(): void;
}

/** True perspective: the horizon (NDC sy = 0) sits at mid-screen. */
const HORIZON_RATIO = 0.5;
const GROUND_FILL = 0x8b9d70;
export const ROAD_FILL = 0x53515a;
const ROAD_EDGE = 0x302e38;
const SKY_TOP_COLOR = 0x1a3a5c;
const SKY_HORIZON_COLOR = 0x87ceeb;
const NDC_CLAMP = 16;
/** Road polygons nearer than this (meters) get their curb edge stroked. */
const NEAR_STROKE_DEPTH = 60;

/** Map normalized device coordinates to canvas pixels. */
export function ndcToScreen(sx: number, sy: number, width: number, height: number): { x: number; y: number } {
  return { x: ((sx + 1) / 2) * width, y: ((sy + 1) / 2) * height };
}

function drawSky(graphics: Graphics, w: number, h: number): void {
  graphics.clear();
  const horizonY = h * HORIZON_RATIO;
  const halfHorizon = horizonY * 0.5;
  graphics.poly([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: halfHorizon }, { x: 0, y: halfHorizon }]).fill(SKY_TOP_COLOR);
  graphics.poly([{ x: 0, y: halfHorizon }, { x: w, y: halfHorizon }, { x: w, y: horizonY }, { x: 0, y: horizonY }]).fill(SKY_HORIZON_COLOR);
}

type ScreenPoint = { x: number; y: number };

type DrawItem =
  | { kind: "road"; depth: number; points: ScreenPoint[] }
  | { kind: "building"; depth: number; parts: { points: ScreenPoint[]; fill: number }[] };

export function toRoadDrawItem(poly: ProjectedRoadPolygon, w: number, h: number): DrawItem {
  return { kind: "road", depth: poly.depth, points: poly.points.map((p) => ndcToScreen(p.sx, p.sy, w, h)) };
}

export function toBuildingDrawItem(projected: ProjectedBuildingBox, w: number, h: number): DrawItem {
  const toScreen = (quad: readonly { sx: number; sy: number }[]): ScreenPoint[] => quad.map((p) => ndcToScreen(p.sx, p.sy, w, h));
  return {
    kind: "building",
    depth: projected.depth,
    parts: [
      ...projected.walls.map((wall) => ({ points: toScreen(wall), fill: projected.color })),
      { points: toScreen(projected.roof), fill: projected.roofColor },
    ],
  };
}

/** Builds the FP debug overlay line; the renderer re-assigns the Text only when it changes. */
export function firstPersonDebugLine(input: {
  camX: number;
  camY: number;
  headingRad: number;
  chunks: number;
  roads: number;
  buildings: number;
  roadItems: number;
  buildingItems: number;
}): string {
  return `FPV | cam:${input.camX.toFixed(0)},${input.camY.toFixed(0)} | heading:${(input.headingRad * 180 / Math.PI).toFixed(0)}deg | chunks:${input.chunks} roads:${input.roads} bldgs:${input.buildings} proj:${input.roadItems}/${input.buildingItems}`;
}

export async function createFirstPersonRenderer(canvas: HTMLCanvasElement): Promise<FirstPersonRenderer> {
  const app = new Application();
  await app.init({ canvas, background: 0x00000000, antialias: true, preference: "webgl", resizeTo: canvas.parentElement ?? window });

  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  const skyGraphics = new Graphics();
  const renderGraphics = new Graphics();
  const debugGraphics = new Graphics();
  const debugTextStyle = new Text({
    text: "",
    style: {
      fontFamily: "monospace",
      fontSize: 11,
      fill: "#ff0000",
      dropShadow: true,
    },
  });
  worldContainer.addChild(skyGraphics, renderGraphics, debugGraphics, debugTextStyle);
  debugTextStyle.anchor.set(0, 0);
  debugTextStyle.x = 8;
  debugTextStyle.y = 8;

  let vehiclePos: Vec2 = { x: 0, y: 0 };
  let vehicleHeading = 0;
  let lastDiagnostics = { chunks: 0, roadItems: 0, buildingItems: 0 };
  let lastDebugMsg = "";

  const renderScene = (chunks: readonly CompiledChunkV0[]): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    if (w === 0 || h === 0) return;

    const horizonY = h * HORIZON_RATIO;

    drawSky(skyGraphics, w, h);

    const allRoads: { centerline: readonly Vec2[]; widthMeters: number }[] = [];
    const allBuildings: BuildingInput[] = [];

    for (const chunk of chunks) {
      for (const road of chunk.roads) {
        allRoads.push({ centerline: road.centerline, widthMeters: road.widthMeters });
      }
      for (const building of chunk.buildings) {
        const roof = building.roof;
        if (roof.outer.length < 3) continue;
        allBuildings.push({
          footprint: roof.outer,
          heightMeters: building.visualHeightMeters,
          isHistoric: building.styleKey.includes("historic"),
        });
      }
    }

    const camPos = { x: vehiclePos.x, y: vehiclePos.y };

    const items: DrawItem[] = [];
    for (const road of allRoads) {
      const poly = projectRoadPolygon(road.centerline, road.widthMeters, camPos, vehicleHeading, DEFAULT_CAMERA_CONFIG);
      if (poly) items.push(toRoadDrawItem(poly, w, h));
    }
    for (const projected of projectBuildings(allBuildings, camPos, vehicleHeading)) {
      items.push(toBuildingDrawItem(projected, w, h));
    }

    // Painter's order: farthest (largest nearest-depth) first.
    items.sort((a, b) => b.depth - a.depth);

    renderGraphics.clear();
    renderGraphics.poly([
      { x: 0, y: horizonY },
      { x: w, y: horizonY },
      { x: w, y: h },
      { x: 0, y: h },
    ]).fill(GROUND_FILL);
    for (const item of items) {
      if (item.kind === "road") {
        renderGraphics.poly(item.points).fill(ROAD_FILL);
        if (item.depth <= NEAR_STROKE_DEPTH) {
          renderGraphics.poly(item.points).stroke({ color: ROAD_EDGE, width: Math.max(1, w * 0.0008) });
        }
      } else {
        for (const part of item.parts) {
          renderGraphics.poly(part.points).fill(part.fill);
        }
      }
    }

    debugGraphics.clear();
    const roadCount = allRoads.length;
    const buildingCount = allBuildings.length;
    const roadItemCount = items.filter((i) => i.kind === "road").length;
    const buildingItemCount = items.filter((i) => i.kind !== "road").length;
    lastDiagnostics = { chunks: chunks.length, roadItems: roadItemCount, buildingItems: buildingItemCount };
    const debugMsg = firstPersonDebugLine({
      camX: camPos.x,
      camY: camPos.y,
      headingRad: vehicleHeading,
      chunks: chunks.length,
      roads: roadCount,
      buildings: buildingCount,
      roadItems: roadItemCount,
      buildingItems: buildingItemCount,
    });
    if (debugMsg !== lastDebugMsg) {
      lastDebugMsg = debugMsg;
      debugTextStyle.text = debugMsg;
    }
  };

  return {
    app,
    render(chunks) {
      const arr = Array.isArray(chunks) ? chunks : [chunks];
      renderScene(arr);
    },
    updateVehicle(position, heading) {
      vehiclePos = { ...position };
      vehicleHeading = heading;
    },
    cameraState() {
      return { position: { ...vehiclePos }, heading: vehicleHeading };
    },
    diagnostics() {
      return { ...lastDiagnostics };
    },
    dispose() {
      app.destroy(false, { children: true });
    },
  };
}
