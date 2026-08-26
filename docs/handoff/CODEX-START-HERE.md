# CODEX START HERE — OpenGTA Web V0

**Historical.** Session start is now `docs/handoff/CURRENT.md`. Do not re-run
this queue.

You are taking over after product/architecture design is complete.

## 1. Read process rules first

Before application work:

1. read root `AGENTS.md`;
2. follow its `.opencode/agents` routing;
3. load only relevant `.opencode/skills`;
4. read `CODING-STANDARDS.md`;
5. read `SECURITY.md`.

Then read:

```text
docs/DECISIONS.md
docs/intent/open-gta-web.md
docs/handoff/PRE-CODE-COMPLETE.md
docs/handoff/CODEX-EXECUTION-QUEUE.md
```

For each task, read only the architecture/spec files it names.

## 2. Objective

Progress autonomously through the V0 execution queue.

Do not re-open already accepted product decisions merely because another
implementation is possible.

## 3. Repository state assumption

At handoff there is no application code.

If the actual repository differs, trust the repository, report the difference,
and preserve compatible existing work.

## 4. Model routing

Default:

```text
STANDARD / medium reasoning
```

Use ECONOMY for deterministic mechanical follow-up.

Use FRONTIER only for a genuine cross-module ambiguity or repeated failure.

See `docs/codex/model-routing.md`.

## 5. Stop conditions

Stop and ask for human decision only if:

- repository policy directly contradicts an accepted architecture decision;
- required dependency cannot be installed/licensed safely;
- an accepted prototype technology cannot satisfy a required V0 behavior and
  the documented fallback also fails;
- the repository contains unexpected application code whose replacement would
  be destructive;
- credentials/payment/external account action is required;
- a test proves a product-level requirement is internally inconsistent.

Do not stop merely for a normal implementation choice already covered by the
specs.

## 6. Evidence

Never claim:

- test passed;
- browser rendered;
- benchmark met;
- fixture fetched;

unless you actually performed it.

## 7. Scope

Complete V0 only.

Do not start:

- city-scale streaming;
- AI runtime;
- multiplayer;
- mobile;
- traffic/pedestrians.

When V0 definition-of-done is satisfied, produce the final V0 report and stop.
