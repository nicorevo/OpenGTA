# ADR-002 — Physics and Collision for V0

**Status:** Accepted for prototype  
**Date:** 2026-08-19

## Decision

Use `@dimforge/rapier2d` for V0 behind a project-owned physics adapter.

The game world remains planar.

## Rationale

Rapier publishes a dedicated JavaScript/WebAssembly 2D package and does not
impose rendering.

This is a good fit for:

- static building collision;
- one dynamic vehicle;
- future larger 2D simulations if required.

## Vehicle model

Do not build a realistic wheel/suspension vehicle.

Use the arcade controller specified in:

`docs/specs/vehicle-controller-v0.md`

## WASM

Rapier initialization is asynchronous.

Application bootstrap must account for that without leaking Rapier-specific
objects into world semantics.

## Exit criteria

Re-evaluate Planck.js or a smaller custom collision layer if measured V0
evidence shows:

- unacceptable startup/bundle cost;
- difficult arcade control;
- excessive collider preprocessing;
- materially simpler custom needs.

## Source checked

- https://rapier.rs/docs/user_guides/javascript/getting_started_js/
