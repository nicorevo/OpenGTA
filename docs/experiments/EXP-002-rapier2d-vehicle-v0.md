# EXP-002 — Rapier 2D collision and arcade vehicle fit

**Status:** Ready after base scaffold  
**Primary ADR:** ADR-002  
**Model class:** STANDARD; escalate to FRONTIER for solver/vehicle-feel tradeoffs.

## Question

Can Rapier 2D provide stable planar collision while allowing a deliberately
arcade top-down vehicle controller?

## Scene

Use a renderer-independent physics test world:

- one dynamic vehicle body;
- several static rectangular/polygonal obstacles;
- deterministic timestep;
- simple keyboard/input command abstraction.

## Vehicle goals

The vehicle should support:

- accelerate;
- brake/reverse;
- steering;
- controllable lateral slip;
- collision with static world.

Do not model:

- suspension;
- wheel contact patches;
- drivetrain;
- realistic tire physics.

## Compare controller strategies

At minimum evaluate:

### A — force/velocity based dynamic body

### B — more controlled arcade body logic with physics used primarily for
collision/response

Prefer gameplay control over realism.

## Metrics

- WASM/init time;
- simulation step time;
- collision stability;
- tunneling at expected V0 speeds;
- controllability;
- complexity of integrating static polygon collision.

## Determinism note

Rapier's JS/WASM implementation documents cross-platform determinism given the
same initial conditions and construction order.

Do not assume the rest of the game automatically becomes deterministic:
input generation, trigonometric calculations and ordering still matter.

## Success

- vehicle cannot ordinarily pass through building colliders;
- tuning feels controllable;
- solver integration remains isolated behind adapter;
- no 3D body/physics dependency is introduced.

## Failure trigger

Benchmark Planck.js or a simpler custom collision/controller approach if:

- Rapier startup cost is material;
- arcade tuning becomes harder than a simpler solution;
- required polygon preprocessing dominates the implementation.
