# OpenGTA Web — Validation Matrix

| Area | V0 proof | Later proof |
|---|---|---|
| Product intent | Docs consistent | User validation after major scope changes |
| Coordinates | bounded metric accuracy | arbitrary-coordinate regions |
| World model | deterministic fixture | provider-independent inputs |
| Compiler | roads/buildings/collisions | chunk/LOD/package parity |
| Renderer | recognizable fixed area | dense city + streaming |
| Fake 2.5D | one cheap building technique | quality tiers |
| Physics | one arcade vehicle + buildings | traffic/high entity count |
| Performance | desktop fixture metrics | weak devices/mobile |
| Chunking | not required | seamless multi-chunk travel |
| Cache | not required | versioned persistent reuse |
| Live data | not required | provider failure/rate-limit tests |
| Preprocessed mode | architecture only | package/runtime parity |
| AI | explicitly absent | optional enrichment + fallback |
| Multiplayer | explicitly absent | dedicated authority ADRs |

## Gate rule

A roadmap phase is not complete because code exists.

It is complete when the relevant proof has:

- a reproducible input;
- a defined expected result;
- a test or manual procedure;
- recorded measurements where performance is involved.
