# ADR-005 — V0 Toolchain

**Status:** Accepted for prototype, subject to repository-local policy check  
**Date:** 2026-08-19

## Decision

V0 application baseline:

```text
TypeScript strict
Vite 8 major line
Vitest 4 major line
npm initial package manager
no UI framework
```

## Node

Vite 8 currently requires:

```text
Node >= 20.19
or Node >= 22.12
```

Use a currently supported Node release satisfying that requirement.

## Package versions

At scaffold time, resolve current compatible releases inside the accepted major
lines and commit the lockfile.

Do not use floating `*` dependencies.

## TypeScript

Enable strict checking.

`npm run typecheck` must invoke TypeScript without emitting application build
artifacts.

## Vite

Use a vanilla TypeScript browser application.

Do not add SSR or a component framework.

## Vitest

Use for pure/unit/compiler integration tests.

Test transpilation does not replace `tsc --noEmit`.

## Browser E2E

Add Playwright when renderer/browser behavior exists, not necessarily in the
first scaffold commit.

## Existing repository policy

Codex must first read:

- `CODING-STANDARDS.md`;
- `SECURITY.md`;
- relevant `.opencode/` skills.

If they mandate a different package manager, lint/format tool or compatible
file layout, adapt the mechanical scaffold while preserving:

- TypeScript strict;
- Vite;
- Vitest;
- no UI framework.

A direct contradiction should be reported before code.

## Sources checked 2026-08-19

- https://vite.dev/blog/announcing-vite8
- https://vite.dev/guide/
- https://v4.vitest.dev/guide/
- https://www.typescriptlang.org/tsconfig/strict.html
