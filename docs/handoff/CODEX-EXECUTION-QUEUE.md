# Codex Execution Queue — V0

Execute in order.

Each task should end with tests/verification and a concise result note.

## Q00 — Overlay verification

Verify:

- `AGENTS.md` unchanged from repository expectations;
- `.opencode/agents` exists;
- `.opencode/skills` exists;
- `CODING-STANDARDS.md` exists;
- `SECURITY.md` exists;
- no unexpected app scaffold exists.

Read:
`docs/execution/overlay-existing-repository.md`

## Q01 — Scaffold

Execute:
`docs/execution/TASK-D01-v0-scaffold.md`

Then update README/AGENTS command sections only as existing repository rules
require.

## Q02 — Projection

Implement ADR-003 directly.

Use:
- `docs/research/projection-validation-lecce-v0.md`
- `docs/fixtures/lecce-v0/coordinate-test-vectors.csv`

No renderer/physics dependency required.

## Q03 — Canonical model

Implement:
`docs/specs/canonical-world-v0-contract.md`

Add invariant tests with the synthetic fixture.

## Q04 — Fixture acquisition

Fetch the bounded Lecce fixture once using:

`docs/fixtures/lecce-v0/lecce-v0.overpassql`

Commit raw fixture + provenance/ODbL note.

If public Overpass is unavailable, do not redesign the architecture:
use a permitted alternative/raw export and record provenance.

## Q05 — OSM normalization

Implement:
`docs/specs/osm-normalization-v0.md`

Tests:
- synthetic unit cases;
- committed Lecce fixture;
- diagnostics for malformed/unsupported data.

## Q06 — World compiler core

Implement:
- `docs/architecture/world-compiler.md`
- `docs/specs/compiled-chunk-v0-contract.md`
- `docs/specs/road-generation-v0.md`

Start with land/road/building/collision semantics.

## Q07 — PixiJS renderer

Install PixiJS v8.

Implement renderer adapter and deterministic style:

- `docs/adr/ADR-001-renderer-for-v0.md`
- `docs/specs/building-fake-2_5d-v0.md`
- `docs/specs/v0-quality-style-profile.md`

Use WebGL baseline.

No true 3D world.

## Q08 — Browser smoke test

Add Playwright or repository-approved equivalent now that browser rendering
exists.

Verify:

- app boots;
- canvas exists;
- fixture renders;
- no uncaught error;
- debug overlay toggles.

## Q09 — Rapier 2D

Install Rapier 2D.

Implement physics adapter and static collision from compiled neutral shapes.

## Q10 — Arcade vehicle

Implement:
`docs/specs/vehicle-controller-v0.md`

Vehicle must drive and collide in the fixed world.

## Q11 — Camera/input/debug

Complete:

- top-down vehicle-follow camera;
- keyboard input adapter;
- `docs/specs/debug-overlay-v0.md`.

## Q12 — Full V0 integration tests

Run:
`docs/testing/v0-test-strategy.md`

No live network calls in automated V0 tests.

## Q13 — Benchmark

Run:
`docs/testing/benchmark-protocol-v0.md`

Record actual environment and actual measured results.

Do not optimize without evidence.

## Q14 — V0 report

Create:

```text
docs/results/V0-RESULT.md
```

Include:

- exact commit;
- architecture deviations;
- dependencies/versions;
- tests run;
- browser checks;
- benchmark data;
- known issues;
- screenshot paths if produced;
- whether V0 Definition of Done is satisfied.

## Q15 — Stop

Do not continue to streaming/cache/AI/multiplayer automatically.

The next phase begins only after V0 evidence is reviewed.
