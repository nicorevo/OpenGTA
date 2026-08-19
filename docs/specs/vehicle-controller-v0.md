# Arcade Vehicle Controller V0

**Status:** Initial gameplay specification  
**Physics baseline:** Rapier 2D, zero gravity  
**Step:** fixed 60 Hz

## Goal

Produce controllable top-down arcade driving, not vehicle simulation.

## Vehicle footprint

Initial dimensions:

```text
length 4.2 m
width  1.8 m
```

Collider may use a slightly reduced rectangle to avoid frustrating visual-edge
contacts.

Suggested half-extents:

```text
2.0 m × 0.82 m
```

## Inputs

Normalize per fixed simulation step:

```text
throttle  -1 ... +1
steer     -1 ... +1
brake      0 ... 1
```

Keyboard mapping is an input adapter concern.

## Initial tuning values

```text
max forward speed       22 m/s
max reverse speed        7 m/s
forward acceleration     9 m/s²
reverse acceleration     5 m/s²
service braking         14 m/s²
rolling deceleration     1.5 m/s²
max steering rate        2.4 rad/s
lateral grip             7.0 1/s
minimum steer speed      0.8 m/s
```

These are tuning seeds, not physical claims.

## Baseline control model

Each fixed step:

1. derive forward/right axes from body rotation;
2. project current velocity into longitudinal/lateral components;
3. apply throttle/brake to longitudinal speed;
4. damp lateral speed using `lateralGrip`;
5. calculate steering effectiveness from absolute longitudinal speed;
6. reverse steering sign while moving backwards;
7. update requested angular/heading velocity;
8. clamp forward/reverse speed;
9. let the physics solver resolve contacts.

Prefer a controlled arcade velocity model over wheel/suspension simulation.

## Collision behavior

- buildings are static planar colliders;
- vehicle cannot pass through normal building footprints at expected V0 speed;
- collision response should not produce extreme spin from tiny contacts;
- collision tuning may use restitution/friction values inside physics adapter.

## Frame handling

- fixed physics dt = 1/60 s;
- accumulate render delta;
- clamp extreme frame delta to avoid spiral-of-death;
- cap catch-up steps.

Recommended initial cap:

```text
max frame delta considered = 0.25 s
max catch-up steps         = 5
```

If the app falls farther behind, discard excess simulation debt and report a
debug counter.

## Camera

Initial camera follows the vehicle in top-down orientation.

No camera rotation is required for V0.

## Tuning acceptance

A parameter change does not require an ADR.

A change from the arcade velocity-controller model to a fundamentally different
physics model does.
