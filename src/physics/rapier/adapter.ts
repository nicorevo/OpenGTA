import RAPIER from "@dimforge/rapier2d-compat";
import type { CollisionShape2D } from "../../world/compiler/compiled.ts";
import { stepVehicle as stepArcadeVehicle, type VehicleInput, type VehicleState } from "../../gameplay/vehicle/controller.ts";
import { VEHICLE_HALF_LENGTH, VEHICLE_HALF_WIDTH, type VehiclePose } from "../../gameplay/vehicle/shape.ts";
export interface PhysicsVehicleState extends VehicleState { readonly body: RAPIER.RigidBody; }
export interface PhysicsAdapter {
  readonly world: RAPIER.World;
  readonly colliderCount: () => number;
  setChunk(id: string, shapes: readonly CollisionShape2D[]): void;
  removeChunk(id: string): void;
  isPoseFree(pose: VehiclePose): boolean;
  dispose(): void;
  createVehicle(initial: { x: number; y: number; heading: number }): PhysicsVehicleState;
  stepVehicle(state: PhysicsVehicleState, input: VehicleInput): PhysicsVehicleState;
}
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

export async function createPhysicsAdapter(shapes: readonly CollisionShape2D[]): Promise<PhysicsAdapter> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0 });
  const staticBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const chunks = new Map<string, { shapes: readonly CollisionShape2D[]; handles: RAPIER.Collider[] }>();
  let disposed = false;
  const removeChunk = (id: string) => {
    if (disposed) return;
    for (const collider of chunks.get(id)?.handles ?? []) world.removeCollider(collider, true);
    chunks.delete(id);
  };
  const setChunk = (id: string, next: readonly CollisionShape2D[]) => {
    if (disposed) throw new Error("Physics adapter disposed");
    if (chunks.get(id)?.shapes === next) return;
    const descriptors: RAPIER.ColliderDesc[] = [];
    for (const shape of next) {
      const points = shape.kind === "polygon" ? [shape.polygon.outer, ...shape.polygon.holes].flat() : shape.kind === "segment" ? [shape.a, shape.b] : [shape.center];
      if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error("Invalid collision coordinates");
      if (shape.kind === "polygon") {
        for (const ring of [shape.polygon.outer, ...shape.polygon.holes]) { const wall = buildingWall(ring); if (wall) descriptors.push(wall); }
      } else if (shape.kind === "segment") {
        const collider = segmentCollider(shape); if (collider) descriptors.push(collider);
      } else {
        if (!Number.isFinite(shape.radiusMeters) || shape.radiusMeters <= 0) throw new Error("Invalid collision radius");
        descriptors.push(RAPIER.ColliderDesc.ball(shape.radiusMeters).setTranslation(shape.center.x, shape.center.y));
      }
    }
    const handles: RAPIER.Collider[] = [];
    try { for (const descriptor of descriptors) handles.push(world.createCollider(descriptor, staticBody)); }
    catch (error) { for (const collider of handles) world.removeCollider(collider, true); throw error; }
    removeChunk(id); chunks.set(id, { shapes: next, handles });
  };
  setChunk("legacy", shapes);
  return {
    world, colliderCount: () => disposed ? 0 : world.colliders.len(), setChunk, removeChunk,
    isPoseFree(pose) {
      if (disposed || ![pose.position.x, pose.position.y, pose.heading].every(Number.isFinite)) return false;
      const shape = new RAPIER.Cuboid(VEHICLE_HALF_LENGTH, VEHICLE_HALF_WIDTH);
      return [...chunks.values()].every((chunk) => chunk.handles.every((collider) => !collider.intersectsShape(shape, pose.position, pose.heading)));
    },
    dispose() { if (disposed) return; disposed = true; chunks.clear(); world.free(); },
    createVehicle(initial) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(initial.x, initial.y).setRotation(initial.heading).setCcdEnabled(true));
      world.createCollider(RAPIER.ColliderDesc.cuboid(VEHICLE_HALF_LENGTH, VEHICLE_HALF_WIDTH).setFriction(0.8).setRestitution(0), body);
      return { body, position: { x: initial.x, y: initial.y }, velocity: { x: 0, y: 0 }, heading: initial.heading };
    },
    stepVehicle(state, input) {
      const desired = stepArcadeVehicle(state, input);
      state.body.setLinvel(desired.velocity, true); state.body.setRotation(desired.heading, true);
      world.timestep = 1 / 60; world.step();
      const position = state.body.translation(); const velocity = state.body.linvel();
      return { body: state.body, position: { x: position.x, y: position.y }, velocity: { x: velocity.x, y: velocity.y }, heading: state.body.rotation() };
    },
  };
}
