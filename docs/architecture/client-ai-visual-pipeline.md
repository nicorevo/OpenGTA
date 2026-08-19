# OpenGTA Web — Client-Side AI Visual Enrichment Pipeline

**Status:** Future architecture / non-V0  
**Date:** 2026-08-19

## 1. Product reason

Open World Runtime Mode should be able to enrich arbitrary geographic areas
without requiring expensive server-side generation for every user request.

AI is therefore considered a potential **client-side optional visual tool**.

It is not world truth and is not required for basic play.

## 2. Hard invariant

```text
GEOGRAPHIC STRUCTURE
must exist without AI
```

AI must never be necessary to determine:

- building footprints;
- road topology;
- collision geometry;
- coordinates;
- chunk identity;
- navigation truth.

## 3. Layering

```text
Canonical World
      ↓
Deterministic style resolver
      ↓
Playable visual fallback
      ↓
Optional AI enrichment
      ↓
Cached visual asset/descriptor
```

The deterministic fallback is mandatory.

## 4. Candidate AI responsibilities

Low-risk uses:

- palette selection;
- style classification;
- facade descriptor generation;
- texture variation;
- roof texture variation;
- decorative sprite variation.

Higher-cost future uses:

- direct texture synthesis;
- local inpainting/variation;
- procedural visual packs.

## 5. Prefer descriptors before image generation

The first AI experiment should preferably generate a compact **visual
descriptor** rather than a full image.

Example:

```json
{
  "facadeFamily": "warm-stone",
  "roofFamily": "flat-light",
  "palette": "mediterranean-muted",
  "detailDensity": "medium"
}
```

Why:

- lower compute;
- easier caching;
- deterministic assets can consume descriptors;
- weaker devices can skip inference;
- easier to validate.

Only after this is useful should client image generation be tested.

## 6. Device capability

AI enrichment must be capability-gated.

Possible states:

```text
UNAVAILABLE
AVAILABLE_LOW
AVAILABLE_HIGH
```

The game must never fail because AI is unavailable.

## 7. Scheduling

AI work must run below structural world generation.

Priority:

```text
1. collision/playable world
2. visual deterministic world
3. neighbor streaming
4. optional AI enrichment
```

If the device is under load, AI should pause/cancel.

## 8. Cache

Generated descriptors/assets should be cacheable with keys including:

- area/feature identity;
- style policy version;
- model/runtime version where relevant;
- prompt/template version where relevant;
- quality profile.

## 9. Privacy and cost

Client-side processing is preferred because it can:

- avoid per-request server inference cost;
- keep arbitrary exploration scalable;
- potentially keep raw local visual-generation context on device.

Do not assume local AI is free: it costs battery, memory, download size and
latency.

## 10. Preprocessed mode

Official zones may use much heavier offline AI because generation occurs once.

Offline results can then be distributed as ordinary static assets.

## 11. Runtime mode fallback ladder

```text
AI-generated texture available
→ use it

else deterministic regional texture available
→ use it

else generic texture family
→ use it

else flat-color/material fallback
```

## 12. Failure policy

AI timeout, unsupported API, model load failure or memory pressure:

```text
log optional diagnostic
→ continue deterministic rendering
```

## 13. V0 status

Do not implement AI in V0.

V0 should expose only enough style boundaries that later AI can plug in
without changing world truth.

## 14. Future experiment gates

Before shipping runtime AI, measure:

- model download size;
- warm/cold start;
- inference latency;
- memory;
- battery/thermal impact;
- browser compatibility;
- texture quality consistency;
- cache reuse rate.

No client AI technology is selected by this document.
