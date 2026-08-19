# OpenGTA Web — Architecture Guardrails for Codex

This file supplements, but does **not replace**, the repository `AGENTS.md` or
the skill/persona routing in `.opencode/`.

## Read order for product work

1. `AGENTS.md`
2. relevant `.opencode/` agent/skill instructions
3. `docs/intent/open-gta-web.md`
4. architecture documents relevant to the task
5. relevant ADRs
6. execution task

## Non-negotiable product constraints

- browser-first;
- two final world modes;
- one shared core/runtime;
- 2D-first world/gameplay/collision model;
- fake-2.5D preferred to true 3D;
- AI optional and downstream from geographic truth;
- canonical world independent from renderer and physics libraries;
- measured performance decisions.

## Do not infer implementation state

The repository was documentation-only when this pack was produced.

A roadmap item, ADR or proposed directory tree is not evidence that code
exists.

## Do not convert proposals into decisions silently

When an ADR is `Proposed`, Codex may implement only the experiment explicitly
requested.

If the experiment reveals a better choice, report it instead of forcing the
proposal.

## Scope discipline

Do not:

- create full city streaming during V0;
- add multiplayer during V0;
- add client AI during V0;
- create full 3D building meshes by default;
- use raw latitude/longitude as gameplay coordinates;
- couple raw OSM data directly to renderer objects;
- replace the existing skill routing system.

## After each experiment

Report:

- files changed;
- tests actually run;
- measurements actually collected;
- assumptions;
- ADR evidence;
- unresolved risks.
