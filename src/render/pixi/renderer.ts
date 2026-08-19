import { Application, Container, Graphics, Text } from "pixi.js";
import type { CompiledChunkV0, CompiledLabel } from "../../world/compiler/compiled.ts";
import { createPresentationState, toggleLabels, type PresentationState } from "./presentation.ts";

export interface PixiRenderer { readonly app: Application; render(chunk: CompiledChunkV0): void; updateVehicle(position: { x: number; y: number }, heading: number): void; toggleLabels(): boolean; }
const VEHICLE_LENGTH_METERS = 4.2;
const VEHICLE_WIDTH_METERS = 1.8;
const VEHICLE_VISUAL_SCALE = 2.6;

function drawPolygon(graphics: Graphics, points: readonly { x: number; y: number }[], scale: number, height: number, color: number): void { if (points.length < 3) return; graphics.poly(points.map((point) => ({ x: point.x * scale, y: -point.y * scale }))); graphics.fill(color); if (height > 0) graphics.stroke({ color: 0x27232c, width: 1 }); }
function readableLabelAngle(angle: number): number { let result = -angle; if (result > Math.PI / 2) result -= Math.PI; if (result < -Math.PI / 2) result += Math.PI; return result; }
function visibleLabels(labels: readonly CompiledLabel[]): CompiledLabel[] { const places = labels.filter((label) => label.kind === "place").slice(0, 16); const roads = labels.filter((label) => label.kind === "road").slice(0, 16); return [...places, ...roads]; }

export async function createPixiRenderer(canvas: HTMLCanvasElement): Promise<PixiRenderer> {
  const app = new Application();
  await app.init({ canvas, background: 0x91a477, antialias: true, preference: "webgl", resizeTo: canvas.parentElement ?? window });
  const world = new Container(); app.stage.addChild(world); let vehicle: Graphics | undefined; let worldScale = 1;
  let presentation: PresentationState = createPresentationState();
  let labelLayer: Container | undefined;
  return {
    app,
    render(chunk) {
      world.removeChildren().forEach((child) => child.destroy());
      worldScale = Math.min(app.screen.width, app.screen.height) / 360;
      world.position.set(app.screen.width / 2, app.screen.height / 2);
      const ground = new Graphics();
      chunk.ground.forEach((area) => drawPolygon(ground, area.area.outer, worldScale, 0, area.styleKey.includes("park") ? 0x70915a : 0x8b9d70));
      world.addChild(ground);
      const roads = new Graphics();
      chunk.roads.forEach((road) => {
        drawPolygon(roads, road.surface.outer, worldScale, 0, 0x53515a);
        roads.poly(road.surface.outer.map((point) => ({ x: point.x * worldScale, y: -point.y * worldScale }))).stroke({ color: 0x302e38, width: Math.max(1, worldScale * 0.9) });
      });
      world.addChild(roads);
      const buildings = new Graphics();
      for (const building of chunk.buildings) {
        const depth = Math.min(24, Math.max(3, building.visualHeightMeters * worldScale * 0.6));
        const offset = { x: -depth * 0.707, y: depth * 0.707 };
        const facade = building.roof.outer.map((point) => ({ x: point.x + offset.x / worldScale, y: point.y + offset.y / worldScale }));
        drawPolygon(buildings, facade, worldScale, depth, 0x806c61);
        drawPolygon(buildings, building.roof.outer, worldScale, 0, building.styleKey.includes("historic") ? 0xa86f5d : 0xb18d77);
      }
      world.addChild(buildings);
      labelLayer = new Container();
      for (const label of visibleLabels(chunk.labels)) {
        const text = new Text({ text: label.text, style: { fontFamily: "Arial", fontSize: label.kind === "place" ? 11 : 9, fontWeight: "bold", fill: label.kind === "place" ? 0x2d2928 : 0xf3e7c6 } });
        text.anchor.set(0.5); text.position.set(label.position.x * worldScale, -label.position.y * worldScale); text.rotation = readableLabelAngle(label.angle); labelLayer.addChild(text);
      }
      labelLayer.visible = presentation.labelsVisible;
      world.addChild(labelLayer);
      const length = VEHICLE_LENGTH_METERS * worldScale * VEHICLE_VISUAL_SCALE; const width = VEHICLE_WIDTH_METERS * worldScale * VEHICLE_VISUAL_SCALE;
      vehicle = new Graphics(); vehicle.roundRect(-length / 2, -width / 2, length, width, width * 0.2); vehicle.fill(0xd1495b); vehicle.moveTo(length / 2, 0); vehicle.lineTo(length / 2 - width * 0.35, -width * 0.35); vehicle.lineTo(length / 2 - width * 0.35, width * 0.35); vehicle.closePath(); vehicle.fill(0xf6bd60); vehicle.stroke({ color: 0x8c2636, width: Math.max(0.5, worldScale * 0.6) }); world.addChild(vehicle);
    },
    updateVehicle(position, heading) { if (!vehicle) return; world.position.set(app.screen.width / 2 - position.x * worldScale, app.screen.height / 2 + position.y * worldScale); vehicle.position.set(position.x * worldScale, -position.y * worldScale); vehicle.rotation = -heading; },
    toggleLabels() { presentation = toggleLabels(presentation); if (labelLayer) labelLayer.visible = presentation.labelsVisible; return presentation.labelsVisible; },
  };
}
