# ADR-008 — Client AI Staging

**Status:** Accepted  
**Date:** 2026-08-19

## Decision

Client AI is introduced only as progressive visual enrichment.

Order:

```text
deterministic fallback
→ optional descriptor inference
→ optional lightweight local ML
→ future texture/image-generation experiment
```

## Rules

- No AI model is downloaded before minimum playable world readiness.
- AI failure never changes collision/geographic truth.
- Runtime AI is cancellable.
- Browser image generation is not a V0/V1 dependency.
- WebGPU is an enhancement, not universal baseline.
