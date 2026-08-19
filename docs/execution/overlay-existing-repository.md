# Apply Planning Pack v4 to the Existing OpenGTA Repository

## 1. Clean state

From repository root:

```bash
git status --short
```

Resolve/stash unrelated changes first.

## 2. Safety branch

Recommended:

```bash
git switch -c planning/open-gta-v4
```

## 3. Extract

Extract the ZIP contents **directly into repository root**.

Do not create a nested `open-gta-codex-pack-v4/` directory.

## 4. Preserve scaffold infrastructure

Verify these still exist:

```text
.opencode/agents/
.opencode/skills/
CODING-STANDARDS.md
SECURITY.md
```

Do not delete any other repository-specific template infrastructure merely
because it is absent from the ZIP.

## 5. AGENTS.md verification

The ZIP carries the same `AGENTS.md` supplied from the existing project.

Run:

```bash
git diff -- AGENTS.md
```

Expected: no content change.

If it differs, keep the repository version and review the discrepancy before
continuing.

## 6. Review intentional documentation changes

```bash
git diff -- README.md
git diff -- docs/
git status --short
```

Important:

- updated product intent is intentional;
- historical baseline is archived;
- original city-scale idea is retained;
- no application source code should be added by merely applying the pack.

## 7. Commit planning overlay

Suggested:

```bash
git add README.md PACK-MIGRATION.md docs
git commit -m "docs: finalize OpenGTA V0 architecture and Codex handoff"
```

Do not add a backup copy of `AGENTS.md` if it is unmodified.

## 8. Handoff to Codex

Open Codex in this repository and tell it only:

```text
Read and execute docs/handoff/CODEX-START-HERE.md.
```

Codex has the full execution queue in the repository.

## 9. Codex stop point

Codex should stop after producing the V0 result report or when one of the
explicit stop conditions in `CODEX-START-HERE.md` occurs.
