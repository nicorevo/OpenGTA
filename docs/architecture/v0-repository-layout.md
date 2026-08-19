# OpenGTA Web — Layout applicativo proposto per V0

**Status:** Proposed  
**Date:** 2026-08-19

## Principle

Il layout deve separare il core geografico da renderer, fisica e gameplay.

Non deve replicare la struttura 3D della bozza originaria.

## Proposed root after scaffold

```text
/
├── .opencode/                 existing, preserve
├── docs/                      OpenGTA planning/architecture
├── AGENTS.md                  existing, preserve
├── CODING-STANDARDS.md        existing, preserve
├── SECURITY.md                existing, preserve
├── LICENSE                    existing, preserve
│
├── public/
├── src/
├── tests/                     only where non-colocated tests are useful
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts             only if configuration is actually required
```

## Proposed `src/`

```text
src/
├── app/
│   ├── bootstrap.ts
│   └── app.ts
│
├── geo/
│   ├── coordinates/
│   ├── source/
│   └── normalize/
│
├── world/
│   ├── model/
│   └── compiler/
│
├── render/
│   ├── adapter/
│   ├── pixi/                  only after renderer experiment starts
│   └── debug/
│
├── physics/
│   ├── adapter/
│   └── rapier/                only after physics experiment starts
│
├── gameplay/
│   └── vehicle/
│
├── fixtures/
│   └── geo/
│
└── main.ts
```

Exact filenames may vary to respect `CODING-STANDARDS.md`.

## Dependency direction

Allowed conceptual direction:

```text
app
├── geo
├── world
├── render
├── physics
└── gameplay

world/model
    must not import render or physics

geo
    must not import render or physics

render
    may consume compiled world interfaces

physics
    may consume compiled collision interfaces

gameplay
    may depend on project-owned render/physics adapters,
    not on raw provider data
```

## Forbidden coupling

Do not create:

```text
geo/osm -> pixi Sprite
world/model -> Rapier Collider
vehicle -> raw OSM tags
renderer -> geographic API request
```

## Test placement

Prefer colocated unit tests for pure modules when compatible with project
standards:

```text
projector.ts
projector.test.ts
```

Use dedicated integration fixtures/tests when multiple layers are involved.

## `vite.config.ts`

Do not create a complex Vite config merely because Vite supports it.

Start from defaults.

Add configuration only for an identified requirement.

## UI

Do not introduce a frontend UI framework for V0.

A minimal DOM shell can host:

- canvas;
- FPS/debug readout;
- loading status;
- developer controls.

A framework can be evaluated later if product UI complexity warrants it.

## Asset policy

For V0:

```text
public/
    minimal static developer assets only

src/fixtures/
    deterministic test/geo data
```

Final texture/package organization is deferred.

## Worker policy

Do not create workers in scaffold commit.

Introduce workers only when a synchronous stage exists and benchmark data shows
the need or when runtime architecture reaches the streaming phase.

The APIs should remain worker-compatible.
