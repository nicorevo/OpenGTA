# Spec: First-Person Perspective Renderer (OutRun-Style)

**Status:** Draft — awaiting review  
**Date:** 2026-09-14  
**Phase:** Spec-driven development — Phase 1

---

## Objective

Add a first-person perspective renderer to OpenGTA Web that provides an
OutRun-style driving experience from the vehicle's point of view, toggleable
with the existing top-down renderer via the `V` key.

**Who:** Players who want the classic arcade driving feel without losing access
to the strategic top-down map.

**Why:** The current world model (road centerlines with 3D building data,
tangent-plane coordinates, vehicle heading/position) is already well-structured
for perspective projection. This adds a qualitatively different experience
without modifying physics or world streaming.

**Success looks like:**
- Driving on real OSM roads with a forward-facing perspective view
- Road surface fills the lower portion of the screen, narrowing toward horizon
- Adjacent buildings visible on left/right with depth scaling
- Vehicle is centered and faces along its heading
- Toggle between top-down and first-person with `V` key (instant switch)
- 60 FPS on mid-range hardware (same target as current renderer)

---

## Commands

```
npm run dev                        # Start dev server (port 5174)
npm run typecheck                  # TypeScript strict mode, no emit
npm run test:run                   # Vitest, 44 test files, 322 tests
npm run build                      # Production build
```

---

## Tech Stack

- **Rendering:** PixiJS v8 (`pixi.js: ^8.19.0`) with WebGL
- **Language:** TypeScript (strict mode)
- **Physics:** Rapier 2D (unchanged)
- **World data:** `CompiledChunkV0` from MVT normalization (unchanged)
- **Input:** Existing key handler (W/S throttle, A/D steer)

---

## Project Structure

New code goes in `src/render/pixi/first-person/`:

```
src/render/pixi/
  first-person/
    camera3d.ts          # FOV, camera height, projection parameters
    road-projector.ts    # centerline → screen segments (3D→2D projection)
    segment-drawer.ts    # draws road polygon strips back-to-front
    building-projector.ts  # projects nearby buildings as side walls
    sky-drawer.ts        # gradient sky at horizon
    first-person-renderer.ts  # implements PixiRenderer interface
```

Integration points (modified, not replaced):

```
src/render/pixi/renderer.ts        # Add V key toggle, route render calls
src/render/pixi/presentation.ts    # Add perspectiveMode field
src/app/bootstrap.ts               # Wire V key handler
```

**Principles:**
- The new renderer implements the same `PixiRenderer` interface
- It shares the `CompiledChunkV0` world data — no conversion layer
- Physics, chunk loading, input, and camera bounds are untouched
- The existing top-down renderer code is NOT modified, only extended

---

## Code Style

Follow existing conventions from `docs/CODING-STANDARDS.md` and patterns
in `src/render/pixi/renderer.ts`:

```typescript
// Use typed interfaces over any
interface RoadSegment {
  readonly worldZ: number;   // distance along road from camera
  readonly screenY: number;  // projected Y on screen
  readonly width: number;    // projected width in pixels
}

// Prefer single-expression functions where natural
function projectZToWorld(z: number, cameraHeight: number): Vec3 {
  return { x: 0, y: cameraHeight, z };
}

// No comments unless the logic is non-obvious
// (the spec is the source of truth for "why")
```

Naming: `camera3d`, `roadProjector`, `segmentDrawer` (kebab-style module names, camelCase exports).

---

## Testing Strategy

**Framework:** Vitest (existing, 44 test files)

**What to test:**
1. **Projection math** (`road-projector.test.ts`): Verify perspective projection
   produces correct screen coordinates for known world coordinates.
2. **Segment generation** (`road-projector.test.ts`): Given a straight centerline,
   produce evenly-spaced segments. Given a curve, segments follow the path.
3. **Building visibility** (`building-projector.test.ts`): Only buildings within
   ±30m lateral distance are projected. Far buildings are excluded.
4. **Toggle behavior** (integration): Pressing V switches render mode without
   breaking vehicle control or physics.

**Manual verification:**
- Drive on varied road types (residential, primary, motorway)
- Toggle V during motion (no crash)
- 30-second drive, check FPS is stable at 60

**Coverage target:** 80% for `first-person/` module. Public API tests > unit tests > integration tests.

---

## Boundaries

### Always
- Preserve the `PixiRenderer` interface contract
- Run `npm run typecheck` and `npm run test:run` before committing
- Follow incremental implementation: build one visual layer, test it, then add the next
- Document decisions in `docs/adr/` if they change established patterns

### Ask first
- Changes to the `CompiledChunkV0` schema
- Modifications to physics, vehicle controller, or chunk loading
- Adding new dependencies (all current deps are acceptable)
- Changes to existing top-down renderer behavior

### Never
- Commit secrets or credentials
- Modify vehicle physics, collision, or spawning logic
- Replace the existing renderer (extend, don't rewrite)
- Render roads more than 150m ahead (performance boundary)

---

## Success Criteria

### MVP (minimum viable)
- [ ] Vehicle drives forward on road centerline in perspective view
- [ ] Road fills screen width appropriately (narrower at distance)
- [ ] Toggle with `V` key switches between top-down and first-person
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] All 322 existing tests pass
- [ ] First-person renders at 60 FPS for 30 seconds in Chrome

### Scope excluded (deferred)
- Hill/elevation projection
- Curve-bending distortion (OutRun "paper view")
- Speedometer overlay
- Peripheral blur / road shake effects
- Dynamic sky / weather
- Multiple camera angles

---

## Open Questions

All resolved. Decisions:

1. **Road color palette:** Use existing `ROAD_FILL = 0x53515a` and `ROAD_EDGE = 0x302e38` for consistency with top-down.
2. **Building visibility:** 30m lateral, ~100m forward projection distance. Confirmed.
3. **Horizon treatment:** Simple gradient sky (blue → light blue). OutRun aesthetic, low cost.
4. **Vehicle hood/bonnet:** Omit for MVP. Add in follow-up if needed.
5. **Performance budget:** Target 100 draw calls maximum (road segments + building polygons). Current renderer does ~600 at max zoom; this is a 6x improvement.
