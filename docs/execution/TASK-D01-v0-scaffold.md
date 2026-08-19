# TASK-D01 — Introduce Minimal Executable V0 Scaffold

**Status:** Ready  
**Model class:** STANDARD  
**Reasoning:** medium

## Goal

Turn the documentation/process-only repository into the smallest executable,
testable browser TypeScript project while preserving the AI-SDLC scaffold.

## Read first

```text
AGENTS.md
CODING-STANDARDS.md
SECURITY.md
docs/DECISIONS.md
docs/process/scaffold-cloner-analysis.md
docs/architecture/v0-repository-layout.md
docs/adr/ADR-005-v0-toolchain.md
docs/codex/architecture-guardrails.md
```

Load only `.opencode/` skills required by existing routing.

## Preflight

Confirm:

- no application `package.json` already exists, or explain if it does;
- Node satisfies Vite 8 requirement;
- repository policy has no material contradiction.

If repository policy mandates a different package manager/lint tool, adapt the
mechanical scaffold and report it.

## Implement

Minimum:

- `package.json`;
- lockfile;
- strict TypeScript config;
- Vite browser entry;
- minimal `index.html`;
- minimal `src/main.ts`;
- minimal bootstrap module;
- Vitest;
- one trivial unit test.

Do not install PixiJS, Rapier, OSM libraries, AI, UI framework or worker yet.

## Required command behavior

```text
npm run dev
npm run build
npm run typecheck
npm run test:run
```

Use equivalent package-manager commands if repository policy requires another
manager.

## Verify

Actually run:

- install;
- typecheck;
- test run;
- production build;
- dev-server smoke where environment allows.

Record versions and exit status.

## Preserve

Do not alter architectural documents to fit a scaffold shortcut.

Do not replace `.opencode/`.
