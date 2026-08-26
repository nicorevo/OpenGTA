import RAPIER from "@dimforge/rapier2d-compat";
import type { CollisionShape2D } from "../../world/compiler/compiled.ts";
import { stepVehicle as stepArcadeVehicle, type VehicleInput, type VehicleState } from "../../gameplay/vehicle/controller.ts";
export interface PhysicsVehicleState extends VehicleState { readonly body: RAPIER.RigidBody; }
export interface PhysicsAdapter { readonly world: RAPIER.World; readonly colliderCount: () => number; createVehicle(initial: { x: number; y: number; heading: number }): PhysicsVehicleState; stepVehicle(state: PhysicsVehicleState, input: VehicleInput): PhysicsVehicleState; }
/**
 * Walls follow the footprint outline instead of its convex hull: a hull would
 * fill courtyards and street notches, blocking roads that are visibly free.
 */
function buildingWall(ring: readonly { readonly x: number; readonly y: number }[]): RAPIER.ColliderDesc | undefined {
  if (ring.length < 3) return undefined;
  const closed = [...ring, ring[0]];
  return RAPIER.ColliderDesc.polyline(new Float32Array(closed.flatMap((point) => [point.x, point.y])));
}

function segmentCollider(shape: Extract<CollisionShape2D, { kind: "segment" }>): RAPIER.ColliderDesc | undefined {
  const length = Math.hypot(shape.b.x - shape.a.x, shape.b.y - shape.a.y);
  if (!Number.isFinite(length) || length === 0) return undefined;
  const center = { x: (shape.a.x + shape.b.x) / 2, y: (shape.a.y + shape.b.y) / 2 };
  const thickness = shape.thicknessMeters ?? 0;
  if (thickness > 0) {
    const radius = thickness / 2;
    return RAPIER.ColliderDesc.capsule(Math.max(0, length / 2 - radius), radius)
      .setTranslation(center.x, center.y)
      .setRotation(Math.atan2(shape.b.y - shape.a.y, shape.b.x - shape.a.x) - Math.PI / 2);
  }
  return RAPIER.ColliderDesc.polyline(new Float32Array([shape.a.x, shape.a.y, shape.b.x, shape.b.y]));
}

export async function createPhysicsAdapter(shapes: readonly CollisionShape2D[]): Promise<PhysicsAdapter> { await RAPIER.init(); const world = new RAPIER.World({ x: 0, y: 0 }); const staticBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed()); for (const shape of shapes) { if (shape.kind === "polygon") { for (const ring of [shape.polygon.outer, ...shape.polygon.holes]) { const wall = buildingWall(ring); if (wall) world.createCollider(wall, staticBody); } } else if (shape.kind === "segment") { const collider = segmentCollider(shape); if (collider) world.createCollider(collider, staticBody); } else if (Number.isFinite(shape.radiusMeters) && shape.radiusMeters > 0) world.createCollider(RAPIER.ColliderDesc.ball(shape.radiusMeters).setTranslation(shape.center.x, shape.center.y), staticBody); }
  return { world, colliderCount: () => world.colliders.len(), createVehicle(initial) { const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(initial.x, initial.y).setRotation(initial.heading).setCcdEnabled(true)); world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.82).setFriction(0.8).setRestitution(0), body); return { body, position: { x: initial.x, y: initial.y }, velocity: { x: 0, y: 0 }, heading: initial.heading }; }, stepVehicle(state, input) { const desired = stepArcadeVehicle(state, input); state.body.setLinvel(desired.velocity, true); state.body.setRotation(desired.heading, true); world.timestep = 1 / 60; world.step(); const position = state.body.translation(); const velocity = state.body.linvel(); return { body: state.body, position: { x: position.x, y: position.y }, velocity: { x: velocity.x, y: velocity.y }, heading: state.body.rotation() }; } };
}
