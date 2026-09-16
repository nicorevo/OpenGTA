import { Application, Graphics, Container, Text } from "pixi.js";
import type { CompiledChunkV0 } from "../../world/compiler/compiled.ts";
import type { Vec2 } from "../../world/model/types.ts";
import { projectRoadSegments, type RoadSegment } from "./first-person/road-projector.ts";
import { projectBuildings, type BuildingInput, type ProjectedBuilding } from "./first-person/building-projector.ts";
import { DEFAULT_CAMERA_CONFIG } from "./first-person/camera3d.ts";

export interface FirstPersonRenderer {
  readonly app: Application;
  render(chunks: CompiledChunkV0 | readonly CompiledChunkV0[]): void;
  updateVehicle(position: Vec2, heading: number): void;
  cameraState(): { position: Vec2; heading: number };
  dispose(): void;
}

const HORIZON_RATIO = 0.35;
const GROUND_FILL = 0x8b9d70;
export const ROAD_FILL = 0x53515a;
const ROAD_EDGE = 0x302e38;
const SKY_TOP_COLOR = 0x1a3a5c;
const SKY_HORIZON_COLOR = 0x87ceeb;
const STROKED_SEGMENT_COUNT = 3;

interface DepthItem {
  depth: number;
  pixelYBottom: number;
  pixelXLeft: number;
  pixelXRight: number;
  pixelYTop: number;
  fill: number | null;
  stroke: number | null;
}

export function toRoadDepthItems(segments: readonly RoadSegment[]): DepthItem[] {
  return segments.map((seg, i) => ({
    depth: seg.worldZ,
    pixelYBottom: seg.screenY,
    pixelXLeft: seg.leftScreenX,
    pixelXRight: seg.rightScreenX,
    pixelYTop: i === 0 ? 0 : segments[i - 1].screenY,
    fill: ROAD_FILL,
    stroke: i >= segments.length - STROKED_SEGMENT_COUNT ? ROAD_EDGE : null,
  }));
}

export function toBuildingDepthItems(projected: readonly ProjectedBuilding[]): DepthItem[] {
  return projected.map((b) => ({
    depth: b.worldZ,
    pixelYBottom: b.screenPoints[1],
    pixelXLeft: (b.screenPoints[0] + 1) / 2,
    pixelXRight: (b.screenPoints[2] + 1) / 2,
    pixelYTop: b.screenPoints[5],
    fill: b.color,
    stroke: null,
  }));
}

export function extendNearestRoadToBottom(items: DepthItem[]): void {
  let nearest: DepthItem | null = null;
  for (const item of items) {
    if (item.fill !== ROAD_FILL) continue;
    if (nearest === null || item.depth < nearest.depth) nearest = item;
  }
  if (nearest) nearest.pixelYBottom = 1;
}

function drawSky(graphics: Graphics, w: number, h: number): void {
  graphics.clear();
  const horizonY = h * HORIZON_RATIO;
  const halfHorizon = horizonY * 0.5;
  graphics.poly([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: halfHorizon }, { x: 0, y: halfHorizon }]).fill(SKY_TOP_COLOR);
  graphics.poly([{ x: 0, y: halfHorizon }, { x: w, y: halfHorizon }, { x: w, y: horizonY }, { x: 0, y: horizonY }]).fill(SKY_HORIZON_COLOR);
}

export function createFirstPersonRenderer(canvas: HTMLCanvasElement): FirstPersonRenderer {
  const app = new Application();
  app.init({ canvas, background: 0x00000000, antialias: true, preference: "webgl", resizeTo: canvas.parentElement ?? window });

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

  const renderScene = (chunks: readonly CompiledChunkV0[]): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    if (w === 0 || h === 0) return;

    const horizonY = h * HORIZON_RATIO;
    const groundHeight = h - horizonY;

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

    const items: DepthItem[] = [];
    for (const road of allRoads) {
      const segments = projectRoadSegments(road.centerline, road.widthMeters, camPos, vehicleHeading, DEFAULT_CAMERA_CONFIG);
      items.push(...toRoadDepthItems(segments));
    }
    items.push(...toBuildingDepthItems(projectBuildings(allBuildings, camPos, vehicleHeading)));

    items.sort((a, b) => b.depth - a.depth);
    extendNearestRoadToBottom(items);

    renderGraphics.clear();
    renderGraphics.poly([
      { x: 0, y: horizonY },
      { x: w, y: horizonY },
      { x: w, y: h },
      { x: 0, y: h },
    ]).fill(GROUND_FILL);
    for (const item of items) {
      const yBottom = horizonY + item.pixelYBottom * groundHeight;
      const yTop = horizonY + item.pixelYTop * groundHeight;
      const xLeft = item.pixelXLeft * w;
      const xRight = item.pixelXRight * w;

      if (item.fill !== null) {
        renderGraphics.poly([
          { x: xLeft, y: yBottom },
          { x: xRight, y: yBottom },
          { x: xRight, y: yTop },
          { x: xLeft, y: yTop },
        ]).fill(item.fill);
      }
      if (item.stroke !== null) {
        renderGraphics.poly([{ x: xLeft, y: yBottom }, { x: xLeft, y: yTop }]).stroke({ color: item.stroke, width: Math.max(1, w * 0.002) });
        renderGraphics.poly([{ x: xRight, y: yBottom }, { x: xRight, y: yTop }]).stroke({ color: item.stroke, width: Math.max(1, w * 0.002) });
      }
    }

    debugGraphics.clear();
    const roadCount = allRoads.length;
    const buildingCount = allBuildings.length;
    const projectedCount = items.filter((i) => i.fill === ROAD_FILL).length;
    const buildingProjectedCount = items.filter((i) => i.fill !== ROAD_FILL).length;
    const debugMsg = `FPV | cam:${camPos.x.toFixed(0)},${camPos.y.toFixed(0)} | heading:${(vehicleHeading * 180 / Math.PI).toFixed(0)}deg | chunks:${chunks.length} roads:${roadCount} bldgs:${buildingCount} proj:${projectedCount}/${buildingProjectedCount}`;
    debugTextStyle.text = debugMsg;
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
    dispose() {
      app.destroy(false, { children: true });
    },
  };
}
