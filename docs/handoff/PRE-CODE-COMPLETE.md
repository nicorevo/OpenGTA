# Pre-Code Design Complete

The architecture/design work that can be completed without executing inside the
real repository is considered complete for the V0 handoff.

## Why Codex becomes necessary here

The remaining work requires at least one of:

- reading repository-local `CODING-STANDARDS.md`;
- reading repository-local `SECURITY.md`;
- loading the relevant `.opencode/` skills;
- installing npm dependencies;
- running a browser/dev server;
- executing tests;
- measuring renderer/physics behavior;
- writing and validating application code.

Those operations depend on the real repository and execution environment.

## What has already been decided for Codex

Codex does not need to invent:

- product direction;
- dual-world architecture;
- 2D/fake-2.5D model;
- world-model boundary;
- coordinate domains;
- V0 fixture area;
- V0 projection mathematics;
- V0 OSM normalization profile;
- V0 compiled contracts;
- initial road-width policy;
- initial fake-building-depth algorithm;
- initial arcade vehicle parameters;
- V0 toolchain family;
- initial renderer;
- initial physics engine;
- test categories;
- benchmark fields;
- model-routing policy.

## Codex's first indispensable action

Start with:

`docs/handoff/CODEX-START-HERE.md`

Codex should then work through the execution queue in order and stop only for a
true repository-policy conflict, failed acceptance gate without a documented
fallback, or unavailable execution capability.
