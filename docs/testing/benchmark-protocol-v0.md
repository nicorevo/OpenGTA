# V0 Benchmark Protocol

**Status:** Required evidence protocol

## Hardware/environment record

Always record:

```text
date
OS
browser + version
Node version
CPU
GPU
RAM
display/canvas resolution
devicePixelRatio
renderer backend
commit
fixture
```

Unknown values must be recorded as unknown, not invented.

## Cold-start phases

Instrument:

```text
app bootstrap
fixture decode
normalization
world-model creation
compiler total
renderer activation
physics activation
first playable
```

## Steady-state frame metrics

After warm-up:

```text
sample window >= 30 seconds
average frame ms
median frame ms
p95 frame ms
p99 frame ms
max frame ms
frames > 33.3 ms
```

## Physics

Record:

```text
fixed steps executed
average step time
p95 step time
simulation-debt drops
```

## Memory

Where observable:

```text
JS heap
fixture/raw data size
canonical data estimate
compiled data estimate
texture/assets estimate
```

Do not invent GPU memory if browser APIs do not expose it reliably.

## Provisional V0 health envelope

These are engineering alerts, not final product SLAs:

```text
steady-state target          60 Hz display cadence
p95 frame-time alert         > 20 ms
p99 frame-time alert         > 33.3 ms
single-frame stall alert     > 100 ms
```

A threshold breach triggers investigation; it does not automatically mean the
architecture is invalid.

## Comparison rule

When comparing renderer/physics alternatives:

- same fixture;
- same canvas size;
- same visual content;
- same measurement code;
- same machine/browser session where possible.
