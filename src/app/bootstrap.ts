import rawFixture from "../fixtures/geo/lecce-sant-oronzo-v0.raw.json";
import { createTangentProjector } from "../geo/coordinates/projector.ts";
import { normalizeOsm } from "../geo/normalize/osm.ts";
import { compileRegion } from "../world/compiler/compiled.ts";
import { createPixiRenderer } from "../render/pixi/renderer.ts";
import { createPhysicsAdapter } from "../physics/rapier/adapter.ts";

export async function bootstrap(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-label", "OpenGTA Web V0 world"); canvas.style.width = "100%"; canvas.style.height = "100%";
  const overlay = document.createElement("pre"); overlay.hidden = true; overlay.id = "debug-overlay";
  const hint = document.createElement("p"); hint.textContent = "Press F3 for diagnostics · © OpenStreetMap contributors";
  root.append(canvas, overlay, hint); root.style.cssText = "position:fixed;inset:0;background:#17202a;color:#fff;font:14px monospace;overflow:hidden"; canvas.style.display = "block"; hint.style.cssText = "position:fixed;bottom:8px;left:12px;margin:0;color:#fff8"; overlay.style.cssText = "position:fixed;top:8px;left:8px;margin:0;padding:8px;background:#111c;color:#fff;z-index:2";
  const origin = { latitude: 40.35316888888889, longitude: 18.17259 }; const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, "lecce-sant-oronzo-v0"); const result = compileRegion(region); const physics = await createPhysicsAdapter(result.chunks[0].collisions); const renderer = await createPixiRenderer(canvas); renderer.render(result.chunks[0]);
  const keys = new Set<string>(); let vehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 }); window.addEventListener("keydown", (event) => { keys.add(event.key.toLowerCase()); if (event.key === "F3") { overlay.hidden = !overlay.hidden; overlay.textContent = `region: ${region.id}\nbuildings: ${region.buildings.length}\nroads: ${region.roads.length}\ncompiled: ${result.diagnostics.compiledFeatureCount}\nphysics colliders: ${physics.colliderCount()}\nwarnings: ${region.warnings.length + result.diagnostics.warnings.length}\nrenderer: PixiJS WebGL`; } }); window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase())); let last = performance.now(); const frame = (now: number) => { const dt = Math.min(0.25, (now - last) / 1000); last = now; vehicle = physics.stepVehicle(vehicle, { throttle: keys.has("w") || keys.has("arrowup") ? 1 : keys.has("s") || keys.has("arrowdown") ? -1 : 0, steer: keys.has("a") || keys.has("arrowleft") ? -1 : keys.has("d") || keys.has("arrowright") ? 1 : 0, brake: keys.has(" ") ? 1 : 0 }); renderer.updateVehicle(vehicle.position, vehicle.heading); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
}
