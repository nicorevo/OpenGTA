# Debug Overlay V0

**Status:** Required developer feature for V0

Display a compact developer overlay toggleable at runtime.

## Required fields

### Frame

```text
FPS
frame ms
p95 frame ms (rolling)
long-frame count
```

### World/compiler

```text
fixture/region ID
building count
road count
compiled feature count
warning count
last compile time
```

### Renderer

Expose where available:

```text
renderer backend
canvas resolution
display/render object count
batch/draw-call proxy if available
```

Do not block V0 if exact GPU draw-call introspection is unavailable.

### Physics

```text
physics bodies
physics colliders
physics step ms
catch-up/discard counter
```

### Player

```text
local x/y metres
speed m/s
heading
optional derived lat/lon
```

### Spatial

```text
geo origin
active logical chunk/region ID
```

## Rule

Debug instrumentation must be disableable and must not become authoritative
game state.
