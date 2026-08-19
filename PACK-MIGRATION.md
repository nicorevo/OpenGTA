# OpenGTA Web — Planning Pack v4 Migration

This is the final pre-code planning overlay.

## Preserve existing AI-SDLC infrastructure

Do not delete:

```text
.opencode/
CODING-STANDARDS.md
SECURITY.md
LICENSE
```

The pack contains the user-supplied `AGENTS.md` unchanged.

## Intentional updates

The overlay updates:

- `README.md`;
- `docs/intent/open-gta-web.md`;

and adds architecture, ADR, specs, research, fixtures, tests and Codex handoff
material.

Existing product documents are archived where useful.

## Apply to repository

Follow exactly:

`docs/execution/overlay-existing-repository.md`

## After overlay

The next indispensable actor is Codex in the real repository.

Give Codex:

`docs/handoff/CODEX-START-HERE.md`

Do not manually re-explain the architecture in an ad-hoc prompt; the repository
documents are the durable source of truth.
