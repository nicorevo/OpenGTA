# OpenGTA Web — Decision Register

**Snapshot:** 2026-08-19  
**Purpose:** One-page view of what Codex may treat as decided versus open.

Phase 0 closeout: `docs/results/PHASE-0-COMPLETE.md`.
Current session entry: `docs/handoff/CURRENT.md`.

## Product decisions — ACCEPTED

- Browser-first.
- Real geographic data is the basis of the world.
- Two final modes:
  - Preprocessed World Mode;
  - Open World Runtime Mode.
- Both modes share one canonical core/runtime.
- World, gameplay and collision are 2D-first.
- Visual depth is fake-2.5D and optional.
- AI is optional visual enrichment, not geographic truth.
- Open-world AI should preferentially run client-side when viable.
- Weak clients should degrade visual quality rather than change world truth.

## V0 scope decisions — ACCEPTED

- One fixed real-world area.
- Local deterministic fixture; no live provider dependency during core V0.
- Desktop browser first.
- One vehicle.
- Planar collision.
- Deterministic non-AI visuals.
- No multiplayer, pedestrians, traffic, mobile, persistent cache or streaming.
- Fixture working area: Lecce historic centre around Piazza Sant'Oronzo,
  approximately 600 m × 600 m.
- Coordinate model: WGS84 geographic identity + local WGS84 tangent-linear
  metric plane for this bounded fixture.

## V0 implementation choices — ACCEPTED FOR PROTOTYPE

These choices are deliberately reversible after V0 evidence:

- TypeScript strict.
- Vite 8-class browser tooling.
- Vitest 4-class unit/integration testing.
- npm as initial package manager unless repository policy explicitly requires
  another package manager.
- PixiJS v8, WebGL baseline renderer.
- Rapier 2D behind a project-owned adapter.
- Fixed 60 Hz physics step for the first arcade vehicle experiment.
- No UI framework in V0.
- No worker in the first executable increment; add workers when a measured
  stage requires them.

## Operational decisions — ACCEPTED

- Existing `AGENTS.md`, `.opencode/` skills/agents, `CODING-STANDARDS.md` and
  `SECURITY.md` remain authoritative process infrastructure.
- OpenGTA docs supplement the scaffold; they do not replace the AI-SDLC
  routing system.
- Model routing uses capability classes:
  - ECONOMY;
  - STANDARD;
  - FRONTIER.
- Default Codex class: STANDARD.
- Each non-trivial task states exact context scope and acceptance checks.

## Explicitly OPEN / DEFERRED

- Production live OSM/provider topology.
- Production geocoder.
- Final chunk size/cell system.
- Persistent cache technology/schema.
- Final world package binary format.
- Final texture compression format.
- WebGPU renderer migration.
- Runtime AI model/runtime.
- Browser image-generation model.
- Mobile requirements.
- Multiplayer transport/tick/authority.
- Traffic/pedestrian systems.
- Gameplay systems beyond driving.

## Change rule

Codex may not silently change an ACCEPTED item.

A prototype choice may be superseded only when:

1. evidence is recorded;
2. the replacement preserves product constraints;
3. the relevant ADR is updated.
