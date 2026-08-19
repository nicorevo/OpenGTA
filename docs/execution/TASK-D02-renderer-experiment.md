# TASK-D02 — Run EXP-001 PixiJS renderer experiment

**Status:** Blocked by TASK-D01  
**Model class:** STANDARD  
**Reasoning:** medium-high

## Read

- `AGENTS.md`
- relevant `.opencode/` skills
- `docs/architecture/2d-rendering-model.md`
- `docs/architecture/v0-repository-layout.md`
- `docs/architecture/performance-capability-tiers.md`
- `docs/adr/ADR-001-renderer-for-v0.md`
- `docs/experiments/EXP-001-renderer-pixijs-v0.md`

## Goal

Produce only the bounded PixiJS WebGL experiment defined in EXP-001.

Install PixiJS only in this task.

## Do not

- add Rapier;
- add OSM network access;
- implement chunk streaming;
- add AI;
- build a full game engine;
- accept ADR-001 before collecting experiment evidence.

## Output

- experiment source;
- repeatable run instructions;
- recorded metrics;
- screenshot/manual verification note if available;
- recommendation: accept PixiJS for V0, keep proposed, or benchmark alternative.
